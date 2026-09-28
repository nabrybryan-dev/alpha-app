# Músculos Alpha: la capa muscular mejorada en Blender

Sustituye a `public/piezas/landing/atlas-musculos-zanatomy.pieza` con la misma geometría de
origen (Z-Anatomy, CC BY-SA 4.0), el mismo alineamiento y las mismas 522 piezas con su nombre.
Lo que cambia son las piezas del hombro y del codo, en los dos lados.

| Archivo | Triángulos | Vértices | .pieza | .br |
|---|---|---|---|---|
| `atlas-musculos-alpha.pieza` (escritorio) | 299 276 | 150 231 | 3,64 MB | 2,05 MB |
| `atlas-musculos-alpha-movil.pieza` (celular) | 134 327 | 67 666 | 1,66 MB | 0,94 MB |
| `atlas-musculos-zanatomy.pieza` (actual, referencia) | 260 660 | 131 571 | 3,18 MB | 1,93 MB |

Escritorio con esqueleto (89 362) y piel (6 710): **395 348 triángulos**, bajo el tope de 400 000.
Descarga de escritorio con esqueleto (0,64) y piel (0,05): **2,74 MB br**, bajo el tope de 3 MB.
El celular queda en 134 mil, un poco sobre los ~130 mil pedidos, por decisión de Bryan: la
máxima calidad visible. Ningún músculo se quita; todos se aligeran por igual (×0,43), y la
pieza que pierde más de 3 mm de su caja al aligerarse se rehace con más triángulos.

## Qué se mejoró (50 piezas por lado, espejo exacto en `.r`)

- Hombro: deltoides (3 partes), pectoral mayor (3), trapecio (3), dorsal ancho, manguito
  rotador, redondos, bíceps, tríceps, coracobraquial, braquial.
- Codo y antebrazo: braquiorradial, ancóneo, pronador redondo, flexores y extensores superficiales.
- Facetas quitadas (subdivisión + suavizado que conserva volumen), vientres musculares más
  llenos y algo de masa (2–4,5 mm en el centro del vientre, 0 en el tendón).

## Contrato

- Formato `.pieza v3` de `escribirPieza`; se leyó con el propio `leerPieza` sin errores.
- Y arriba, metros, pies en y≈0: pieza = (x, z, −y) de Blender + (1,05e-5, −0,00199, 0,00906),
  ajustado contra la pieza Z-Anatomy con error < 1e-7 m. Las piezas sin tocar son idénticas.
- Una parte por músculo, con su nombre en el campo de nombre (el mismo orden que zanatomy).
- Tendón en el color del vértice con blanco puro (255, 255, 255); el músculo conserva el color
  de su pieza original.
- Sin UV ni texturas: el aspecto de fibras de los vídeos de revisión es del render de Blender y
  no viaja en el archivo; en la web lo da el shader de la landing.

## Cómo se regenera

`blender -b ALPHA_TRABAJO_hombro.blend --python exportar_musculos.py` (con `pieza.py` al lado y
`origen/atlas-musculos-zanatomy.pieza`); `vista_previa.py` renderiza una pieza para comparar.
