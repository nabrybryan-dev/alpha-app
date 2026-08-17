# Hero 3D de Alpha — ruta Adobe, paso a paso

Cuatro partes. Ninguna necesita saber 3D.

Cada número de aquí está decidido: no tienes que elegir nada. Si algo no encaja,
dímelo y lo recalculo.

---

## PARTE 1 · El fotograma (Nano Banana Pro)

Ve a **https://aistudio.google.com/models/gemini-3-pro-image**

Adjunta como referencia:
- `Cerebro Alpha\app\public\fondos\banco-alpha.jpg` — el equipo y la paleta
- El moodboard **GRIND** que ya generaste — solo para el grading

### Por qué este prompt no es el de Seedance

Seedance recibía una foto y la animaba entera. Aquí la vas a **despiezar en
Photoshop**, así que la imagen tiene que nacer preparada para eso: cada elemento
recortable, con negro limpio detrás y sin sombras que caigan de un objeto sobre
otro. Si los discos se solapan, recortarlos es una tarde perdida.

### Prompt

```
A single cinematic product still, vertical 9:16 aspect ratio, shot as a phone
splash screen background plate.

SUBJECT
An Olympic barbell floating horizontally in a black void, loaded with four bumper
plates: two matte black and two deep red. Knurled steel shaft with a brushed satin
finish, machined collars, black powder-coated sleeves with a subtle raised ALPHA
ATHLETICS relief on the plate faces. Below and behind it, a matte black flat bench
in textured vinyl with visible stitching, angled slightly away from camera.

SEPARATION — the most important requirement
Every plate is clearly separated from every other plate along the bar, with visible
black gaps between them. No plate overlaps another. No plate overlaps the bench.
The bench does not touch the barbell. Each object reads as a distinct silhouette
against clean black negative space, as if photographed for a cutout.

COMPOSITION
The barbell sits in the upper-middle third of the frame. The bottom 40% of the
frame is pure near-black empty space with nothing legible in it: no bench, no
floor detail, no highlights, no gradient banding. That band is reserved for
interface text composited later. Nothing bright may enter it.

LIGHTING
One hard rectangular key light from camera left at 40 degrees elevation,
warm-neutral 5200K, raking across the knurling so the texture reads. A deep red
rim light (#FF1E1E) along the top-right edges only, low intensity. No cast shadows
falling from one object onto another. No shadow on the floor.

COLOR
Background #08090A. Steel between #C9CED6 and #5F646B. Red #FF1E1E confined to two
plates and the single rim — under 5% of the frame. Shadows carry a slightly
desaturated olive cast.

GRADE
Cinematic, high contrast, crushed blacks, fine film grain, sharp throughout. Clean
studio product photography, not a gym snapshot.

NEGATIVE
No people. No text. No watermarks. No UI. No borders. No logos beyond the ALPHA
ATHLETICS relief. No cast shadows between objects. Nothing in the lower 40%.
```

### Cómo elegir la que sirve

Genera varias y quédate con la que cumpla las cuatro:

1. La franja de abajo está **vacía y negra**
2. Los discos **no se tocan** entre sí
3. El rojo se ve **escaso**, no domina
4. El eje moleteado está **nítido**

Mándamelas y te digo cuál pasa. Es el filtro más barato: equivocarse aquí cuesta
todo el trabajo de después.

Descárgala en 2K o 4K y guárdala como `frame.png` en esta carpeta.

---

## PARTE 2 · Separar en capas (Photoshop)

Abre `frame.png`.

1. **Herramienta de selección de objetos** (atajo `W`). Pasa el cursor por encima
   de cada disco: Photoshop lo detecta solo. Clic para seleccionar.
2. Con la selección activa: `Ctrl+J`. Crea una capa con solo ese objeto.
3. Repite para: cada disco (4), la barra, el banco.
4. Renombra las capas: `disco-1`, `disco-2`, `disco-3`, `disco-4`, `barra`, `banco`.
5. **La capa de fondo**: selecciona todo lo que recortaste, y usa **Relleno
   generativo** con el prompt `empty black studio void` y sin nada más. Así el
   fondo queda completo por detrás, sin agujeros. Nómbrala `fondo`.

Guarda como `hero.psd`.

> Si la selección de objetos falla en algún disco, no pelees: usa el lazo a mano.
> Los bordes no tienen que ser perfectos — el velo del Splash y la viñeta se comen
> cualquier borde sucio.

---

## PARTE 3 · El movimiento (After Effects)

### Crear la composición

`Composición > Nueva composición`

| Ajuste | Valor |
|---|---|
| Anchura × Altura | **1080 × 1920** |
| Frecuencia de fotogramas | **24** |
| Duración | **0:00:08:00** |
| Color de fondo | **Negro** |

### Importar

`Archivo > Importar > Archivo` → elige `hero.psd` → en el diálogo, **Importar
como: Composición - Mantener tamaños de capa**. Así entran las capas sueltas.

Arrastra esa composición dentro de la tuya y haz doble clic para entrar.

### Poner las capas en profundidad

En la columna de interruptores, activa el **cubo 3D** de cada capa. Luego abre
`Posición` (atajo `P`) en cada una y pon **solo el tercer número**, que es la Z:

| Capa | Z |
|---|---|
| `fondo` | **-900** |
| `banco` | **-250** |
| `disco-1` | **-60** |
| `disco-2` | **-20** |
| `barra` | **0** |
| `disco-3` | **20** |
| `disco-4` | **60** |
| Capa de ajuste (luego) | **400** |

> Z negativa = más lejos. El fondo a -900 hace que casi no se mueva mientras los
> discos sí: eso es lo que el ojo lee como profundidad.

Al alejar el fondo se verá más pequeño. Escálalo hasta que vuelva a cubrir el
encuadre (`S` para escala, sube hasta ~180%).

### La cámara

`Capa > Nueva > Cámara`. Elige **Cámara de dos nodos**, preajuste **50 mm**.

Con la cámara seleccionada, pulsa `P` para ver su Posición.

Pon tres keyframes en el campo de Posición, tocando **solo el primer número (X)**:

| Tiempo | X | Cómo |
|---|---|---|
| `0:00` | **-70** | Clic en el cronómetro ⏱ junto a Posición |
| `4:00` | **+70** | Cambia el valor: el keyframe se crea solo |
| `8:00` | **-70** | Cambia el valor |

Selecciona los tres keyframes y pulsa **F9** (Easy Ease).

### El detalle que hace que el bucle sea perfecto

El keyframe de `8:00` cae **fuera** de la composición de 8 segundos (que va de
`0:00` a `7:23`). Eso es correcto y es justo lo que quieres: el último fotograma
*renderizado* es el `7:23`, que está a punto de llegar a `-70` pero no llega. Al
saltar al `0:00` el movimiento continúa sin repetir ningún fotograma.

Si en cambio pusieras el keyframe en `7:23`, ese fotograma sería idéntico al
primero y verías un micro-tirón cada ocho segundos.

Con Easy Ease en los tres, la cámara además llega frenada a los extremos, así que
el empalme no da ningún tirón de velocidad.

### Comprobar el bucle antes de exportar

Barra espaciadora para previsualizar en bucle. Míralo **cinco vueltas seguidas
sin apartar la vista**. Si no distingues dónde empieza, está bien.

---

## PARTE 4 · Exportar (Media Encoder)

`Composición > Añadir a la cola de Adobe Media Encoder`

### El MP4 — este es el que importa

| Ajuste | Valor |
|---|---|
| Formato | **H.264** |
| Codificación de vídeo | **VBR, 2 pasadas** |
| Velocidad de bits objetivo | **0,75 Mbps** |
| Velocidad de bits máxima | **1,1 Mbps** |
| Perfil | **Alto** |
| Audio | **desmarcado** |

Guarda como `despiece.mp4`.

> De dónde sale 0,75: el presupuesto es 900 KB en 8 segundos, o sea 900 kbps.
> Bajando a 750 kbps queda margen para el contenedor y para que el pico no se
> pase. Si el archivo sale por encima de 900 KB, baja a 0,6 y reexporta.

### El WebM — opcional, ahorra un 25%

Duplica la entrada en la cola y cambia solo:

| Ajuste | Valor |
|---|---|
| Formato | **WebM** |
| Códec de vídeo | **VP9** |
| Velocidad de bits objetivo | **0,6 Mbps** |

Guarda como `despiece.webm`.

### El póster

Vuelve a After Effects, lleva el cursor de tiempo al fotograma **0**, y
`Composición > Guardar fotograma como > Archivo`. En la cola, formato **JPEG**,
calidad **80**.

Guarda como `despiece.jpg`. Tiene que quedar por debajo de **120 KB**.

> Este archivo es el que ve quien tiene mala conexión, quien pidió menos
> movimiento y quien abre la app mientras carga el vídeo. Míralo solo, sin
> movimiento: si por sí mismo no dice "Alpha Athletics", la dirección está mal
> elegida y conviene saberlo ahora.

---

## Y ya

Deja los tres archivos en esta carpeta y avísame. Yo hago el resto:

- Copiarlos a `public/hero/`
- Cambiar la constante `poster` en `src/features/auth/heroDespiece.ts`
- Correr `npm run verify`
- Arrancar la app y comprobar el bucle y que el texto se lee encima

---

## Si te atascas

Dime en qué parte y con qué te has quedado. La más probable es la 2 (recortar):
si la selección de objetos no separa bien los discos, hay una salida — generar la
imagen otra vez pidiendo **más separación entre discos** — que es más rápida que
pelearse con el lazo.
