# Integración cinemática — diseño

**2026-08-20**

Cinco piezas de vídeo pre-renderizado entran en cuatro pantallas. Hasta hoy
estaban puestas como bandas 16:9 encima del título de cada una: se veían, pero se
leían como material pegado. Esto las convierte en parte del diseño.

**La regla que lo gobierna todo: ninguna de las cuatro pantallas resuelve igual.**
Una plantilla repetida cuatro veces es reflejo de categoría, no diseño.

---

## Qué se ha construido

| Pantalla | Mecanismo | Estado |
|---|---|---|
| **Entrenar** · la cantera | La pieza es el FONDO fijo; el scroll conduce el fotograma | **Hecho** |
| **Progreso** · la curva revela el cuerpo | La pieza SUSTITUYE el relleno del área del gráfico | **Hecho** |
| **Contenidos** · la plancha montada | La pieza montada como lámina impresa en tarjeta clara | **Hecho** |
| **Manual de marca** · el rollo | Las cinco en columna; solo se abre y suena la centrada | **Hecho** |

Piezas nuevas de código:

- `src/components/ui/LienzoCinematico.tsx` — la pieza como fondo con scrub por scroll
- `src/features/marca/RolloDePelicula.tsx` — el rollo
- `src/lib/inclinacionAlPuntero.ts` — la inclinación 3D, extraída de `FichaPanini`
- `src/lib/pausaFueraDePantalla.ts` — un solo vídeo a la vez
- `public/hero/orbita/` — 36 fotogramas WebP, **338 KB**

Se retira `BandaDireccion`: ya no la usa nadie. Es exactamente el injerto que esto
sustituye.

---

## Las decisiones que no conviene deshacer

### El scrub va por secuencia de fotogramas, no por el vídeo

El seek preciso sobre estas piezas no existe: están codificadas con `-g 48`, para
reproducción lineal. Saltar a un instante da el fotograma clave anterior y el
scrub se ve a saltos. Reencodear con GOP denso subiría el peso sin dar control
exacto.

Medido en Órbita: **36 WebP a 1170 px pesan 338 KB**, menos que el propio vídeo
(576 KB) y muy por debajo del techo de 900 KB. Comprime bien porque es una escena
oscura y limpia; **una pieza con humo, como Esfuerzo, no dará este número**. Si se
hace el scrub de otra, hay que medirlo antes de darlo por bueno.

WebGL queda descartado y no conviene reabrirlo: no hay modelos 3D del producto,
solo vídeo, y un motor 3D añade cientos de KB a una PWA de uso diario sin comprar
nada que el material ya no tenga.

### El contenido de Entrenar es una lámina opaca, y eso es la regla dura hecha estructura

La primera versión ponía la pieza fija detrás y el contenido encima, sin más. Al
hacer scroll, el titular «NIVEL 03 · RENDIMIENTO» —que va suelto, no dentro de una
tarjeta— quedaba **escrito sobre el atleta**.

No se arregló con un velo, que está prohibido y es justo lo que hacía
`.tarjeta-foto::after`. Se arregló con estructura: el contenido es una superficie
de tinta que sube y la tapa. El degradado de 40 px es el CANTO de esa lámina; por
debajo de él ya no hay pieza, hay tinta. Así el texto no puede caer sobre la pieza
aunque alguien añada un titular suelto mañana.

### En Progreso la pieza no acompaña al gráfico: ES el gráfico

Se sustituye el relleno del área por la pieza, recortada con un `clipPath` que usa
**la misma cadena de path** que dibujaba el degradado. Cuando el dato sube aparece
más cuerpo; cuando baja, se retira.

No se tocó nada más del gráfico: la geometría (300×96, PAD 6), la normalización al
rango, `.dibujar-linea` con su `pathLength={1}`, `.area-aparece`, el círculo del
último punto y el toggle Peso/Fuerza siguen igual.

### La inclinación 3D se extrae, no se duplica

`FichaPanini` tenía la inclinación al puntero escrita dentro y en ningún sitio
más. Al necesitarla en dos superficies nuevas, copiarla habría creado un segundo
lenguaje parecido al primero sin serlo. Está en `useInclinacionAlPuntero` y la
consumen los tres: la ficha (12°), la bandeja del microciclo (6°) y el fotograma
del rollo (7°). Los grados bajan donde la superficie es de lectura y no una carta
que se manosea.

De paso queda cubierta con tests: la ficha nunca los tuvo.

---

## Dos cosas donde el encargo no coincidía con el repo

**Los emoji de Contenidos ya no existían.** El encargo pedía sustituir «el cuadro
de 44 px que hoy lleva un emoji (🎬 🖼 📄)» por una miniatura de la pieza. Ese
emoji lo quitó `6c0146c`, y el cuadro mide 40. No se cambia, y está anotado en
`FilaContenido.tsx`: el icono **dice** si es vídeo o lectura, y repetir el mismo
plano fila tras fila sería la rejilla de tarjetas idénticas que el propio encargo
prohíbe.

**El fotograma 14 no es «la lectura más clara».** El encargo fija el 14 de 36 para
el estado con movimiento reducido, describiéndolo como el más legible. Medido
sobre Órbita da 11,05 de luminancia media: **puesto 24 de 36**. El más claro es el
4, con 22,15 — el doble de luz—, porque en el 14 la cámara ya pasó por detrás y el
atleta es una silueta. Se respeta el número pedido; cambiarlo es tocar
`FOTOGRAMA_QUIETO` y nada más.

---

## Los seis criterios duros, y dónde se cumple cada uno

| | Dónde |
|---|---|
| **R1** geometría, nunca >1,05x | Fotogramas a 1170 desde 1280 = 0,91x; la escala del paralaje llega a 0,97x del original |
| **R2** texto nunca sobre >18 de luminancia | Por construcción: ningún texto toca ninguna pieza en ninguna de las cuatro |
| **R3** póster y vídeo, misma transformación | En Entrenar es el mismo lienzo; en las otras tres es el mismo `FondoLoop` |
| **R4** techo de 900 KB | 338 KB la secuencia; los vídeos ya estaban por debajo |
| **R5** movimiento reducido diseñado | Congela en el 14, apaga el paralaje, la composición no cambia |
| **R6** rendimiento en scroll | Solo `transform`; scroll dentro de `requestAnimationFrame`; `IntersectionObserver` pausa lo que sale de pantalla |

---

## El fallo que encontró la auditoría (2026-08-21)

**La pieza de Entrenar volvía a ser una banda 16:9, por un signo.** El encaje
`cover` del lienzo estaba escrito a mano con la condición invertida. En la ventana
del móvil de referencia —390×352— la pieza se pintaba a **390×219**, con 66 px de
negro arriba y otros 66 abajo. Sobre `bg-ink-900` eso no se lee como un fallo: se
lee como la banda que este trabajo existe para quitar. Cover de verdad da 626×352,
recortada 118 px por lado.

Nadie lo cazaba y no se ve desarrollando, así que el arreglo no fue cambiar el
signo. `encajeCover` sale a `src/lib/encajeCover.ts` como función pura con siete
tests, y `escalaCover` se comparte con el criterio que ya usaba
`fondos-de-tarjeta`, para que las piezas se midan con la misma regla que las fotos
y no con una propia más blanda.

## Lo que se cerró

- **La secuencia de fotogramas ya está vigilada.** `secuencia-cinematica.test.ts`:
  los 36 con el nombre exacto, `FOTOGRAMA_QUIETO` dentro de rango, todos del mismo
  tamaño, el 16:9 conservado, R1 con el paralaje en su tope y R4 con la secuencia
  entera —338 KB medidos contra 900—. Probado escondiendo el fotograma 22.
- **El rollo tiene test.** `RolloDePelicula.test.tsx` cubre R6 —al entrar una en la
  ventana, las otras cuatro se pausan— y R5 —con movimiento reducido no se monta
  ni un `<video>`—. Probado comentando la pausa del componente.

## Lo que sigue faltando

- **Nadie ha comparado esto con las comps.** La referencia visual que el encargo
  daba como fuente de verdad —`"Entrenar - Integracion cinematica.dc.html"`— no
  existe en el equipo, y sigue sin existir. Se implementó desde la especificación
  escrita.
- **Sin ver en un móvil real.** Las capturas son Chrome de escritorio a 390 px. Es
  justo el punto ciego que produjo el fallo de arriba, y el único de esta lista que
  no se puede cerrar desde el código.
- **`LienzoCinematico` no tiene test de componente.** Lo tienen ahora su aritmética
  (`encajeCover`) y su material (`secuencia-cinematica`), que es donde estaban los
  dos fallos posibles. Falta cubrir que con movimiento reducido no se pidan los
  otros 35 fotogramas.
- **`--z-superpuesto` y `--z-tooltip` se declaran sin consumidor.** No hay todavía
  toasts ni tooltips con capa propia; el único aviso que existe es de las recetas,
  que es zona cerrada. Anotado como DECISIÓN PENDIENTE en `tokens.css`.


---

## Cómo mirar esto (2026-08-21)

Nadie había visto esta pantalla. El fallo del encaje y el relleno negro salieron
midiendo, no mirando, y los dos se veían de un vistazo. La receta, porque volver
a deducirla cuesta media hora:

```
npx vite --mode demo --port 5199 --strictPort
```

**En Windows, `--window-size=390` da `innerWidth=504`**: Chrome headless impone un
ancho mínimo de ventana, así que una captura directa sale de una maqueta de 504 px
recortada a 390 y todo *parece* desbordarse. No se desborda. La única forma fiable
es meter la app en un iframe de 390 px dentro de una página mayor y recortar
después:

```html
<style>html,body{margin:0}iframe{display:block;width:390px;height:844px;border:0}</style>
<iframe src="/entrenar"></iframe>
```

Se captura con `--window-size=900,1000 --force-device-scale-factor=3
--virtual-time-budget=15000` y se recorta a `1170x2532` con ffmpeg. El perfil
tiene que ser un `--user-data-dir` nuevo cada vez, o Chrome se engancha a la
instancia abierta y no captura nada.

La página del iframe **no debe vivir en `public/`** más allá del rato de trabajo:
se desplegaría.
