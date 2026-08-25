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
| A Despiece | 14,7 | 9,2 | 169,2 | 21,9 | 9,2 | **40,8%** |
| B Órbita | 21,5 | 9,2 | 155,2 | 35,2 | 9,2 | **40,7%** |
| C Ascenso | 24,5 | 15,0 | 154,2 | 38,0 | 9,1 | **40,0%** |
| D Esfuerzo | 84,7 | 78,1 | 254,0 | 101,7 | 62,1 | — |
| E Físico | 32,7 | 13,2 | 171,5 | 42,2 | 25,6 | — |
| F Proyección | **5,0** | **2,0** | **42,0** | 0,7 | 9,2 | **40,0%** |

**E se mide tras su `encaje`.** `origin-right scale-[1.213]` equivale a recortar el
17,6% izquierdo, que es la columna negra que documenta `direccionesVisuales.ts`.
Ya recortada: media **39,6**, p50 14,1, y por tercios 38,2 · **59,8** · 20,9. El
cuerpo iluminado está en el centro.

**F es la pieza más oscura del catálogo por un margen enorme**: su p99,5 (42,0) no
llega ni al p50 de D. Es la única que admite texto encima en cualquier punto sin
tocarla.

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
| arriba | 1,2 | 3,0 | 36,4 |
| **centro** | **5,0** | **9,2** | **82,2** |
| abajo | 8,9 | 9,2 | 59,5 |

Arriba y abajo la pieza no se ve —son cielo y tinta—. El centro es donde está el
corredor y la farola, y aun así da 5,0 de media contra un umbral de 18: las cifras
rojas de la racha se leen sin velo.

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

Medido: el centro del brillo de A cae en **x=621, el 49% del ancho**, así que el
disco se centra ahí y no en el centro geométrico. Con r=108 px sobre el fotograma
de 720 de alto, el disco da media **37,9**. Es oscuro sobre `#f7f7f5`: se lee como
objeto, que es lo que se busca.

El 40,8% inferior de A es tinta plana, y en un recorte circular no aporta nada. El
disco se ancla en el 30% de altura, dentro de la imagen viva (media 18,4 en el 60%
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
| izquierda | 17,4 | 72,4 | 126,6 |
| **centro** | **69,0** | 155,9 | 177,4 |
| derecha | 20,2 | 63,7 | 217,2 |

Se ancla al **centro**: es donde está el cuerpo iluminado. 69,0 es alto para poner
texto encima y por eso **no lleva ninguno** — la columna es marco, los campos van
fuera. En pantalla clara ese valor juega a favor: una columna a 17,4 sería un
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

Cero archivos nuevos. Las tres piezas ya están en `public/hero/` y sus pósters en
`public/fondos/`, y las tres pantallas montan con `preload="none"`, así que el
vídeo solo se pide en la pantalla que lo usa:

| Pieza | vídeo | póster |
|---|---:|---:|
| F Proyección | 133 KB | 8,4 KB |
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

## 8. Lo que queda abierto

- **Sin ver en un móvil real**, igual que el trabajo del 20-08. La receta de
  captura está al final de aquel spec y hay que usarla.
- **El disco de A es la decisión más discutible** de las tres: es la única que
  inventa una forma que la app no usa en ningún otro sitio. La alternativa era
  montarla como lámina rectangular, y se descartó por ser el mecanismo de
  Contenidos otra vez.
- **La banda de tinta del 40%** no está documentada en `direccionesVisuales.ts`
  pese a ser una propiedad de las piezas que condiciona dónde puede ir el texto.
  Debería subir al catálogo, medida, en vez de vivir solo aquí.
