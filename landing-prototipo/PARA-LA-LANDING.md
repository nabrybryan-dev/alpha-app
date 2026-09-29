# Para la sesión de la landing: el sujeto Alpha, listo para usar

Esta carpeta es la landing (`sujeto-alpha-cine-20260927`) con el sujeto Alpha **ya integrado y
medido**. Es la copia versionada. Para verla: `python servidor.py` y abrir http://127.0.0.1:8769/.

## Qué hay que conservar (el trabajo de estos días)

Músculos de hombro, codo y rodilla sin facetas, con vientres llenos y masa, tendones en marfil y el
lado derecho en espejo exacto; esqueleto suave (296 huesos) sin cruces en las articulaciones. **No
sustituir estas piezas por las de Z-Anatomy ni aligerarlas más**: es lo que Bryan aprobó.

| Pantalla | Músculos | Esqueleto | Sombreado horneado |
|---|---|---|---|
| Escritorio (≥ 760 px) | `piezas/atlas-musculos-alpha` (299 236 tri) | `atlas-esqueleto-alpha` (171 113) | `detalle-*-alpha.bin` |
| Celular (< 760 px) | `atlas-musculos-alpha-movil-200k` (197 396) | `atlas-esqueleto-alpha-movil` (90 317) | `detalle-*-alpha-movil.bin` |

`#zanatomy` en el enlace carga el sujeto anterior, para comparar.

## Qué cambió en `index.html` (solo dos sitios)

1. `cargar()`: elige el juego de piezas según el ancho y carga el sombreado que le corresponde
   (`detalle-${capa}${sufijoDetalle}.bin`), en el mismo `Promise.all` que las mallas. **Regla:** el
   sombreado va vértice a vértice con su malla; si cambias una pieza, vuelve a hornear con
   `hornear_detalle_blender.py -- MUSCULOS ESQUELETO SUFIJO`. Si falta o no cuadra, se ve sin él
   (aviso en consola), no se rompe la página.
2. Resolución adaptativa (`ajustarDensidad`, llamada al final de `cuadro`): con menos de 56 fps en
   una ventana de 1 s la densidad de píxeles baja ×0,85 hasta 0,6; con más de 58,5 durante 3 s
   seguidos sube, sin volver a la densidad que ya falló. No mide la carga (espera 1,5 s tras armar el
   sujeto), descarta pausas de más de 150 ms y la ventana que sigue a cada cambio, y si una bajada no
   sube los fps un 10 % vuelve atrás y se bloquea hasta un cambio de ancho o de visibilidad: así un
   rAF topado (bajo consumo del iPhone y ahorro de Chrome a 30 fps, pantallas de 50 Hz) no hunde la
   resolución. Expone `window.__rendimiento = { fps, densidad, bloqueada, lienzo }`. La meta viewport ya era `width=device-width, initial-scale=1`.

## Medido (29-sep, `pruebas/medir-fps.mjs`, Chrome headless con la gráfica real, D3D11)

| Caso | fps | Carga |
|---|---|---|
| Alpha escritorio 1440×900 | 59 | 3,6 s |
| Z-Anatomy escritorio 1440×900 | 59 | 1,6 s |
| Alpha celular 390×844, densidad 3 | 58 | 2,6 s |
| Alpha con un cuadro caro simulado (37 fps) | la densidad baja sola a 0,6 (1440×900 → 864×540) | — |

Gráfica de la prueba: AMD Radeon 780M integrada. **Ojo con la última fila:** ese cuadro caro es de
CPU, así que bajar a 0,6 no subía los fps; con el arreglo de `ajustarDensidad` eso ya no pasa.

Medido después en el Iris Xe de Bryan (29-sep, rama `landing/sujeto-alpha-densidad`, densidad@fps):

| Caso | Antes | Después |
|---|---|---|
| 1440×900 dpr 1 | cae a 0,72 en la entrada y tarda ~20 s en volver a 1,0 | 1,0 @ 60 desde el primer segundo |
| 1440×900 dpr 1,5 | se queda en 1,44 @ 55 con tirones | se asienta en 1,36 @ 58-60 |
| 1920×1080 dpr 2 (gráfica al límite) | — | baja 2,0 → ~1,0 y llega a 60 |
| rAF a 30, dpr 1,5 | cae a 0,6 (864×540) @ 30 | vuelve a 1,5 y se bloquea @ 30 |
| rAF a 50 Hz, dpr 1 | cae a 0,6 @ 50 | 1,0 @ 50 |
| Celular 390×844 dpr 3, rAF a 30 | cae a 0,6 | 2,0 (780×1688) @ 30 |

Antes, en el mismo Iris Xe y sin estos arreglos, 1440×900 ya iba a 60 fps a densidad 1,0 una vez
recuperada. En el Iris Xe de Bryan la landing midió 28-40 fps a
1440×900 con cualquiera de los dos juegos; con la densidad adaptativa debería quedar cerca de 50-60.

## Si hay que integrarlo en tu v11 (rama landing/sujeto-3d-prototipo, commit f13f76e)

Esa rama no está en GitHub, así que la trae quien la tenga. Lo mínimo: copiar `piezas/` (los
`atlas-*-alpha*.b64.txt` y `detalle-*-alpha*.bin`) y los dos cambios de `index.html` descritos arriba.
Con eso tu v11 muestra exactamente el mismo sujeto. Queda pendiente la prueba en un celular real
(artefacto de Bryan).
