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

## Lo que falta

- **Nadie ha comparado esto con las comps.** La referencia visual que el encargo
  daba como fuente de verdad —`"Entrenar - Integracion cinematica.dc.html"`— no
  existe en el equipo. Se implementó desde la especificación escrita.
- **Sin ver en un móvil real.** Las capturas son Chrome de escritorio a 390 px.
- **`LienzoCinematico` y `RolloDePelicula` no tienen test.** Sí lo tiene el hook
  de inclinación. Hay cosas concretas que cubrir: que con movimiento reducido no
  se pidan los otros 35 fotogramas, y que el rollo reproduzca uno solo.
- **`fondos-de-tarjeta.test.ts` no vigila las piezas nuevas**: solo mira las
  tarjetas con `--foto`. Hoy R1 se cumple porque se calculó a mano, no porque algo
  lo compruebe.
- **`--z-superpuesto` y `--z-tooltip` se declaran sin consumidor.** No hay todavía
  toasts ni tooltips con capa propia; el único aviso que existe es de las recetas,
  que es zona cerrada. Anotado en `tokens.css`.
