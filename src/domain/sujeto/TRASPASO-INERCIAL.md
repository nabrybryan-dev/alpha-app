# Traspaso: término inercial de la sentadilla (rama `salon/inercial`, 22-oct-2026)

Desde `salon/sujeto-sentadilla` (acbbc3c7). Código: `inercial.ts`, `inercia.ts` (+ `dinamica.ts`: se extrajo `fuentesDeLeva`, sin cambio de comportamiento) y `index.ts`.
Uso y contrato: `API-DEL-SUJETO-PARA-EL-LABORATORIO.md`, sección «Término inercial de la sentadilla». Esta rama queda **congelada** para la revisión ciega.

## Qué calcula
`momentosDeSentadillaEnElTiempo({ sexo, talla, masa, cargaKg, instantes: [{ t, pose }], fuenteDeAngulos })`. Por cuadro y articulación: `traslacional` Σ m·[(z−z_J)·a_y − (y−y_J)·a_z],
`rotacional` Σ I·α, `inercial` (suma) y `total` (estático + inercial); mismos signos que `momentosDeSentadilla`. Aceleraciones por diferencias finitas de 3 puntos sobre los `t`.
`estimado` solo con `fuenteDeAngulos` declarada; primer y último cuadro, y cualquier entrada inválida: `no_afirmable`.

## Casos con respuesta conocida (`inercial.test.ts`, 23 pruebas)
| Caso | Respuesta | Resultado |
|---|---|---|
| Aceleración cero, hombre 1,78 m, 82 kg, 100 kg, pose del documento de la API | inercial 0; total 151 / 188 / 497 N·m | inercial < 1e-9; total 151,03 / 188,14 / 497,43 → redondea a 151 / 188 / 497 |
| Caída libre (a_y = −g, α = 0) | 0 en cualquier posición | < 1e-9 |
| Masa de 2 kg a 0,5 m, sin aceleración | 2·g·0,5 | exacto a 1e-12 |
| Masa de 3 kg a 0,4 m con a_y = 5 m/s² | 3·0,4·5 | exacto a 1e-12 |
| Derivada segunda en rejilla no uniforme | 8 (parábola) | a 1e-9 |
| Tronco girando con la cadera fija, θ = θ0 + 0,3·sen(2πt), cuadros 60 / 125 / 190 / 380 | fórmula del péndulo escrita aparte en la prueba (traslacional de cadera, rodilla y tobillo) | coincide a 0,05 N·m; banda rotacional = I·α con los dos radios |
| Solo la tibia se mueve | rotacional de cadera y rodilla = 0, de tobillo ≠ 0 | cumple |

Suite del dominio completa: `npx vitest run src/domain` → 207 archivos, 4018 pruebas OK. `eslint src/domain/sujeto/` limpio; `tsc` sin errores en `src/domain/sujeto` (los demás
errores de `tsc` son de `three`/`@react-three/*`, que esta copia de `node_modules` no trae; no son de esta rama). 5 mutaciones sembradas (signo de α, signo de la rodilla, g + a_y,
orden de la derivada, radio mínimo), las 5 muertas.

## Cruce con el banco virtual (`lab/banco`, `calculo/banco/fisica.py`, solo lectura)
`scripts/inercial-para-el-cruce.mts` (vite-node) vuelca las cifras de la app para tres movimientos de ángulos conocidos (senos: dt 0,002 s, 501 cuadros) y
`scripts/cruce-inercial-con-banco.py` las compara con `fisica.momentos` del banco recibiendo ω y α **analíticas**, con el radio sagital y el transverso. Las dos implementaciones son
independientes (el banco está en Python con coeficientes por segmento; no se copió código). Resultado, 4 cuadros por caso, 3 articulaciones:

| Caso | Diferencia máxima entre los extremos de la banda de la app y el banco |
|---|---|
| A quieto | 0,0000 N·m |
| B solo el tronco (±0,3 rad a 1 Hz; inercial hasta ±750 N·m) | 0,0141 N·m |
| C sentadilla completa (tibia, muslo, tronco y cabeza en fase distinta, 0,5 Hz) | 0,0037 N·m |

Los dos extremos de la banda de la app son los valores del banco con el radio sagital y con el transverso. Única diferencia en el total: la gravedad (la app 9,80665, el banco 9,81):
cadera estática 497,429 (app) frente a 497,599 (banco), 0,17 N·m, solo en la parte estática. Reproducible: `py -I scripts/cruce-inercial-con-banco.py cruce-app.json <ruta de lab-banco>`, sale con código 0.

## Radios de giro: lo que cambió durante el trabajo
Empezaron como «fuente secundaria sin cotejar» (Visual3D). El banco había leído la Tabla 4 del PDF
(`cerebro-alpha/herramientas/encoder-camara/articulos/DeLeva_1996_J_Biomech_segment_parameters.pdf`); lo volví a leer con pypdf: las cifras coinciden con las de las tres fuentes y completan la cabeza
(h 0,303 / 0,315, m 0,271 / 0,295) y la tibia de la mujer (0,267 / 0,263). Detalle del emparejamiento de columnas del OCR en el comentario de `inercia.ts`.

## Lo que NO se comprobó
- Qué eje de la tabla («sagital» o «transverso») es el de la flexión: no se fijó. La banda del rotacional abarca los dos; el rotacional es pequeño frente al traslacional salvo con giros bruscos del tronco.
- La lectura del OCR contra la **imagen** de la página del PDF (solo el texto extraído, cruzado con el banco y con Visual3D).
- Las filas de `PROCEDENCIAS.tsv` y de `registro.ts` para los radios: **pendientes** (el libro está en otro repositorio). Hasta entonces las cifras los citan como `inercia.radio.<sexo>.<segmento>.deleva96_tabla4_ocr`, que no existe en el registro.
- El ruido de los ángulos: no está en la banda; la segunda derivada lo amplifica. Con la serie de la IK hay que propagarlo (Monte Carlo) antes de afirmar un valor con vídeo real.
- Ningún movimiento real: todo es sintético. Supone tobillo fijo (pie plano); el talón que despega lo viola.
- El tronco y los brazos como masas rígidas y los brazos puntuales en la barra (igual que la parte estática).
