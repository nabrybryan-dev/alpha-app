# Colocar A, E y F — pasos

**2026-08-25** · ejecuta `docs/specs/2026-08-25-piezas-sin-colocar-diseno.md`

El qué y el porqué están en el spec. Esto es el cómo: los números de CSS ya
resueltos, el orden de trabajo y qué se comprueba en cada paso.

**Todos los recortes de aquí están medidos, no estimados.** Se reproducen con
`Downloads\hero-d-esfuerzo\medir-piezas.py` desde la raíz del repo.

---

## Antes de empezar

Rama `diseno/piezas-sin-colocar`, ya creada sobre `main`. Nada de esto va a `main`
sin PR: Vercel publica con el push.

Se trabaja **de menor a mayor riesgo**: F primero (pantalla oscura, pieza que no
necesita recorte fino), luego E (pantalla clara, recorte fino), y A al final
(pantalla clara, forma nueva, y la decisión más discutible del spec).

Cada paso se cierra con `npm run verify` en verde antes de pasar al siguiente.

---

## La cuenta que se repite en los tres

Las tres piezas son de **1280×720** y ninguna se pinta a tamaño completo. Para
enseñar una ventana concreta de la pieza dentro de una caja, hay dos caminos y se
usa uno u otro según la ventana:

**Camino 1 — `object-cover` + `object-position`.** Vale cuando la ventana que
quieres tiene la misma altura que la pieza (recorte solo horizontal) o el mismo
ancho (recorte solo vertical). Es el caso de **F** y de **E**. Una línea de CSS y
sin números mágicos.

**Camino 2 — el medio sobredimensionado en porcentajes del contenedor.** Vale
cuando la ventana es más pequeña que la pieza en las dos dimensiones, o sea cuando
hay que acercarse. Es el caso de **A**. Con la ventana de lado `L` centrada en
`(cx, cy)` sobre una pieza de `W×H`:

```
ancho = 100 · W/L %      alto = 100 · H/L %
left  = 50 − 100·cx/L %  top  = 50 − 100·cy/L %
```

Los porcentajes van referidos al contenedor, así que el encaje sobrevive a que la
caja cambie de tamaño. Lo que **no** sobrevive es pasarse de tamaño: la ventana
tiene `L` píxeles de fuente, así que el contenedor no puede superar `L / DPR`
puntos sin ampliar. Ese tope se escribe al lado del número, siempre.

---

## Paso 1 · F Proyección → la tira de rachas de Logros

**Archivo:** `src/features/logros/LogrosPage.tsx`, la `<section>` de `:62-75`.

### Qué cambia

Las tres tarjetas dejan de ser tres cristales sueltos sobre el fondo de la
pantalla. Pasan a ser **tres ventanas a la misma calle**: una sola pieza F detrás
de la tira, continua de lado a lado, y cada tarjeta descubre la parte que le toca.

### La revelación

Cada tarjeta descubre la pieza **de izquierda a derecha** hasta la fracción
`actual / record` de su propia racha. Lo que no está descubierto es `--ink-900`
**opaco**, no un velo: el velo está prohibido en este lenguaje y además aquí no
haría falta, porque F ya admite texto encima (media 5,0 contra umbral 18).

`Racha` es `{ actual, record }` (`src/domain/gamification.ts:1-3`) y `record` es
siempre el máximo histórico, así que la fracción nunca pasa de 1. Los dos bordes:

| caso | fracción | qué se ve |
|---|---|---|
| `record === 0` — nunca hubo un solo registro | 0 (guarda explícita: **no dividir**) | tinta, y **no se monta `<video>`** |
| primer día — `actual = record = 1` | 1 | la calle entera |
| racha rota — `actual = 0`, `record > 0` | 0 | tinta |

Que la racha rota apague la pieza es la pantalla diciendo lo que ya dice con
palabras cuatro tarjetas más abajo (`rachaRota`, `LogrosPage.tsx:30`, con su
mensaje del récord). No es un hueco: es el mismo mensaje en otro registro.

### La geometría

La tira mide **3,50:1** y la pieza 16:9, o sea que el recorte es solo vertical.
Camino 1, y sin `object-position` explícita porque el centro es justo lo que se
quiere:

```
holgura vertical: 720 − 366 = 354 px  →  el centro cae en y=177
```

Medido en las tres anclas posibles, y por eso se ancla al centro:

| ancla | media | p95 | p99,5 |
|---|---:|---:|---:|
| arriba | 1,2 | 3,0 | 36,4 |
| **centro** | **5,0** | **9,2** | **82,2** |
| abajo | 8,9 | 9,2 | 59,5 |

Arriba es cielo y abajo es la banda de tinta de la propia pieza: en las dos la
pieza no se ve. El centro es donde están el corredor y la farola.

### Montaje

- `FondoLoop` con `poster={direccion('F').poster}`, `video={direccion('F').video}`,
  `preload="none"`, `prioridad="auto"`, `anchura={1280} altura={720}`.
- La tira va envuelta en `usePausaFueraDePantalla`, como hace `ContenidosPage`.
  El `ref` va en un `<div>` envoltorio y **no** en la `Card`: `Card` no reenvía
  `ref` (ya está anotado en `ContenidosPage.tsx:53`).
- **Un solo `<video>` para las tres tarjetas**, no tres. Son tres ventanas a la
  misma calle, y tres vídeos idénticos decodificando a la vez es exactamente lo
  que `usePausaFueraDePantalla` existe para evitar.

### Lo que no se toca

El héroe de la pantalla. `logros-peldanos.jpg` son los peldaños del rack, elegidos
por la metáfora y medidos: **24,0** de luminancia en la zona del texto con la foto
anterior, **10,2** con esta, umbral 18 (`LogrosPage.tsx:36-42`). F entra **debajo**
de la racha, no arriba.

### Tests

`src/features/logros/TiraDeRachas.test.tsx`:

1. `record = 0` no lanza y no descubre nada. Es la división por cero.
2. `actual = 3, record = 6` descubre la mitad. Se lee del estilo, no de la captura.
3. Racha rota (`actual = 0, record > 0`) no descubre nada.
4. Con movimiento reducido no se monta ni un `<video>`. Precedente:
   `RolloDePelicula.test.tsx`.
5. Hay **un** `<video>` en la tira, no tres.

---

## Paso 2 · E Físico → la columna de «Mis medidas» en Bienestar

**Archivo:** `src/features/bienestar/MedidasCard.tsx`, el bloque `{abierto && …}`
de `:150` en adelante.

### Qué cambia

Mientras el formulario está abierto, a la izquierda de los campos aparece una
**columna vertical 1:3** con la pieza. La cámara sube por el cuerpo; la lista de
perímetros baja. Van juntas.

Con el formulario cerrado **la columna no existe** — ni el elemento ni la petición
del vídeo. Abrir Bienestar no debe pagar 448 KB.

### La geometría, y la trampa del `encaje`

La columna es 1:3 y la pieza 16:9, o sea recorte solo horizontal. Camino 1.

**El `encaje` de E NO se aplica aquí, y aplicarlo sería un error.** En el catálogo,
E lleva `encaje: 'origin-right scale-[1.213]'` para sacar de cuadro la columna
negra que ocupa su 17,6% izquierdo. Pero un recorte 1:3 solo enseña 240 px de los
1280, y la ventana que interesa empieza en **x=632**, muy a la derecha de esa
columna negra. El `encaje` encima desplazaría la ventana fuera del cuerpo.

```
ventana: x = 632 … 872  (centro en x=752, el 58,8% del ancho)
holgura horizontal: 1280 − 240 = 1040 px
object-position = 632 / 1040 = 60,8%   →   object-[61%_50%]
```

Comprobado: la columna negra (`x < 225`) queda fuera de cuadro. Medido en la
ventana: media **69,0**, p95 155,9, p99,5 177,4 — que es exactamente el ancla
«centro» del spec, por el mismo camino y sin transformación ninguna.

**69,0 es alto, y por eso la columna no lleva texto encima.** Es marco; los campos
van fuera. En pantalla clara ese valor juega a favor: una columna a 17,4 —el ancla
izquierda— sería un agujero negro dentro de una tarjeta blanca.

### Escala

A **64×192 CSS** con DPR 3 el destino son 192×576 px y la fuente da 240×720:
**0,80x**. Nunca se amplía. El tope antes de ampliar es una columna de **80 CSS px**
de ancho.

Si el formulario crece —el campo de peso aparece o desaparece según `verPeso`— la
columna crece con él y la proporción cambia. Se fija el ancho y se deja que el alto
lo mande el contenido (`h-full`): con `object-cover` el recorte se reajusta solo y
la única consecuencia es que se ve más o menos cuerpo, nunca una deformación.

### Montaje

- `FondoLoop` con la pieza E, `preload="none"`, dentro de un contenedor
  `w-16 overflow-hidden rounded-[10px]`, hermano de la lista de campos en un
  `flex gap-3`.
- Envuelto en `usePausaFueraDePantalla` igual que los otros dos.
- El `<p>` de instrucciones y los botones **no** entran en el `flex`: quedan
  debajo, a todo el ancho. La columna acompaña a los campos, no al pie.

### Tests

En `src/features/bienestar/MedidasCard.test.tsx` (existe ya, o se crea):

1. Con el formulario cerrado no hay ni `<img>` ni `<video>` de la pieza.
2. Al pulsar «Registrar» aparecen los dos.
3. El `object-position` declarado es el 61%, no el que sale por defecto. Este test
   es el que impide que alguien «limpie» la línea y devuelva la ventana al centro
   geométrico, donde no está el cuerpo.
4. **La columna no lleva el `encaje` de E.** Es la trampa de arriba, y sin test
   vuelve sola el día que alguien lea `direccionesVisuales.ts` y lo aplique «que
   falta».
5. Movimiento reducido: póster y ni un `<video>`.

---

## Paso 3 · A Despiece → el disco de «Tu bloque actual» en Hoy

**Archivo:** `src/features/hoy/BloqueActual.tsx`, la cabecera de `:48-51`.

Va el último a propósito: es el que el spec marca como la decisión más discutible,
y si se cae no arrastra a los otros dos.

### Qué cambia

Junto al título «Tu bloque actual» aparece un **disco** de 56 px con la pieza
dentro. La barra se desarma y cada disco ocupa su sitio; el bloque actual es la
prescripción del coach repartida en filas que ocupan la suya.

No lleva texto encima. El texto son las filas, al lado.

### La geometría

Este es el único de los tres que necesita **acercarse**, así que camino 2. La
ventana buena de A es un cuadrado de **216 px de lado centrado en (621, 216)**:

- **x=621 es el 49% del ancho**, que es donde está el centro del brillo de la
  pieza. No es el centro geométrico, y centrar ahí en vez de en 640 es la
  diferencia entre un disco con luz dentro y un disco apagado.
- **y=216 es el 30% del alto.** La ventana ocupa y=108…324, así que no toca la
  banda de tinta de la pieza, que empieza en y=426. En un recorte circular esa
  tinta no aportaría nada.

Con `L=216`, `cx=621`, `cy=216` sobre 1280×720:

```
ancho 592,6%   alto 333,3%   left −237,5%   top −50,0%
```

Medido: el disco inscrito da media **37,9** y la ventana cuadrada que el CSS
recorta, **33,9**. Oscuro sobre `#f7f7f5`: se lee como objeto, que es lo que se
busca en una pantalla clara.

### El tope de tamaño, que hay que escribir al lado

A 56 CSS px con DPR 3 son 168 px de destino contra 216 de fuente: **0,78x**. El
tope antes de ampliar es un disco de **72 CSS px**. Ese número va en un comentario
pegado a la clase, porque subir el disco a 80 px es un cambio de una cifra que
nadie relacionaría con estirar una imagen.

### Montaje

```
<span class="relative block h-14 w-14 shrink-0 overflow-hidden rounded-full">
  <FondoLoop … className="absolute h-[333.3%] w-[592.6%] max-w-none
                          left-[-237.5%] top-[-50%]" />
</span>
```

`max-w-none` no es opcional: el reset de Tailwind pone `max-width: 100%` a
`img`, y sin quitarlo el 592,6% se recorta a 100% y el encaje se va al garete
**sin dar error** — la imagen simplemente aparece entera y pequeña.

`FondoLoop` aplica la misma `className` a la imagen y al vídeo, así que los dos
llevan el mismo encaje y no hay salto al relevarse. Es la razón por la que existe
esa prop.

### Tests

En `src/features/hoy/BloqueActual.test.tsx`:

1. El disco no se amplía: 56 × 3 ≤ 216. Aritmética, igual que `escalaCover` en
   `fondos-de-tarjeta.test.ts`.
2. Los cuatro porcentajes del encaje son los cuatro de arriba. Un test de números
   literales, feo a propósito: son el resultado de una medición y cambiarlos a ojo
   es justo lo que no debe pasar.
3. `BloqueActual` sigue devolviendo `null` sin perfil (`:45`). El disco no puede
   resucitar una tarjeta que la pantalla decidió no pintar.
4. Movimiento reducido: póster y ni un `<video>`.

---

## Paso 4 · Cerrar

1. **`npm run verify` en verde.** El criterio de `CLAUDE.md` §2: no baja el número
   de tests y no aparece ni un rojo. Contar, no copiar.
2. **Los 5 avisos del linter siguen siendo 5.** Es un delta, no un presupuesto.
3. **Mirar la app de verdad**, con la receta del final de
   `2026-08-20-integracion-cinematica-diseno.md`: `npx vite --mode demo --port 5199
   --strictPort`, la pantalla dentro de un iframe de 390 px, captura a
   `--force-device-scale-factor=3` y recorte a 1170×2532. En Windows
   `--window-size=390` da `innerWidth=504` y todo *parece* desbordarse sin
   desbordarse. Las tres pantallas: Logros, Bienestar con el formulario abierto, y
   Hoy.
4. **La página del iframe no se queda en `public/`**: se desplegaría.
5. Subir la banda de tinta del 40% a `direccionesVisuales.ts` como propiedad
   medida de las piezas. Hoy solo vive en el spec, y es lo que decide dónde puede
   ir el texto.
6. PR contra `main`. No hay push directo.

---

## Lo que este plan asume y podría estar mal

- **Que el disco de A es la forma correcta.** Es lo único aquí que inventa un
  vocabulario nuevo. Si al verlo no funciona, la alternativa ya descartada era la
  lámina rectangular de Contenidos, y descartarla otra vez deja a A sin sitio.
- **Que apagar la pieza con la racha rota se lee como intención y no como fallo.**
  Solo le pasa a quien rompió una racha, nunca a quien empieza —día 1 es
  `actual = record = 1`, o sea la calle entera—, pero eso hay que verlo en
  pantalla, no razonarlo aquí.
- **Que 69,0 de luminancia en la columna de E no canta** dentro de una tarjeta
  blanca. Es el valor más alto de los tres montajes y el único que no tiene
  precedente medido en la app.
