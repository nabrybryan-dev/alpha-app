# API del sujeto anatómico para el laboratorio (21-oct-2026)

Todo sale de `src/domain/sujeto/index.ts` (`import { … } from '…/domain/sujeto'`). TypeScript puro: no importa React, `features/`,
el DOM, Node ni Supabase, y `frontera.test.ts` falla si alguien lo cambia. Versión del modelo: `VERSION_DEL_MODELO = 'sujeto-0.1.0'`
(se guarda con cada cifra; sube cuando cambia una tabla, una ecuación o un supuesto).

## 1. Marcos de referencia

**Marco del sujeto (todo el dominio):** plano **sagital**, 2D. `z` hacia donde mira el sujeto (adelante), `y` hacia arriba, metros.
El origen de `geometriaSagital` es el **tobillo** `(0, 0)`. No hay coordenada lateral.

**Marco del laboratorio:** +X a la izquierda del sujeto, +Y arriba, +Z anterior (hacia donde mira), metros.

| Sujeto | Laboratorio | Nota |
|---|---|---|
| `z` | `Z` | misma dirección y sentido |
| `y` | `Y` | misma dirección y sentido |
| (no existe) | `X` | el modelo es simétrico: lleva `X = 0`; el plano sagital del laboratorio es el plano `X = 0` del sujeto |
| origen = tobillo | traslada al tobillo del esqueleto del laboratorio | `p_lab = tobillo_lab + (0, y, z)` |

**Ángulos de segmento (`PoseSagital`):** radianes, desde la **vertical** (+Y), medidos sobre la dirección del extremo **distal al proximal**,
positivos hacia **+Z**. Es la rotación de mano derecha **alrededor de +X** que lleva +Y hacia +Z: `u = (z = sen θ, y = cos θ)`.
Tibia inclinada hacia delante en una sentadilla: `> 0`. Muslo de una sentadilla en paralelo (rodilla delante de la cadera, el muslo
va de la rodilla hacia atrás y arriba): `< 0` (≈ −1,45 rad). Tronco inclinado hacia delante: `> 0`.

**Ángulos articulares (Silder, `AngulosArticulares`):** radianes, **positivos** en flexión de cadera, flexión de rodilla y dorsiflexión;
de pie, todo 0. Se derivan de la pose: `cadera = tronco − muslo`, `rodilla = tibia − muslo`, `tobillo = tibia` (`angulosDeLaPose`).
Pie plano: la tibia inclinada hacia delante cuenta como dorsiflexión.

**Signo de un momento articular:** positivo = el que hacen los **músculos para sostener la carga**: extensor de cadera, extensor de
rodilla, flexor plantar de tobillo. Es una magnitud con el signo funcional de arriba, **no** un vector con eje: si el laboratorio
necesita un vector sobre el eje X de la articulación, la conversión es suya (y depende de su convención de lado). Todos los momentos son
el **total de las dos piernas** (la sentadilla es simétrica); para una pierna, divide entre 2.

## 2. El contrato de una cifra (`Cifra`)

Casi todo lo que sale con incertidumbre o con posibilidad de abstención sale como `Cifra`:
`{ id, valor: number | null, unidad, estado, fuente[], supuestos[], banda: {inf, sup, nivel} | null, version, motivo? }`.

- `estado`: `observado` · `calculado` · `estimado` (tabla poblacional o supuesto, lleva banda) · `simulado` · `no_afirmable` (valor `null`
  y `motivo`). **Un `null` nunca es un cero:** no lo pintes como 0. Hoy los momentos de la sentadilla son `estimado` (salen de la tabla de
  de Leva).
- `unidad`: `'m' 'kg' 's' 'N' 'N·m' 'rad' 'm/s' 'm/s²' 'rad/s' 'rad/s²' 'kg·m²' 'm²' '1'` (`'1'` = adimensional, 0,35 y no 35 %).
- `verificarCifras(cifras)` devuelve `[]` si todas pueden circular. `noAfirmable(id, unidad, motivo, version)` construye una abstención.

## 3. Funciones

### Segmentos de de Leva escalados a medidas reales
- `DE_LEVA[sexo]` (`'h' | 'm'`): `{ estaturaDeReferencia (m), segmentos: Record<Segmento, {masa, cm, largo}> }`. `masa` = fracción de la
  masa corporal (`'1'`); `cm` = fracción del largo **desde el extremo proximal**; `largo` en m para la estatura de referencia. Segmentos:
  `cabeza tronco brazo antebrazo mano muslo tibia pie`. `DE_LEVA_CERV` da cabeza y tronco con los extremos alternativos que usa la
  dinámica (cabeza vértex–cervical, tronco cervical–cadera). `SEGMENTOS_PARES` = los que van dos veces (brazo, antebrazo, mano, muslo, tibia, pie).
- `construirSujeto({ sexo, talla (m), masa (kg) }) → Sujeto | null`. Escala: `masaKg = fracción × masa`, `largoM = largo × talla /
  estaturaDeReferencia`. `null` (nunca un valor por defecto) si falta algo o está fuera de cordura (talla 0,9–2,5 m, masa 20–300 kg).
  `masaDeLosSegmentos(s)` = masa total de los segmentos (pares ×2).

### Dinámica inversa estática de la sentadilla con barra
- `geometriaSagital(sujeto, cargaKg, pose, cerv?) → Geometria`: articulaciones `tobillo`, `rodilla`, `cadera` `{z, y}` (m, origen en el
  tobillo) y las masas puntuales (`{nombre, kg, z, y}`) que pesan por encima de cada una. La barra y los brazos van en el punto
  `barraT` del tronco (fracción del largo desde el cervical).
- `momentosEstaticos(geometria) → { tobillo, rodilla, cadera }` en **N·m**, números sin contrato.
- `momentosDeSentadilla({ sexo, talla, masa, cargaKg, pose }) → { tobillo, rodilla, cadera, inercial }` (`Cifra`, N·m). El término inercial
  de esta función estática es **siempre `no_afirmable`**; para tenerlo, usar `momentosDeSentadillaEnElTiempo`. Falta cualquier dato → tres `no_afirmable`. Caso de referencia
  a mano: hombre 1,78 m, 82 kg, 100 kg, pose `{tibia 0,45; muslo −1,45; tronco 0,75; cabeza 0,2; barraT 0,1; pieZ 0,05}` → tobillo 151, rodilla 188,
  cadera 497 N·m.
- `bandasDeSentadilla(entrada, incertidumbre, { muestras?, semilla? })` → los tres momentos con `banda` p5–p95 (Monte Carlo con semilla,
  por defecto 2000 muestras). `Incertidumbre` = `{ talla (m), masa (kg), proporciones (relativa), angulo (rad), carga (kg) }`; la fija quien llama
  (de Leva no publica dispersión). `SIN_INCERTIDUMBRE` da ancho cero. El `nivel` de la banda dice si se ensanchó para incluir el valor central.

### Término inercial de la sentadilla (ángulos en el tiempo)
- `momentosDeSentadillaEnElTiempo({ sexo, talla, masa, cargaKg, instantes: [{ t (s), pose }], fuenteDeAngulos })` → `{ motivo, marcos[] }`; un marco por
  instante con `tobillo | rodilla | cadera`, cada uno con cuatro `Cifra` (N·m): `traslacional` (Σ m·[(z−z_J)·a_y − (y−y_J)·a_z]), `rotacional` (Σ I·α),
  `inercial` (la suma) y `total` (estático + inercial). Mismos signos que `momentosDeSentadilla` (positivo = lo hacen los músculos extensores).
- Aceleraciones por diferencias finitas de 3 puntos sobre los `t` dados: **el primer y el último cuadro, y todo cuadro con entrada inválida,
  son `no_afirmable`** (no se extrapola). Tiempos estrictamente crecientes, al menos 3 instantes.
- **`estimado` solo con `fuenteDeAngulos` declarada** (p. ej. `video:ik@dos-celulares`); en blanco → todo `no_afirmable`, y la fuente viaja en
  la `fuente` de cada cifra como `angulos:<texto>`. La escala métrica sale de la talla, del vídeo solo entran ángulos y tiempos.
- Caso a mano: aceleración cero reproduce 151 / 188 / 497 N·m; caída libre da 0; el tronco girando con la cadera fija coincide con la fórmula del
  péndulo (0,05 N·m). **La banda del `rotacional` y de lo que lo contiene recoge SOLO el rango de los radios de giro** (`inercia.ts`: Tabla 4 de de Leva
  leída del PDF por OCR, rango entre el radio «sagital» y el «transverso» porque no está fijado cuál es el eje de la flexión). El ruido de los ángulos NO está en la banda:
  la segunda derivada lo amplifica y hay que propagarlo con el ruido de la IK (Monte Carlo) antes de afirmar un valor con video real.
- Supuesto: tobillo fijo en el suelo (pie plano). Falso cuando el talón despega.

### Momento pasivo (Silder 2007, solo plano sagital, jóvenes sanos)
- `momentosPasivosDeLaPose(pose{tibia, muslo, tronco} | null, { muestras?, semilla? }) → { cadera, rodilla, tobillo }` (`Cifra`, N·m, **signo
  funcional de este dominio**, total de las dos piernas, con banda p5–p95 de la población ensayada). **`no_afirmable` fuera del dominio
  ensayado** (`dominioDeSilder`): cadera −15° a 100° con rodilla 0° a 135° (o cadera hasta 100° solo con rodilla ≤ 25° por encima de 85°),
  tobillo −20° a 20°. Una sentadilla profunda casi siempre cae fuera.
- `momentosDeSilder(parametros, angulos)`: las ecuaciones A.5–A.7 en bruto, **una pierna y signo del artículo** (positivo = flexor / dorsiflexor).
  `parametros` = `SILDER_MEDIA` (Tabla 4, media de 20 sujetos; `SILDER_SD` es la sd). Para el pasivo ya con signo, total y banda usa
  `momentosPasivosDeLaPose`.
- **β va por radián: es un supuesto derivado** (el artículo no dice la unidad), con prueba de orden de magnitud; sin confirmar con el PDF de la editorial.
- La banda es **más ancha que el propio valor** (dispersión entre sujetos de un modelo exponencial): no la dibujes como si fuera precisa.

### Proporciones de área (Ward 2009)
- `proporcionesDeAreaDeCadera({ muestras?, semilla? }) → { gluteoMayor, isquios, aductorMayor }` (`Cifra`, `'1'`, suman 1 en el valor central, con
  banda p5–p95 con la sd entre especímenes). `proporcionesCentrales()` = solo las fracciones de las medias.
- **Solo proporciones entre grupos, nunca cm²:** los datos son de cadáveres de 83 años. Isquios = cabeza larga del bíceps + semitendinoso +
  semimembranoso. El aductor mayor entra entero (su fracción está sobrestimada).

### Lo que no hay (a propósito)
- **Reparto del momento entre músculos: no existe** (`no_afirmable`): faltan brazos de palanca internos abiertos. No se exporta.
- `capaDeMomentos` y `repartoDeSentadilla` (qué se dibuja y qué se dice en el salón de la app) tampoco se exportan.
- Nada de 3D, nada lateral, nada que no sea la sentadilla con barra. La dinámica con aceleración existe solo como serie temporal (arriba), no como valor suelto.

## 4. Procedencia
Cada constante tiene su fila en `cerebro-alpha/herramientas/encoder-camara/PROCEDENCIAS.tsv` (de Leva 1996, Silder 2007, Ward 2009) y se
coteja contra las tablas de los artículos (`npm run procedencias-sujeto`; `scripts/cotejar-silder-ward-con-html.py`). Los ids de
`Cifra.fuente` son los de esa columna.
