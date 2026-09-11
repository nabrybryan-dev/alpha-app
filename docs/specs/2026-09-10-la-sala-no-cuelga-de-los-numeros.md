# La sala no cuelga de los números de la serie

**2026-09-10** · salón de `/entrenar` · rama `salon/kit-verificado`

## Qué pasaba

Un día de cardio abría el salón **sin gimnasio**: el sujeto corriendo sobre negro, con el
encuadre de estudiar un patrón en vez del del salón. No era un fallo del cardio: era que
`construirSala` exigía los datos de la serie —series, repeticiones, RIR— y la habitación
entera colgaba de ellos (`haySala = conEscenario && !!datos`). Un bloque de cardio no los
tiene, así que se quedaba sin sala, sin suelo, sin trípode y sin `encuadreDelSalon`.

**Una sala es una sala haya o no serie.** Lo que depende de los números es el marcador.

## Qué dice el marcador un día de cardio

Decisión de Bryan, 10-sep. El marcador del muro son tres cifras de siete segmentos **sin
rótulo**, como en un pabellón, y siempre responden a las mismas tres preguntas. Solo cambia
la ropa:

| | cuántas veces | cuánto cada vez | con cuánto esfuerzo |
|---|---|---|---|
| hierro | series | repeticiones | RIR (o `FALLO`) |
| cardio | tramos | minutos | RPE o zona |

Encaja en los huecos tal cual estaban —dos dígitos, dos dígitos y uno—: los tramos y los
minutos caben en dos, y el RPE y la zona son de una cifra por definición. No hubo que
ensanchar el panel ni mover nada.

**Y la tercera casilla se apaga cuando el esfuerzo no está escrito.** Un cero ahí diría
«RIR 0», que en esta casa es otra cosa, y un dato que el coach no escribió no se inventa. Es
la misma regla por la que el fallo se escribe con una `F` en vez de con un número.

El tiempo NO va al marcador: el muro ya tiene su reloj en su propio hueco. El marcador dice
lo **prescrito**; el reloj dice lo que **va**.

## Lo medido: los otros seis días no se movieron

Se capturaron los siete días del tambor antes y después, en el mismo Chrome, con los mismos
gestos y con movimiento reducido, y se restaron píxel a píxel.

| día | píxeles distintos | control (mismo código contra sí mismo) |
|---|---|---|
| lunes · leg A | 807 | 89 |
| martes · upper A | 491 | 704 |
| miércoles · leg B | 347 | 347 |
| jueves · upper B | 644 | 730 |
| viernes · full C | **0** | 0 |
| **sábado · metabólico** | **324.610 (98,6 %)** | **0** |
| domingo · descanso | 698 | 930 |

**El control es la mitad que importa.** Comparar el mismo código consigo mismo da entre 0 y
930 px en los días de hierro —es el ruido del arnés: antialiasing del sujeto y del carrusel,
la misma familia que ya está documentada en `partir-el-visor.mjs`—, así que los cientos de
píxeles de la columna izquierda están **por debajo** del ruido y no dicen nada. Y el sábado
da **0 en el control**: su 98,6 % es entero del cambio, y es el único día que se movió.

## Dónde vive

- `escena/sala.ts` — `CifrasDelMuro` (las tres preguntas, ya traducidas), `cifrasDeLaSerie()`
  y `construirSala(m, cifras | undefined, …)`: los marcadores solo si hay cifras.
- `visor/VisorPatron.tsx` — la prop `conSala` dice quién quiere habitación. Va aparte de las
  cifras a propósito: estudiar un patrón no quiere sala, y por eso no basta `conEscenario`.
- `salon/estaciones/estacionesDelCardio.ts` — `cifrasDelCardio()`.

## Lo que sigue abierto

Un día de cardio no tiene rótulo en el muro: el nombre en trazo y el «SALA 06» cuelgan del
`contenido` de pared, que se construye a partir de un ejercicio. El tablón tampoco se monta,
así que **no hay palabras que se contradigan con las cifras** — simplemente falta el nombre.
// DECISIÓN PENDIENTE: si el muro debe decir «CARRERA» un día de cardio, sale del bloque.
