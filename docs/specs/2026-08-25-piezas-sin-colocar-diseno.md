# Las tres piezas sin colocar — diseño

**2026-08-25**

De las seis direcciones visuales del hero, tres nunca entraron en la app: **A
Despiece**, **E Físico** y **F Proyección**. Existen, están producidas y graduadas,
y solo se ven en el rollo del manual de marca. Esto decide dónde va cada una y con
qué mecanismo.

---

## 0. Lo que se creía y no era

`fondoHero.ts` afirmaba que las otras cuatro piezas «van en bandas apaisadas por la
app (Entrenar, Progreso, Contenidos y el manual de marca)». Las tres partes de esa
frase estaban mal, y llevaban mal desde el 20-08:

- **No hay bandas.** `BandaDireccion` se retiró en la integración cinemática
  precisamente por leerse como material pegado encima del título.
- **Progreso no lleva pieza.** Llevó la E bajo la curva y se sustituyó por
  `terreno-progreso.webp` («bajo la curva había dos pantorrillas, ahora hay
  terreno», #82). `ProgresoPage` además quitó a propósito la banda superior.
- **Eran cinco, no cuatro.** F ni se mencionaba.

El comentario ya está corregido. El reparto real hoy: **C** en splash, login y
`LOOP_HERO`; **B** en Entrenar/Ruta como secuencia de 36 WebP con scrub por scroll
—no consume su `.webm`—; **D** en Contenidos como lámina montada; **A, E y F** en
ninguna parte.

---

## 1. La regla que sigue gobernando

La misma con la que abre `2026-08-20-integracion-cinematica-diseno.md`: **ninguna
pantalla resuelve igual**. Una plantilla repetida es reflejo de categoría, no
diseño. Colocar estas tres como bandas 16:9 sobre el título sería reponer justo lo
que aquel trabajo quitó.

Y una segunda, que sale de medir y no estaba escrita en ningún sitio:

> **Cuatro de las seis piezas traen su propia tinta.** A, B, C y F llevan una banda
> plana de RGB(6,10,11) —`--ink-900` es `#08090a`— ocupando el **40% inferior**
> exacto del fotograma. No es compresión ni casualidad: la pieza reserva por
> construcción el sitio donde va el texto. D y E **no la tienen**: D acaba en 55,2
> de luminancia en su última fila y E en 27,6.

Eso explica de golpe por qué D necesitó en Contenidos una lámina de tinta que
subiera a taparla, y anticipa que E va a necesitar algo parecido.

---

## 2. Las medidas de las seis piezas

Medido sobre los pósters —que son el primer fotograma exacto de cada vídeo—, luma
Rec.709 sobre 0–255. El umbral de referencia para texto encima es **18**, el mismo
que usó el héroe de Logros.

Todos los números de este spec los reproduce `medir-piezas.py`, que vive con el
resto de la mesa de diseño en `Downloads\hero-d-esfuerzo\` —al lado de `banco.py` y
`estudio.py`— y se corre desde la raíz de este repo. Si alguno de estos valores se
cita en el futuro, medirlo otra vez antes: es la lección de `CLAUDE.md` §2 con el
recuento de tests.

| Pieza | media | p50 | p99,5 | tercio sup. | tercio inf. | banda de tinta |
|---|---:|---:|---:|---:|---:|---|
| A Despiece | 14,7 | 9,2 | 120,5 | 21,0 | 9,2 | **40,1%** |
| B Órbita | 21,3 | 9,2 | 118,2 | 35,2 | 9,2 | **40,7%** |
| C Ascenso | 25,2 | 15,0 | 117,7 | 38,4 | 9,9 | **40,0%** |
| D Esfuerzo | 84,7 | 78,1 | 254,0 | 101,7 | 62,1 | — |
| E Físico | 30,4 | 12,0 | 121,0 | 37,2 | 25,3 | — |
| F Proyección | **8,5** | **4,3** | **62,2** | 1,6 | 16,4 | **40,0%** |

**E se mide tras su `encaje`.** `origin-right scale-[1.213]` equivale a recortar el
17,6% izquierdo, que es la columna negra que documenta `direccionesVisuales.ts`.
Ya recortada: media **36,8**, p50 13,0, y por tercios 35,3 · **55,7** · 19,4. El
cuerpo iluminado está en el centro.

**Toda la tabla se remidió el 25-08 tras traer `main`,** que en el #96 regraduó
cinco de las seis piezas —D no, porque se está rehaciendo—. Los valores anteriores
describían fotogramas que ya no existen. La fila de F es además la del archivo
LEVANTADO: el de `main` daba media 5,6 · p50 2,9, y sigue siendo la pieza más oscura del
catálogo por un margen enorme. Que admita texto encima en cualquier punto es
verdad, y fue justo lo que me llevó al error: es un TECHO, no un suelo. Ver §9.

---

## 3. El problema que estas tres traen y las anteriores no

**Hoy y Bienestar son superficie CLARA** (`data-theme="light"`, `--bg: #f7f7f5`).
Logros y Progreso son oscuras. Las cuatro pantallas ya resueltas eran oscuras salvo
Contenidos, y Contenidos es exactamente donde hubo que inventar la lámina montada
porque «meter una banda oscura a sangre en una pantalla clara» se leía como
copiar-pegar.

Dos de las tres piezas que quedan caen en pantalla clara. Así que el problema no es
solo «no repetir mecanismo»: es que en claro la pieza tiene que ser **un objeto con
forma**, no un suelo. Y el objeto tiene que ser distinto en cada una, o volvemos a
la plantilla.

---

## 4. Mecanismo por pantalla

### F Proyección → Logros, la tira de rachas

*«Un sprint resistido de noche: el cuerpo empuja contra la banda y la calle no se
mueve.»* Es la definición de una racha: empujas todos los días y el paisaje no
cambia. Es también la única de las tres que cae en pantalla oscura.

Las tres tarjetas de racha (`LogrosPage.tsx:62-75`) dejan de ser tres cristales
sueltos sobre el fondo y pasan a ser **una sola tira con F debajo**. La pieza se
revela **solo hasta donde ha llegado la racha**: el ancho descubierto es
`actual / record`. Con la racha rota (`rachaRota`, ya calculado en `:30`) la pieza
se congela en su póster — sin movimiento, que es lo que la pantalla está diciendo.

Geometría: la tira mide 3,50:1, la pieza 16:9. Cover **anclado al centro**, medido
en las tres anclas posibles:

| ancla | media | p95 | p99,5 |
|---|---:|---:|---:|
| arriba | 2,1 | 4,5 | 55,3 |
| **centro** | **8,1** | **16,4** | **102,0** |
| abajo | 14,9 | 16,4 | 81,2 |

Arriba y abajo la pieza no se ve —son cielo y tinta—. El centro es donde está el
corredor y la farola. Las tres son del archivo ya levantado; sin levantar, el
centro daba 5,6. La conclusión —anclar al centro— no cambia, porque las tres se
mueven a la vez.

**No se toca el héroe de Logros.** `logros-peldanos.jpg` son los agujeros numerados
del rack, elegidos por la metáfora de los peldaños y **medidos** (24,0 antes,
**10,2** ahora, umbral 18). Sustituirlo por F desharía una decisión medida y
rompería la metáfora. F entra debajo, no arriba.

### A Despiece → Hoy, el disco de «Tu bloque actual»

*«La barra se desarma en el aire y cada disco ocupa su sitio.»* El bloque actual es
literalmente eso: la prescripción del coach repartida en piezas —fase energética,
proteína, pasos— que ocupan cada una su fila (`BloqueActual.tsx:57-75`).

En pantalla clara la pieza no puede ser suelo, así que **es un disco**: A recortada
en círculo, un objeto redondo junto al título de la tarjeta, del que salen las
filas. No lleva texto encima — el texto son las filas, al lado.

El disco se centra en **x=518, el 40% del ancho**, y ahí manda la composición
antes que el número: en ese punto la ventana contiene **el disco de la barra —la
placa roja y la mano—**, así que el disco de la tarjeta contiene un disco, que es
la frase de la pieza, y trae de paso el rojo de marca. Es además el máximo de
luminancia medido (35,3 contra 33,4 en x=621), pero por poco: en el fotograma
regraduado la luminancia está casi igualada de lado a lado.

Ese punto **se movió con el re-grade del #96**: antes estaba en x=621 y con el
encaje viejo el disco pasó a enseñar la cara del atleta. El número solo no lo
habría cazado. Es la misma lección de la §9 en otra forma: medir y **mirar**.

El 40,1% inferior de A es tinta plana, y en un recorte circular no aporta nada. El
disco se ancla en el 30% de altura, dentro de la imagen viva (media 18,3 en el 60%
superior).

### E Físico → Bienestar, la columna de «Mis medidas»

*«La cámara sube por el físico y recorre las inserciones una a una.»* `MedidasCard`
pide cinco perímetros en una lista vertical (`PERIMETROS`, `MedidasCard.tsx:8`). La
pieza sube; la lista baja. Van juntas.

Mientras el formulario está abierto, a la izquierda de los campos aparece una
**columna vertical 1:3** con la pieza. No es una banda girada: es la orientación
natural de un plano que sube por un cuerpo.

Medido sobre E ya con su `encaje`, columna cover de 240×720:

| ancla | media | p95 | p99,5 |
|---|---:|---:|---:|
| izquierda | 16,9 | 75,0 | 108,0 |
| **centro** | **63,4** | 118,0 | 122,0 |
| derecha | 18,8 | 66,0 | 126,0 |

Se ancla al **centro**: es donde está el cuerpo iluminado. 63,4 es alto para poner
texto encima y por eso **no lleva ninguno** — la columna es marco, los campos van
fuera. En pantalla clara ese valor juega a favor: una columna a 16,9 sería un
agujero negro en una tarjeta blanca.

Escala: a 64×192 CSS con densidad 3 el destino son 192×576 px y la fuente da
240×720, o sea **0,80x**. Nunca se amplía, que es el criterio de
`fondos-de-tarjeta.test.ts`.

---

## 5. Lo que NO se toca, y por qué

- **Progreso.** Figura como *Hecho* con mecanismo propio: la pieza *es* el relleno
  del área del gráfico. Meter F ahí obligaría a sustituir `terreno-progreso.webp`,
  que ya fue la corrección deliberada de #82, y además el sentido choca: F es
  empujar sin avanzar y la pantalla se llama Progreso.
- **El héroe de Logros.** Ver arriba: decisión medida.
- **Contenidos, Ruta, splash y login.** Nada que hacer.
- **`direccionesVisuales.ts`.** El catálogo ya describe las seis. No cambia salvo
  que D se re-produzca, que es otro trabajo (`Downloads\hero-d-esfuerzo\ESTADO.md`).

---

## 6. Coste

> **Corregido el 25-08 al colocar F.** Esta sección decía «cero archivos nuevos» y
> resultó falso para F. Ver §9.

Cero archivos nuevos. Las tres piezas ya están en `public/hero/` y sus pósters en
`public/fondos/`, y las tres pantallas montan con `preload="none"`, así que el
vídeo solo se pide en la pantalla que lo usa:

| Pieza | vídeo | póster |
|---|---:|---:|
| F Proyección | 98 KB | 10,7 KB |
| A Despiece | 368 KB | 24 KB |
| E Físico | 448 KB | 33 KB |

Las tres por debajo del techo de 900 KB por pieza.

**Se descarta el scrub para E**, aunque sería lo más fiel a «recorre las
inserciones una a una» (el fotograma siguiendo al campo enfocado). Exigiría una
secuencia WebP como la de Órbita —338 KB medidos— porque estas piezas van con
`-g 48` y el seek da el fotograma clave anterior. Queda anotado como posible v2;
en v1 la columna reproduce su loop mientras el formulario está abierto, y el loop
dura 6,0 s, que es más o menos lo que cuesta llenar cinco campos.

---

## 7. Tests

- **F.** Que el ancho revelado sea `actual / record` y que con `record = 0` no se
  divida por cero. Que con la racha rota no se monte `<video>`.
- **A.** Que el disco no se amplíe: la comprobación de escala que ya hace
  `fondos-de-tarjeta.test.ts`.
- **E.** Que la columna no exista con el formulario cerrado —no se paga el vídeo
  por abrir Bienestar— y que ningún campo caiga encima de ella.
- **Las tres.** Con movimiento reducido, póster fijo y ni un `<video>`. Es R5 y ya
  tiene precedente en `RolloDePelicula.test.tsx`.
- **Encaje de E.** Su `encaje` viaja con la pieza; si la columna lo ignora, vuelve
  la columna negra del 17,6%. Merece su propia comprobación.

---

## 8. Lo que quedaba abierto, y cómo se cerró

- ~~**Sin ver en un móvil real.**~~ **Cerrado el 25-08.** Las tres pantallas
  —Logros, Bienestar con el formulario abierto y Hoy— se capturaron a 390 pt con
  la receta del spec del 20-08. De ahí salieron los dos hallazgos de la §9 y la
  corrección de la §10.
- ~~**El disco de A es la decisión más discutible.**~~ **Cerrado el 25-08: se
  queda.** Bryan lo aprobó con la captura delante. Sigue siendo la única forma
  que la app no usa en ningún otro sitio, y eso es deliberado: la alternativa era
  la lámina rectangular de Contenidos, o sea repetir mecanismo, que es lo que
  este trabajo existe para no hacer. Si algún día se replantea, el motivo tiene
  que ser nuevo — no este, que ya se decidió mirándolo.
- ~~**La banda de tinta del 40% no está documentada en el catálogo.**~~
  **Cerrado el 25-08.** Subió a `direccionesVisuales.ts` con sus medidas, junto a
  la otra lección: que el umbral de 18 es un techo y no un suelo. Va como
  comentario y no como campo porque no lo consume nadie: es una propiedad del
  material, no un dato de la app.

**No queda nada abierto de este trabajo.** Lo que sigue pendiente es de fuera: la
pieza D se está rehaciendo (`Downloads\hero-d-esfuerzo\ESTADO.md`), y cuando
exista habrá que re-medirla contra la pregunta de la §9 —¿es más clara que lo que
la rodea?— antes de darla por buena en Contenidos.

---

## 9. Lo que cambió al colocar F (25-08, después de mirarlo)

Esta sección la escribe la pantalla, no el razonamiento. Al capturar Logros en un
móvil de 390 pt, la diferencia entre la celda descubierta y la tapada era de
**0,36 de luma**: invisible. Midiéndolo bien salieron dos errores encadenados.

**El primero es mío y está en la §2 de este mismo spec.** Escribí que F «admite
texto encima en cualquier punto sin tocarla» y de ahí saqué que era la pieza
ideal. El 18 es un **techo** para que el texto se lea; lo que faltaba escrito es
que una pieza que hay que VER necesita además un **suelo**. F no lo tenía.

**El segundo no es de la pieza, es de la cortina.** La calle de F está en **4,3**
de luminancia —**3,8** en el archivo de `main` sin levantar— y `--ink-900` en **8,9**: lo que se descubría salía *más oscuro* que
lo que lo tapaba. Medido en pantalla, el efecto estaba **invertido** —la parte
superior de la celda descubierta daba 0,18 contra 8,86 de la tapada, o sea −8,68—.
Ninguna curva lo arregla: para subir la calle por encima de 8,9 hay que levantar
tanto la pieza que su propia banda de tinta pasa de 25 y el texto deja de leerse.

Lo que se hizo, y por qué en ese orden:

1. **F se levantó**, porque estaba mal graduada y eso es un hecho medible aparte
   de dónde se coloque. Su ancla pre-grade da media **16,3** y el archivo
   publicado daba **4,49**: el grade la aplastó 3,6x. Se levanta con una **gamma
   pura** —el negro sigue en negro, el blanco en blanco, así que no puede
   reventar— calibrada una vez sobre 12 fotogramas, nunca por fotograma.

   El objetivo (8,0 en la ventana de la tira) no se eligió a ojo: es la última
   parada del barrido donde caben los dos límites, la banda de tinta de la propia
   pieza bajo el techo de 18 y el bloqueo del AV1 por debajo de 1,25x. Un paso
   más arriba, el bloqueo se pasa.

   **Rehecho el 25-08 sobre el archivo de `main`.** El #96 regraduó F mientras
   esto estaba en rama, así que el primer levantado se había hecho sobre un
   fotograma que ya no existe. Sobre el de `main` —media 5,6, p50 2,9— el barrido
   da **exactamente la misma frontera**: gamma **1,2504**, banda 15,9 y bloqueo
   1,22x en el objetivo 8,0; en 9,0 el bloqueo ya se pasa. `banco.py validar` da
   **PASA** con p50 **3,6** —más dentro del corredor que la propia F de `main`— y
   el archivo queda en **98 KB**.

   Que la frontera caiga en el mismo sitio con dos fotogramas distintos es la
   señal de que el criterio no estaba ajustado al archivo.

2. **La cortina bajó a negro puro**, `--ink-1000`, un token nuevo al pie de la
   escala ink. Lo que hay debajo de una pieza sin recorrer no es una superficie:
   es que ahí no hay luz.

Resultado medido en la misma captura: la diferencia pasa de **+0,36** a
**+15,37**, y se ve sin retocar la imagen. Con el archivo de `main` ya mezclado,
la banda de la pieza dentro de la ventana da **16,2** contra los 0,0 de la
cortina.

**Lo que esto deja pendiente para A y E:** comprobar la misma relación ANTES de
montarlas. La pregunta no es «¿se lee el texto encima?» sino «¿es la pieza más
clara que lo que la rodea?». A da 14,7 de media y va sobre pantalla clara, así que
el problema no se repite; E da 39,6 y menos todavía.

**Y una advertencia de método:** este fallo no lo habría encontrado ningún test.
Lo encontró capturar la pantalla y medir dos rectángulos.

---

## 10. Un bug que reporté y no existe (25-08)

Al capturar Logros y Bienestar dije que la app **desbordaba en horizontal a 390 pt**
—cabecera cortada, campos inalcanzables, la tira de rachas en 468 px dentro de 390—.
**Es falso, y el error es mío.**

Chrome headless en Windows impone un ancho mínimo de ventana: con
`--window-size=390` el viewport real fue **500 px**. Estuve capturando una maqueta
de 500 recortada a 390×3, así que todo *parecía* cortado sin estarlo. Una sonda
temporal en el layout lo dijo de una vez: `viewport 500`, `main 500,0`,
`scrollWidth 500` — **main no desborda**. Lo único que sobresale son los carruseles
horizontales, dentro de su `overflow-x-auto`, que es lo suyo.

Y es exactamente la trampa que el spec del 20-08 ya documentaba al final, con su
receta: **el iframe de 390 px dentro de una ventana mayor**. La abandoné al primer
intento porque la app se quedaba en «Cargando…» y volví al atajo. Con el marco
servido desde el propio vite —`public/__marco.html`, borrado al terminar, como
avisa aquella receta— la captura sale limpia y no hay nada cortado.

**La regla, para no repetirlo:** en esta máquina, una captura cuyo ancho no sea
exactamente `390 × factor` no es un móvil de 390 pt. Comprobarlo antes de creerse
lo que se ve.
