# Palancas y paralelogramo desde la cámara — diseño

Estado: **propuesta**. No hay código escrito. Lo que sigue es qué se puede medir
de verdad, qué solo se puede estimar, y en qué orden conviene hacerlo.

La petición: una sección del encoder que analice biomecánica —ley del
paralelogramo y palancas— desde la misma cámara, «con precisión». Este documento
existe porque «con precisión» es justo la palabra que hay que definir antes de
escribir una línea: hay números aquí que salen medidos con un grado de error, y
otros que son un modelo con tablas antropométricas y no se pueden pintar igual.

## Lo que ya está hecho, que es la mitad difícil

Un análisis de palancas necesita cuatro cosas antes de la física, y están
construidas, probadas y con banco:

| Hace falta | Ya existe |
|---|---|
| Escala metros↔píxeles **comprobada**, no declarada | `pruebaDeGravedad` la contrasta contra la `g` local; `revisarEscala` contra el ROM plausible del ejercicio |
| Un **plano métrico**, no un factor escalar suelto | `referenciaPlana` + `ajusteAfin` + `detectarDianaCuatro` |
| Saber **cuánto miente la cámara** | `anguloDeCamara` desde la elipse del disco; `INCLINACION_CALIDAD_GRADOS` y `GIRO_CALIDAD_GRADOS` |
| La **masa** que se mueve | `cargaKg` ya viaja en cada `Medicion` de la tanda |
| Masa y talla del atleta (solo para la fase D) | `composicion.ts`: `pesoKg`, `alturaCm` |

Falta una sola pieza de sensado —**varios puntos seguidos a la vez**— y la
matemática de fuerzas encima.

## La ventaja que aquí sí se puede tener

Casi toda la biomecánica de aplicación asume estática: fuerza = m·g. Este
encoder mide la aceleración fotograma a fotograma, así que puede calcular la
fuerza **real** sobre la barra:

    F = m · (g + a)

Eso *es* la ley del paralelogramo aplicada bien: la resultante de gravedad más
inercia, no la gravedad sola. En el arranque de una sentadilla la diferencia son
entre un 15 % y un 25 % de fuerza — justo en el instante que decide si el peso
sube. `velocidades()` ya está escrita; la aceleración sale con una derivada más
sobre los mismos tiempos y la misma semiventana.

## La distinción que estructura todo el diseño

**Los ángulos no necesitan escala. Los brazos de palanca sí.**

Un ángulo es un cociente entre diferencias de píxeles: si la escala está mal en
un 12 %, el ángulo sale exactamente igual de bien. Un brazo de palanca en
centímetros hereda entero el error de escala, y el torque lo hereda encima de la
masa.

Por eso la salida se parte en dos, y en pantalla no se mezclan:

| Familia | ¿Depende de la escala? | Error que manda |
|---|---|---|
| Ángulos de segmento, relación entre palancas, simetría | **no** | fuera de plano |
| Brazo de palanca en cm, torque en N·m | **sí** | escala del plano del cuerpo + centro articular |

## Sensado: marcas de color en las articulaciones

Decidido: marcas, no pose por IA. Tres razones, y la tercera es la que manda.

1. El error. Una marca da centroide con 1-2 px; una red de pose da el centro
   articular con 2-4 cm, y el brazo de palanca entra **lineal** en el torque.
2. Reutiliza lo que hay: `pixelesQueCasan`, `separarMarcadores`,
   `centroideEnVentana` y los umbrales adaptativos de `seguimiento.ts` — todo eso
   ya sobrevivió a la luz de un gimnasio, que fue la cuarta vez que el banco
   mintió.
3. **Se puede correr con `node` a secas.** El banco es un script que abre PNGs;
   una red de pose no entra ahí, y sin banco esto se convierte en escenas
   fabricadas que salen todas en verde. Eso ya costó semanas una vez.

### Cómo se distinguen entre sí

Un tono distinto por articulación (hombro, cadera, rodilla, tobillo). El primer
fotograma barre la imagen entera una vez por tono; a partir de ahí cada marca
vive en su propia ventana pequeña —el mismo mecanismo de `seguimiento.ts`—, así
que el coste no es N veces el bucle completo sino N ventanas de 40 px.

Y una reja de plausibilidad que la barra sola no podía tener: **la longitud de un
segmento no cambia**. Si la distancia cadera-rodilla se mueve más de un umbral
entre fotogramas, una de las dos marcas se enganchó a otra cosa. Es la misma idea
que la ventana, aplicada al esqueleto en vez de a un punto suelto.

## El problema de la profundidad, que es el que puede arruinarlo

El disco da la escala **en el plano del disco**. Las articulaciones no están en
ese plano: el disco está en la punta de la barra, a 60-80 cm del plano sagital
del atleta. A 4 m de cámara, esos 70 cm son un **17 % de error de escala** si se
usa la escala del disco para medir el cuerpo.

Es la misma familia de error que documenta `escala.ts` — el que no deja rastro,
porque el número sale, la serie sale limpia y la calidad sale buena. No se puede
resolver suponiendo.

**Solución: dos escalas medidas, y su cociente como puerta de calidad.**

- La del **plano de la barra**: el disco, como hasta hoy.
- La del **plano del cuerpo**: la distancia real entre dos marcas del atleta,
  medida una vez con cinta y guardada en su ficha (p. ej. rodilla-tobillo en mm).
  Da la escala donde hace falta, y de paso es una comprobación independiente.
- El **cociente entre las dos** mide la separación de planos. Si se dispara, la
  cámara está demasiado cerca o demasiado ladeada, y eso se dice en pantalla en
  vez de salir como un torque plausible y falso.

## Las cuatro fases

Los cuatro objetivos pedidos entran, pero no a la vez. Cada fase produce algo
usable y **ninguna necesita la siguiente para ser verdad**.

### Fase A · Ángulos (sin escala) → técnica y seguridad

Marcas, seguimiento multipunto, ángulos de segmento por fotograma. Salida: el
ángulo mínimo de cadera y rodilla por repetición y **cuánto se degrada dentro de
la serie con la fatiga** — que es el dato que un entrenador usa y que hoy no
tiene nadie.

No necesita escala, ni masa, ni antropometría. Es la fase con el error más bajo
de las cuatro y la única que se puede contrastar directamente con un goniómetro.

### Fase B · Brazos de palanca en centímetros → elegir ejercicio y carga

Añade la escala del plano del cuerpo. Salida: la **relación de palancas** del
atleta (fémur/tibia, torso/fémur) y cuánto se adelanta la barra respecto a la
rodilla o a la cadera. Es lo que decide si a alguien le conviene sentadilla
frontal o búlgara, y va **al cerebro, no a la pantalla**.

### Fase C · Fuerza y torque de la carga externa → el número físico y el dibujo

F = m·(g + a) con la carga que ya viaja en la tanda. Torque de la carga sobre
cada articulación marcada: τ = |r × F|, con r del punto de la barra a la
articulación.

Aquí cuelga el visual: el vector de fuerza sobre el fotograma, descompuesto por
la ley del paralelogramo en la componente que **rota** el segmento y la que lo
**comprime**. Es la fase que le explica al atleta por qué la barra adelantada le
carga la lumbar, con su propio vídeo y su propio número.

Sigue siendo **medido**: masa conocida, aceleración medida, geometría medida.

### Fase D · Dinámica inversa con los segmentos del cuerpo → estimación

Añadir el peso y la inercia de los propios segmentos con tablas antropométricas
(de Leva; `pesoKg` y `alturaCm` ya están). Esto **deja de ser medición y pasa a
ser modelo**, y va etiquetado como tal en toda pantalla donde salga. Es la fase
opcional: A, B y C valen solas.

## Lo que esto NO puede hacer, dicho antes de empezar

1. **Es 2D sagital.** Fuera de plano corrompe ángulos y brazos a la vez. Las
   puertas de calidad que existen sirven, pero hay que endurecerlas: para
   velocidad un giro de 10° es tolerable; para un ángulo de cadera, no.
2. **No hay plataforma de fuerza.** Sin reacción del suelo, el torque articular
   *absoluto* —el que incluye el cuerpo— es una estimación. El de la carga
   externa (fase C) sí es medido. Son dos números distintos y no se pintan igual.
3. **El centro articular no está en la piel.** La cadera es el peor caso: el
   trocánter mayor no es el centro de rotación y se desvía 2-3 cm. Ése es el
   error que manda en el torque de cadera, y no lo arregla ninguna cámara mejor.
4. **Con ropa holgada la marca se mueve sola.** No hay forma limpia de detectarlo
   desde el fotograma: se resuelve en la instrucción de captura, y hay que
   decirlo, no disimularlo.

## El banco, que es lo que decide si esto vale algo

Sin verdad medida a mano esto repite el fallo exacto que costó las semanas:
escenas fabricadas todas en verde y las reales no. Tres capas, de más barata a
más cara:

1. **Palanca rígida de laboratorio.** Un palo con marcas a distancias medidas con
   cinta y un disco conocido colgado a una distancia conocida. Toda la cadena
   —escala, brazo, torque— se comprueba contra aritmética de papel. Cuesta una
   tarde y caza cualquier error de signo, de eje o de factor.
2. **Fotogramas reales anotados a mano.** Los 60 que ya hay en el banco no
   sirven —no llevan marcas—, así que hacen falta nuevos, con el ángulo medido
   con goniómetro en la postura congelada.
3. **La misma serie con dos cámaras a la vez**, una perpendicular y otra ladeada,
   para *medir* cuánto se lleva el fuera de plano en vez de suponerlo.

## Presupuesto de error, para contrastar contra el banco

Números a batir, no números conseguidos:

| Magnitud | Objetivo | De dónde sale el error |
|---|---|---|
| Ángulo de segmento | ±1° | centroide de 1-2 px sobre segmentos de 200-400 px |
| Ángulo con 10° de giro fuera de plano | ±3-4° | proyección; se acota con la puerta de calidad |
| Brazo de palanca, rodilla | ±5 mm | escala del plano del cuerpo (2 %) + centroide |
| Brazo de palanca, cadera | ±15 mm | lo anterior + centro articular contra piel |
| Torque de cadera, carga externa | **±7 %** | los dos de arriba, a 100 kg y 30 cm de brazo |

Si el banco dice otra cosa, manda el banco y se corrige esta tabla.

## Dónde vive el código

El núcleo nuevo —`postura.js` (marcas y esqueleto) y `palancas.js` (fuerzas y
momentos)— **nace en `cerebro-alpha/herramientas/encoder-camara`**, con su
batería allí, y se copia a la app con sus huellas en `huellas.json`. Es lo que
dice `ORIGEN.md` y lo que el guardián de `nucleo.test.ts` vigila desde ayer.
Escribirlo primero en la app sería empezar por la copia.

En la app: una sección propia junto al encoder, no dentro de él. La medida de
velocidad no debe empeorar ni ralentizarse porque esto exista.

## Lo que falta decidir

- **Qué articulaciones se marcan** en la primera versión. Cuatro (hombro, cadera,
  rodilla, tobillo) cubren sentadilla y peso muerto; muñeca y codo hacen falta
  para press y dominadas.
- **Qué marca física se usa.** Pegatinas de color, bandas, o la diana impresa que
  ya existe en `imprimir-diana.mjs`, reducida.
- **Si la fase D entra.** Añade el modelo antropométrico y con él la primera
  cifra de esta aplicación que no está medida.
