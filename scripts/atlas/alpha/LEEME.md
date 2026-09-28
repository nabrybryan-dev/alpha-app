# Músculos Alpha: la capa muscular mejorada en Blender

Sustituye a `public/piezas/landing/atlas-musculos-zanatomy.pieza` con la misma geometría de
origen (Z-Anatomy, CC BY-SA 4.0), el mismo alineamiento y las mismas 522 piezas con su nombre.
Lo que cambia son las piezas del hombro, del codo y de la rodilla, en los dos lados.

| Archivo | Triángulos | Vértices | .pieza | .br |
|---|---|---|---|---|
| `atlas-musculos-alpha.pieza` (escritorio) | 299 236 | 150 106 | 3,63 MB | 1,99 MB |
| `atlas-musculos-alpha-movil.pieza` (celular) | 133 683 | 67 242 | 1,65 MB | 0,91 MB |
| `atlas-musculos-zanatomy.pieza` (actual, referencia) | 260 660 | 131 571 | 3,18 MB | 1,93 MB |

Bytes exactos (28-sep, ronda 2): escritorio 3 634 388 / br 1 992 265; celular 1 646 512 / br 907 048
(brotli calidad 11, ventana 24).

Escritorio con esqueleto (89 362) y piel (6 710): **395 308 triángulos**, bajo el tope de 400 000.
Descarga de escritorio con esqueleto (0,64) y piel (0,05): **2,69 MB br**, bajo el tope de 3 MB.
El celular queda en 133,7 mil, un poco sobre los ~130 mil pedidos, por decisión de Bryan: la
máxima calidad visible. Ningún músculo se quita; todos se aligeran por igual (×0,43), y la
pieza que pierde más de 3 mm de su caja al aligerarse se rehace con más triángulos.

## Qué se mejoró (69 piezas por lado, espejo exacto en `.r`)

- Hombro: deltoides (3 partes), pectoral mayor (3), trapecio (3), dorsal ancho, manguito
  rotador, redondos, bíceps, tríceps, coracobraquial, braquial.
- Codo y antebrazo: braquiorradial, ancóneo, pronador redondo y cuadrado, supinador, flexores y
  extensores (radiales del carpo, cubitales del carpo, de los dedos, del meñique, palmar largo,
  flexor largo del pulgar, abductor largo del pulgar).
- Tronco junto al brazo (entran por estar a menos de 20 cm del codo; solo suavizado, sin masa
  salvo la que traía la receta): oblicuos externo e interno, transverso del abdomen, cuadrado
  lumbar, iliocostal lumbar, multífido lumbar, serrato posterior inferior e intertransversos
  lumbares (partes dorsal y ventral).
- Lista exacta de las 69 piezas: `cambiadas.txt`, al lado de este archivo.
- Rodilla (19): recto femoral, vastos lateral, medial e intermedio, bíceps femoral (cabezas larga
  y corta), semitendinoso, semimembranoso, sartorio, grácil, cintilla iliotibial, gastrocnemio
  (cabezas medial y lateral), sóleo, poplíteo, plantar, tibial anterior, extensor largo de los
  dedos y peroneo largo. Masa de 0,5 a 4,5 mm en el vientre; la cintilla solo se suaviza.
- Rodilla, arreglo v2 (ronda 2, solo el recto femoral): la masa baja suave hacia el tendón, así
  que ya no hay escalón de 3,2 mm ni mancha oscura sobre la rótula; y el tendón rotuliano se
  apartó de la tibia (cara exterior a ≥ 1,2 mm) para que el hueso no asome en rombo. Medido con
  rayos frontales sobre el tendón en esta pieza: la tibia asomaba en el `.l` 77 mm² (hasta
  1,5 mm) y ahora en 0. **Pendiente en el `.r`:** como el `.r` es el espejo del `.l` y la tibia
  derecha no es simétrica, allí la tibia aún asoma 29 mm² (hasta 0,5 mm) en escritorio y 22 mm²
  (hasta 0,45 mm) en celular (antes, 154 mm² y 1,6 mm). En Blender el `.r` sí está empujado
  contra su tibia (`esqueleto_pieza_287`), pero el exportador no usa esa geometría.
- Facetas quitadas (subdivisión + suavizado que conserva volumen), vientres musculares más
  llenos y algo de masa (hasta 4,5 mm en el centro del vientre, 0 en el tendón).
- El presupuesto se reparte entre todas las piezas mejoradas: al entrar la rodilla, el factor
  de crecimiento de los pares bajó de ×1,56 a ×1,36, así que el hombro y el codo llevan ~13 %
  menos triángulos que en la entrega anterior (misma geometría de Blender, aligerada algo más).

## Contrato

- Formato `.pieza v3` de `escribirPieza`; se leyó con el propio `leerPieza` sin errores:
  522 mallas con nombre en los dos archivos, ningún índice fuera de rango, vértices de tendón
  en blanco puro 26,54 % (escritorio) y 26,66 % (celular).
- Y arriba, metros, pies en y≈0: pieza = (x, z, −y) de Blender + (1,05e-5, −0,00199, 0,00906),
  ajustado contra la pieza Z-Anatomy con error < 1e-7 m. Las piezas sin tocar son idénticas.
- Una parte por músculo, con su nombre en el campo de nombre (el mismo orden que zanatomy).
- Tendón en el color del vértice con blanco puro (255, 255, 255); el músculo conserva el color
  de su pieza original.
- Sin UV ni texturas: el aspecto de fibras de los vídeos de revisión es del render de Blender y
  no viaja en el archivo; en la web lo da el shader de la landing.

## Cómo se regenera

`blender -b ALPHA_TRABAJO_hombro.blend --python exportar_musculos.py` (con `pieza.py` al lado y
`origen/atlas-musculos-zanatomy.pieza`); `vista_previa.py` renderiza una pieza para comparar:
sin opciones encuadra el hombro; con `--centro x,y,z` (Blender), `--dir x,y,z` y `--dist m`
cualquier zona. Rodilla izquierda, delante-lateral: `--centro 0.0942,0.0154,0.4504 --dir 1,-1,0.15`.
Los `.br` se hacen con Node: `zlib.brotliCompressSync` con `BROTLI_PARAM_QUALITY` 11 y
`BROTLI_PARAM_LGWIN` 24.
