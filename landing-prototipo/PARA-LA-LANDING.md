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
   (`detalle-${capa}${sufijoDetalle}.bin`). **Regla:** el sombreado va vértice a vértice con su malla;
   si cambias una pieza, vuelve a hornear con `hornear_detalle_blender.py -- MUSCULOS ESQUELETO SUFIJO`.
2. Resolución adaptativa (`ajustarDensidad`, llamada al final de `cuadro`): si el promedio baja de
   50 fps, la densidad de píxeles baja ×0,85 hasta 0,6; si pasa de 58 durante 3 s, sube. Expone
   `window.__rendimiento = { fps, densidad, lienzo }`. La meta viewport ya era `width=device-width, initial-scale=1`.

## Medido (29-sep, `pruebas/medir-fps.mjs`, Chrome headless con la gráfica real, D3D11)

| Caso | fps | Carga |
|---|---|---|
| Alpha escritorio 1440×900 | 59 | 3,6 s |
| Z-Anatomy escritorio 1440×900 | 59 | 1,6 s |
| Alpha celular 390×844, densidad 3 | 58 | 2,6 s |
| Alpha con un cuadro caro simulado (37 fps) | la densidad baja sola a 0,6 (1440×900 → 864×540) | — |

Gráfica de la prueba: AMD Radeon 780M integrada. En el Iris Xe de Bryan la landing midió 28-40 fps a
1440×900 con cualquiera de los dos juegos; con la densidad adaptativa debería quedar cerca de 50-60.

## Si hay que integrarlo en tu v11 (rama landing/sujeto-3d-prototipo, commit f13f76e)

Esa rama no está en GitHub, así que la trae quien la tenga. Lo mínimo: copiar `piezas/` (los
`atlas-*-alpha*.b64.txt` y `detalle-*-alpha*.bin`) y los dos cambios de `index.html` descritos arriba.
Con eso tu v11 muestra exactamente el mismo sujeto. Queda pendiente la prueba en un celular real
(artefacto de Bryan).
