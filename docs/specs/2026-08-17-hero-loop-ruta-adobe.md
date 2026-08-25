# Hero del Splash — ruta Photoshop + After Effects

**Sin generar nada nuevo.** Partimos de `banco-alpha.jpg`, que es la imagen que te
gusta, y la llevamos a vertical conservando su atmósfera.

> **Nota del 2026-08-22.** La constante que hay que tocar al final de esta ruta
> ya no vive en `heroDespiece.ts` —ese archivo nunca llegó a `main`— sino en
> `src/features/auth/fondoHero.ts`. El resto del procedimiento sigue vigente.


Por qué cambió el plan: el prompt anterior pedía *"floating in a black void, no gym
clutter, no shadows, as if photographed for a cutout"*. Eso mataba a propósito el
ambiente, la luz roja del fondo y las sombras — todo lo que hace buena a la
referencia — a cambio de poder recortar las piezas. Mal cambio: el velo del Splash
tapa el 60% de la pantalla, así que el despiece fino no se aprecia y la atmósfera
sí.

---

## PARTE 1 · Subir la resolución (Photoshop)

El original mide **512 × 279 px**. Es diminuto: hay que multiplicarlo por tres
antes de tocar nada.

1. Abre `Cerebro Alpha\app\public\fondos\banco-alpha.jpg`
2. `Imagen > Tamaño de imagen`
3. Marca **Remuestrear** y elige **Conservar detalles 2.0** en el desplegable
4. Cambia las unidades a **Porcentaje** y escribe **300**
5. Sube **Reducir ruido** hasta ~40 si la ves con grano
6. Aceptar

Queda en **1536 × 837**.

> **Mejor aún, si te apetece:** `Archivo > Abrir como > Camera Raw`, y una vez
> dentro, clic derecho sobre la imagen → **Mejorar → Superresolución**. Usa IA en
> vez de interpolación y el resultado es bastante más limpio. Si te lía, el paso
> de arriba vale.

Guarda como `hero.psd`.

---

## PARTE 2 · Estirarla a vertical

### Ampliar el lienzo

1. `Imagen > Tamaño de lienzo`
2. Anchura **1536**, Altura **2732** (es 9:16, la proporción del móvil)
3. En el cuadro de anclaje, pulsa la casilla **de arriba en el centro** ↑

Eso deja la imagen pegada arriba y **1895 px de hueco vacío debajo**.

4. Ahora baja la imagen un poco: `Ctrl+T`, y arrástrala hasta que la barra quede
   más o menos a **un tercio desde arriba**. Enter.

Te queda hueco arriba (poco) y hueco abajo (mucho). Son dos problemas distintos.

### El hueco de arriba — Relleno Generativo

1. Herramienta **Marco rectangular** (`M`)
2. Selecciona la franja vacía de arriba, **metiéndote unos 100 px dentro de la
   imagen**. Ese solape es lo que le permite continuar la escena en vez de
   inventarse otra.
3. En la barra que aparece abajo, pulsa **Relleno Generativo**
4. Escribe: `dark gym ceiling with dim red light, deep shadow`
5. **Generar**. Salen tres opciones: elige la que menos llame la atención.

### El hueco de abajo — degradado, NO generativo

Aquí **no uses Relleno Generativo**. Si le pides que invente suelo, te lo va a
llenar de detalle justo donde tiene que ir el texto de "Alpha Athletics".

1. `Capa > Nueva capa`
2. Herramienta **Degradado** (`G`)
3. Color frontal: pon el hex **`08090A`**
4. Elige el degradado **De frente a transparente**, tipo **Lineal**
5. Arrastra desde **abajo del todo** hasta **justo por debajo del banco**,
   manteniendo `Shift` para que salga recto

El suelo se disuelve en negro y te queda la franja limpia. Si no cubre bastante,
duplica la capa (`Ctrl+J`).

### Cerrar

1. `Imagen > Tamaño de imagen` → Anchura **1080** (la altura se pone sola en 1920)
2. `Archivo > Exportar > Exportar como` → **JPG**, calidad **80**
3. Guárdalo como `frame.jpg` en esta carpeta

### Cómo saber si está bien

Tapa con la mano el **40% de abajo** de la pantalla. Lo que queda visible tiene que
ser: la barra, el banco y el ambiente. Y lo que tapaste tiene que ser negro casi
liso. Si hay algo llamativo ahí debajo, alarga más el degradado.

---

## PARTE 3 · El movimiento (After Effects)

Deriva de cámara. Sin despiece: la imagen entera se mueve muy despacio.

### La composición

`Composición > Nueva composición`

| Ajuste | Valor |
|---|---|
| Anchura × Altura | **1080 × 1920** |
| Fotogramas por segundo | **24** |
| Duración | **0:00:08:00** |
| Color de fondo | **Negro** |

### Meter la imagen

Arrastra `frame.jpg` a la línea de tiempo.

Pulsa `S` (Escala) y ponla al **118%**. Tiene que sobrar imagen por los bordes: es
de donde sale el margen para moverse sin que asome el vacío.

### El movimiento

Pulsa `P` (Posición). Vas a tocar **solo el primer número**, que es la horizontal.

| Tiempo | Posición X | Cómo |
|---|---|---|
| `0:00` | **480** | Pulsa el cronómetro ⏱ que hay junto a "Posición" |
| `4:00` | **600** | Cambia el número: el punto se crea solo |
| `8:00` | **480** | Cambia el número |

Selecciona los tres puntos y pulsa **F9**.

> El de `8:00` cae **fuera** de la composición, y es a propósito. Es lo del vídeo
> que te pasé: el último fotograma que se graba se queda a un pasito del principio,
> y ese pasito lo da el salto del bucle. Si lo pusieras en `7:23` verías un tirón
> cada ocho segundos.

### Un poco de vida (opcional, 1 minuto)

Pulsa `S` y haz lo mismo con la Escala: **118 → 122 → 118** en los mismos tres
tiempos, con F9. El zoom lentísimo le da respiración sin marear.

### Comprobarlo

Barra espaciadora. Míralo **cinco vueltas seguidas sin apartar la vista**. Si no
distingues dónde empieza, está.

---

## PARTE 4 · Exportar

`Composición > Añadir a la cola de Adobe Media Encoder`

### El MP4

| Ajuste | Valor |
|---|---|
| Formato | **H.264** |
| Codificación | **VBR, 2 pasadas** |
| Velocidad de bits objetivo | **0,75 Mbps** |
| Velocidad de bits máxima | **1,1 Mbps** |
| Audio | **desmarcado** |

Nómbralo `despiece.mp4`. Tiene que quedar **por debajo de 900 KB**; si se pasa,
baja a 0,6 y reexporta.

### El póster

En After Effects, lleva el cursor al fotograma **0** y
`Composición > Guardar fotograma como > Archivo`. Formato **JPEG**, calidad **80**.

Nómbralo `despiece.jpg`. Máximo **120 KB**.

---

## Y ya

Deja `despiece.mp4` y `despiece.jpg` en esta carpeta y avísame. Yo hago el resto:
copiarlos a `public/hero/`, cambiar la constante en `heroDespiece.ts`, correr los
tests y comprobar en el navegador que el bucle no da salto y que el texto se lee.

## Si te atascas

Dime en qué parte exacta. La más delicada es el Relleno Generativo de arriba: si te
inventa algo raro, prueba a seleccionar una franja más estrecha y con más solape
sobre la imagen original.
