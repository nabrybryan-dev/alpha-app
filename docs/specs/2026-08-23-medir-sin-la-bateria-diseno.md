# Medir bien sin la batería del otro repo — diseño

**2026-08-23**

El núcleo del encoder (`src/features/entrenar/encoder/nucleo/`) entra verbatim
desde `herramientas/encoder-camara`, y lo validan **56 casos que viven allí**.
En esta máquina ese repo no está. El único guardián que quedaba era
`nucleo.test.ts`, que compara huellas sha-256: sabe decir «alguien tocó la
copia» y no sabe decir **si mide bien**.

Este documento es lo que se hizo para poder arreglar y afinar la medición sin
esa batería, y lo que se encontró al hacerlo.

---

## La decisión de fondo: dos guardianes distintos para dos cosas distintas

| Qué | Con qué se defiende | Dónde |
|---|---|---|
| Que el núcleo **calcula** bien | Movimiento fabricado del que se conoce la respuesta exacta | `scripts/banco-encoder.mjs`, con `node` a secas |
| Que la app **mira donde debe** | Tests de vitest sobre un módulo puro | `seguimiento.test.ts` |
| Que la copia del núcleo no se toca | Huellas sha-256 | `nucleo.test.ts` (ya existía) |

El banco corre con `npm run banco-encoder`, o directamente con `node
scripts/banco-encoder.mjs`. **Va aparte de vitest a propósito**: se corre sin
instalar nada, que es exactamente la situación en la que hace falta.

Noventa y un casos. Rejilla de fps × velocidad × %PV, los dos sentidos
(subir y bajar), recorridos cortos, velocidades extremas, ruido de centroide,
fotogramas perdidos, la prueba de gravedad, imágenes fabricadas para el color y
para el disco, y la cadena entera fotograma a fotograma.

### Lo que el banco NO es

No es la batería de las herramientas y no la sustituye. Aquella compara contra
**vídeos reales con verdad medida a mano**; esta fabrica el movimiento. Un error
de código sale aquí. Un error de gimnasio —luz, escorzo, encuadre, un marcador
que se despega— no sale aquí y no va a salir nunca. Cuando el repo de las
herramientas vuelva a estar a mano, esto no se retira: se suma.

### El banco se equivocó dos veces antes de acertar una

Queda escrito porque es la parte que se olvida:

1. **Acusó al núcleo de un sesgo que se había inventado él.** Fabricaba la
   altura de la barra a partir del **número de orden** del fotograma, no de su
   instante. Con fotogramas que llegan con ±15 % de jitter, la duración real de
   la concéntrica no es la nominal — así que la velocidad de verdad no era la
   que el banco daba por verdad. Reportaba **3,8 puntos de %PV falsos** a 1 m/s.
   Con la altura atada al reloj, el error desaparece.
2. **Midió el tiempo equivocado.** Cronometraba el pintado de la escena —900 KB
   por fotograma— junto con la detección, y eso dejaba las dos políticas
   empatadas a 6 ms. Cronometrando solo la detección, la diferencia se ve.

Con las dos cosas arregladas: **el núcleo pasa todos los casos**. La aritmética
está bien. Lo que estaba mal era la capa de app.

---

## Lo que se encontró en la app

Ocho formas de medir mal. Ninguna fallaba: las ocho devolvían un número, con su
calidad y su %PV, y el número estaba mal.

### 1 · Se miraba el fotograma entero, y ahí entra cualquiera

`pixelesQueCasan` sobre toda la imagen mete en la nube cualquier cosa del color
del marcador: un disco pintado, una camiseta, el logo de la pared.
`separarMarcadores` entonces empareja la marca de la izquierda con el intruso y
devuelve una pareja impecable — con su separación, su ángulo y su punto medio.
Ese punto medio se mueve **la mitad** de lo que se mueve la barra.

Medido en el banco, serie de 3 repeticiones a 0,600 m/s reales:

| | v₁ medida | Verdad |
|---|---|---|
| Fotograma entero | **0,236 m/s** | 0,600 m/s |
| Con ventana | 0,600 m/s | 0,600 m/s |

El núcleo ya traía la solución escrita: `centroideEnVentana`, con el comentario
de que la ventana «es la misma reja de plausibilidad que usa el disco». Estaba
escrita, tipada en el `.d.ts`, y sin usar por nadie.

### 2 · Y la ventana no basta si el primer fotograma se engancha a lo que no es

Éste es el hallazgo que no se veía venir. Con la ventana puesta pero la
adquisición mirando la imagen entera, el seguimiento se enganchaba al intruso en
el fotograma cero **y luego lo perseguía con toda fidelidad**: tres
repeticiones, %PV coherente, y v₁ = 0,398 donde la verdad era 0,600. La puerta
de calidad no tenía nada que objetar.

El dato que lo arregla estaba ahí desde el principio: **dónde tocó el dedo**. Se
usaba para leer el color y se tiraba. Ahora la referencia se busca en el 40 % de
la imagen alrededor del toque, y la detección tiene que **incluir la marca que
se tocó** (`tocaAlguna`) o no vale.

### 3 · Los mínimos de saturación y brillo eran fijos

Un marcador pastel —rosa claro, flúor descolorido— no llega a 0,35 de
saturación, así que **no casaba nunca con nada**: cero píxeles, cero fotogramas.
En pantalla eso se lee como «la cámara va mal». Ahora los mínimos salen del
color que se fijó (`umbralesDelColor`).

Con su contrapeso, porque bajar el suelo abre la puerta contraria: un gris de
pared también tiene poca saturación, y con los mínimos rebajados casa consigo
mismo, la nube es la imagen entera y `separarMarcadores` la parte en dos mitades
—suelo y pared— devolviendo una pareja perfecta. Ese caso se cazó escribiendo el
test, no leyendo el código. Lo tapa `FRACCION_MAX_DEL_COLOR`: si más del 20 % de
lo mirado es de ese color, lo que se tocó es el fondo.

### 4 · Al disco se le pedía una predicción y se le daba una posición

`detectarDisco` documenta que `prediccion` es «posición anterior + velocidad», y
`useCaptura` le pasaba solo la posición anterior. Con su reja de 40 px, en
cuanto caen un par de fotogramas la barra recorre más de lo que la reja admite y
el fotograma se descarta — **en la parte rápida de la repetición**, que es la
que decide el %PV. Medido en el banco, con dos fotogramas perdidos y 46 px de
salto: 0 de 8 fotogramas con la posición anterior, 6 de 8 con la predicción.

### 5 · El instrumento se estropeaba a sí mismo cuanto más larga era la serie

El rastro de la trayectoria se dibujaba recorriendo **todas** las muestras en
cada fotograma. Al final de una serie de mil muestras son mil segmentos por
fotograma, sesenta veces por segundo. El precio no es que se vea peor: los fps
bajan, y por debajo de 50 la puerta descarta la toma. Ahora se dibujan las
últimas 240 — cuatro segundos, que es de sobra para ver si la trayectoria salta.

### Y dos que no son de medición pero rompen igual

- **`videoWidth` puede ser 0 justo después de `play()`.** La escala salía
  `Infinity`, la altura del lienzo `NaN` —que el canvas convierte en 0 sin
  quejarse— y la herramienta se quedaba viva, con la cámara encendida, sin
  detectar nada nunca. El aviso decía «no veo la marca».
- **Girar el teléfono cambia el tamaño del vídeo.** Con el lienzo congelado en la
  proporción anterior, `drawImage` aplasta la imagen, y una imagen aplastada mide
  mal la escala en píxeles por metro **sin dar ningún síntoma**.

### 6 y 7 · Los dos que salieron revisando el arreglo, no el código viejo

Van juntos porque son el mismo error visto dos veces: **cerrar la ventana
alrededor de lo poco que se ve es una trampa de un solo sentido.**

- **Una marca tapada dejaba la serie entera con un solo marcador.** Al ver una
  marca donde había dos, `unSoloMarcador` devuelve un punto —que es una
  detección legítima—, la ventana del fotograma siguiente se dibuja sobre ese
  punto, y la otra marca ya no cabe dentro **nunca más**. Tres fotogramas de
  oclusión —la mano del que ayuda cruzando por delante— y el resto de la serie
  se medía sin escala, en píxeles por segundo, sin un solo aviso.
- **Y el reintento que lo arregla es la puerta trasera del intruso.** Si al ver
  una sola marca se vuelve a mirar el fotograma entero, ahí está el logo de la
  pared esperando: sale una pareja perfecta hecha de la marca visible y el
  intruso, y como es una pareja y no un marcador suelto, **gana**. Lo que los
  separa es geometría, no confianza: una barra no se estira 300 px entre dos
  fotogramas ni se teletransporta media imagen (`cuadra`).

Y una tercera, más tonta y más cara: al ver una sola marca, tomar su centro como
centro del conjunto es un salto de 120 px que no ha dado nadie —el centro de una
pareja está en medio, el de una marca sola está encima de ella— y arrastra la
ventana medio encuadre justo cuando lo que hacía falta era no moverla.

Cada reja se comprobó quitándola: si al quitarla no se pone nada rojo, la reja
no defiende nada y el test no vale. Dos de las seis no estaban cubiertas por
ningún caso — una se cubrió, y la otra (`acertada`) se queda escrita como red de
seguridad, con el comentario diciendo que nada la dispara hoy.

### 8 · La predicción extrapolaba un fotograma, no el tiempo

Éste salió al extender el banco a las otras dos referencias, y es el más
interesante de todos porque **el arreglo anterior lo tapaba a medias**.

La predicción hacía «donde estaba más lo que se movió en el último fotograma».
Eso vale mientras no se caiga ninguno — y los fotogramas no se caen sueltos, se
caen **a rachas**: lo que los tira es un tirón del recolector de basura o un
frenazo térmico, y eso se lleva cinco o seis seguidos. Un fotograma caído no
llega al bucle, `requestVideoFrameCallback` sencillamente no dispara, así que
nadie se entera de que existió.

Con la barra a 10 px por fotograma, tras una racha de seis la referencia está
60 px más allá y la predicción apuntaba a 10. La reja de `detectarDisco` son 40:
el fotograma se descarta, y el siguiente también, y el siguiente — porque la
referencia se aleja mientras la predicción se queda donde estaba.

`paso()` recibe ahora el instante del fotograma y la extrapolación va por tiempo.
Medido en el banco, con rachas de cinco: **64 % de detección con la posición
anterior, 67 % con la predicción** — y 67 % es el techo, porque el resto son
fotogramas que el aparato nunca entregó.

Y el banco volvió a mentir antes de acertar, por tercera vez: modelaba la pérdida
como monedas independientes al 15 %, y así casi nunca se juntan cuatro. Con
pérdidas sueltas las dos políticas empataban y el caso salía en verde sin probar
nada.

### Y el arreglo del #86 que solo llegó a una de las dos pantallas

`Visor` (la medición dentro de la serie) traducía el toque con
`puntoDeLaImagen`, que tiene en cuenta las bandas negras del `object-contain`.
`EncoderPage` se quedó con la regla de tres sobre la caja entera: el mismo fallo
que el #86 arregló, en la otra pantalla, catorce días después.

---

## Lo que cambió en el código

`seguimiento.ts` es nuevo y se lleva las decisiones de medición que estaban
dentro del bucle de `useCaptura`, mezcladas con el canvas y con React. No es
orden por el orden: **dentro de un hook con cámara no se pueden probar sin un
navegador**, y son justo las decisiones donde vivía el error. Ahora entra un
`Uint8ClampedArray` y salen números, así que las corre igual vitest que `node`.

El núcleo **no se toca**: `nucleo.test.ts` sigue en verde y las huellas son las
mismas. Lo único que se añadió a `analisis.d.ts` es la firma de `distanciaTono`,
que ya existía en el original — el `.d.ts` no lleva huella, y `ORIGEN.md` dice
que si la pantalla necesita otra función se añade su firma leyendo el original.

Efecto lateral que no se buscaba: la ventana mira **menos** píxeles que el
fotograma entero aunque los mire a paso 1 en vez de a paso 2. 0,31 ms por
fotograma contra 0,44 — y con cuatro veces más densidad de píxeles para el
centroide. Más barato y más preciso a la vez.

---

## 9 · La escala en milímetros: el error que no deja rastro

Es el que más daño hace de todos, porque es el único que no falla de forma
visible. Todo lo demás chirría: el marcador se pierde, los fps bajan, la
referencia sale torcida, y `calificar` lo dice. Elegir «olímpico 15 kg» con un
bumper de 450 puesto **desvía todas las velocidades por el mismo 12,5 %**, la
serie sale limpia, la calidad sale buena, y el número entra en el historial
siendo mentira.

Y el %PV sobrevive a ese error, porque es un cociente entre dos velocidades
medidas con la misma regla equivocada. Eso, que en el §4 del plan es una virtud,
aquí es la trampa: **la métrica que más se mira es justo la que no se entera.**

Lo único que chirría es el recorrido. `romPlausible` lleva la tabla por ejercicio
desde el principio en `nucleo/disco.js`, con su comentario explicando exactamente
esto — y **no la llamaba nadie**. Tercera función del núcleo escrita, tipada en
el `.d.ts` y sin usar, después de `centroideEnVentana` y de la predicción con
velocidad.

Ahora la llama `escala.ts` desde `useCaptura.parar()` —un solo sitio, las dos
pantallas cubiertas— y el veredicto viaja a la fila de la tanda (`romM`,
`escalaDudosa`) y al noveno criterio, «Tomas con la escala en duda = 0».

### Hasta dónde llega, medido

Una reja que no se mide se acaba vendiendo por más de lo que es. El banco calcula
el factor de error que hace falta para que salte:

| Ejercicio | Recorrido real | Salta por debajo de | Salta por encima de |
|---|---|---|---|
| Sentadilla | 55 cm | ×0,45 | ×1,55 |
| Press banca | 35 cm | ×0,42 | ×1,58 |
| Peso muerto | 60 cm | ×0,49 | ×1,42 |

O sea: **caza el teclazo —un cero de más, el diámetro en cm donde se pedían mm—
y NO caza la confusión de discos.** 450 contra 400, 450 contra 325 y 400 contra
325 pasan las tres sin chistar, y esa es justo la confusión de todos los días.
Para eso está la prueba de gravedad, que valida escala y tiempos a la vez contra
una constante que nadie discute.

La reja es gruesa a propósito: un rango estrecho descartaría recorridos legítimos,
y un instrumento que grita cuando no pasa nada se acaba ignorando cuando pasa.

---

## Lo que sigue sin estar defendido
- **El escorzo con dos marcadores.** Sigue entrando ciego. Es lo que ya dice
  `calificar` con `inclinacion_no_medible`, y no lo arregla ningún test: lo
  arregla usar la diana de cuatro marcas.
- **La luz de un gimnasio de verdad.** Las escenas fabricadas tienen ruido de
  sensor y decorado, pero no tienen fluorescentes parpadeando ni contraluz.
- **El reloj de cada aparato.** `reloj-fotograma.js` elige mirando cuál avanza,
  pero eso solo se comprueba de verdad en el aparato.

Y lo primero de todo cuando el otro repo vuelva a estar a mano: correr allí
`comprobar-copia-en-la-app.mjs`, porque las huellas de aquí solo dicen que la
copia no se tocó **aquí**.
