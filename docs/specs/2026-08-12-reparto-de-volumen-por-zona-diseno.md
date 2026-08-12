# Reparto de volumen por zona — diseño

**Fecha:** 2026-08-12
**Estado:** propuesta, sin implementar
**Origen:** `volumenDelBloque.ts` decide cuántas series le tocan a un grupo, pero nadie
decide a cuál de sus ejercicios van. Esta es la investigación que debe responderlo.

---

## 0. La pregunta

El motor de volumen ya dice «al glúteo le tocan 11 series la semana que viene, no 9».
Falta la otra mitad: **cuánto de cada ejercicio le llega a cada zona**. Si un hip thrust
aporta 1 al glúteo y medio al isquio, el presupuesto se reparte distinto que si aporta 1
a cada uno.

La hipótesis de trabajo del coach es que ese reparto debe salir de dos cuerpos de
conocimiento: **parámetros biomecánicos** (brazos de momento, perfiles de resistencia,
relación longitud-tensión, sarcomerogénesis) y **cadenas miofasciales**.

Esta página revisa qué soporta hoy cada uno y propone un modelo que use solo lo que
aguanta el peso.

---

## 1. Las tres capas de evidencia, y no valen lo mismo

Lo más importante de esta investigación es que los tres cuerpos de conocimiento que
queremos integrar **tienen calidades de evidencia muy distintas**. Mezclarlos como si
pesaran igual produciría un motor que parece riguroso y no lo es.

### Capa A — Conteo fraccionado (evidencia fuerte) ✅

La intuición del coach —que una serie no vale 1 para todos los grupos que toca— **está
validada, y con el mejor dato disponible**.

Pelland y colegas (Florida Atlantic University, laboratorio de Zourdos) recontaron el
volumen de **67 estudios y 2.058 sujetos** probando tres formas de contar las series
indirectas: `total` (valen 1), `fractional` (valen **0,5**) y `direct` (valen 0). La
conclusión es explícita: distinguir series directas de indirectas es **esencial** para
predecir adaptaciones, y el método fraccionado es el que mejor ajusta.

> Pelland JC, Remmert JF, Robinson ZP, Hinson SR, Zourdos MC. *The Resistance Training
> Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on
> Muscle Hypertrophy and Strength Gains.* Sports Medicine 2026;56(2):481–505.

**Consecuencia para nosotros:** el 0,5 que el coach propuso no hay que justificarlo, ya
está justificado. Es el valor exacto que usa la literatura.

### Capa B — Biomecánica regional (evidencia mecanicista buena, traducción numérica NO establecida) ⚠️

Los conceptos son reales y explican *por qué* un ejercicio estimula una zona:

| Concepto | Qué es | Qué determina |
|---|---|---|
| **Brazo de momento** | distancia perpendicular entre la línea de la resistencia y el eje articular | el torque exigido en cada ángulo |
| **Perfil de resistencia** | cómo varía la demanda a lo largo del recorrido | dónde pica el esfuerzo: en elongación, medio o acortamiento |
| **Relación longitud-tensión** | solapamiento actina-miosina (el *overlap*) | cuánta tensión activa puede producir la fibra en cada longitud |
| **Sarcomerogénesis en serie** | adición de sarcómeros en serie | adaptación propuesta al entrenar en elongación |
| **Hipertrofia regional** | el músculo no engorda parejo a lo largo ni entre cabezas | qué zona responde a qué ejercicio |

La hipertrofia regional **existe** y se mide: las regiones que sufren más deformación
crecen más, y la selección de ejercicio cambia qué zona crece (el caso clásico es el
curl predicador y la región distal del bíceps).

**Pero la evidencia reciente es mucho más tibia de lo que la divulgación sugiere:**

- Un metaanálisis bayesiano de 2025 que agrupó doce estudios manipulando la longitud
  muscular media encontró diferencias **triviales** entre sitios proximal, medio y
  distal, con intervalos de credibilidad cruzando el cero **en todos los sitios**.
- Los parciales en elongación parecían ganar en el metaanálisis de Wolf y cols. (2023),
  pero el propio grupo publicó en 2025 un ensayo directo en entrenados donde **igualaron**
  al recorrido completo, y una **réplica multicéntrica de 15 sedes**, preregistrada y con
  buena potencia, llegó a lo mismo.
- Sobre sarcomerogénesis en humanos, la revisión sistemática de 2025 sigue sin poder
  afirmar que el entrenamiento en longitudes largas produzca crecimiento longitudinal.

**Consecuencia para nosotros:** la biomecánica sirve para **elegir y etiquetar**
ejercicios, no para asignarles un coeficiente numérico por zona. Poner «0,37 al glúteo
medio» sería inventar una precisión que la literatura no respalda.

### Capa C — Cadenas miofasciales (la más débil de las tres para este uso) ⛔

Aquí hay que separar dos cosas que se confunden:

- **Continuidad anatómica: bien soportada.** La revisión sistemática de Krause y cols.
  verificó con 14 estudios de disección las tres transiciones de la línea posterior
  superficial (fascia plantar → Aquiles → gastrocnemio → isquiosurales → erectores), y
  hay evidencia fuerte también para las líneas funcionales anterior y posterior, moderada
  para la espiral y la lateral.
- **Transmisión de fuerza funcional: solo moderada, y en algunas transiciones.** La
  propia revisión concluye que falta evidencia sobre la **significación funcional** y la
  capacidad real de transferir fuerza, y que los métodos de medición no son comparables
  entre estudios. La revisión de continuidad miofascial de 2025 mantiene ese matiz.

**Consecuencia para nosotros:** las cadenas son útiles para **secuenciar** (qué ejercicios
comparten fatiga y no conviene encadenar) y para entender solapamientos, **no para
repartir volumen de hipertrofia**. Si el reparto de series se apoyara en las cadenas,
estaríamos construyendo la pieza más importante sobre la evidencia más floja de las tres.

---

## 2. El hallazgo que obliga a decidir antes de programar

**Los landmarks del Cerebro y el conteo fraccionado son dos monedas distintas, y hoy las
estaríamos sumando.**

`wiki/motor-decision/01-volumen-landmarks.md` fija MV ~6 · MEV 8–12 · MAV 12–20 · MRV
18–26, tomados de Israetel/RP. Esos números nacen de un conteo mayoritariamente
**directo**: son series *de ese grupo*.

`cargaPorGrupo` en la app hoy cuenta series enteras por grupo. Si mañana pasamos a contar
fraccionado —el hip thrust aportando 0,5 al isquio— el número total contado por grupo
**baja**, porque las contribuciones indirectas valen la mitad. Aplicar sin más los
landmarks de conteo directo sobre un conteo fraccionado significa **programar más volumen
real del que creemos**: el motor vería «9 series» donde antes veía 12 y añadiría series
para llegar al techo.

Es exactamente el mismo tipo de fallo silencioso que la frase contra los campos: dos
sistemas que hablan de «series» sin significar lo mismo.

> **Regla que hay que fijar antes de escribir código:** la moneda del volumen se declara
> una vez y todo el motor la usa. Si adoptamos conteo fraccionado, los landmarks se
> recalibran **en la misma tanda**, no después.

Hay una segunda cifra circulando —que 5–10 series fraccionadas por grupo y semana serían
la zona eficiente— que he visto en resúmenes secundarios del metaanálisis, **no en el
propio artículo**. No la doy por buena hasta leer el original. Es justamente el número
que decidiría la recalibración, así que conviene verificarlo en la fuente antes de tocar
nada.

---

## 3. Modelo propuesto

### 3.1 Contribución por ejercicio: escala gruesa y honesta

Una tabla `ejercicio → { grupo: fracción }` con **solo tres valores**:

| Valor | Significado |
|---|---|
| `1` | grupo primario: el ejercicio existe para entrenarlo |
| `0,5` | sinergista relevante: recibe estímulo real pero no es el objetivo |
| `0` | estabilizador o participación trivial: no cuenta |

Ejemplo:

```
hip-thrust        → { glúteo: 1,   isquio: 0,5 }
peso-muerto-rumano→ { isquio: 1,   glúteo: 0,5, erectores: 0,5 }
patada-en-polea   → { glúteo: 1 }
press-banca       → { pectoral: 1, tríceps: 0,5, deltoides-anterior: 0,5 }
```

**Por qué solo tres valores y no una escala fina:** porque 0,5 es el valor que la
literatura validó, y cualquier granularidad mayor (0,3 · 0,65 · 0,4) sería criterio
disfrazado de dato. Si el coach quiere mover un caso concreto, se mueve y **se marca como
criterio suyo** en el propio archivo, igual que están marcadas las tres interpolaciones
del encabezado de `volumenDelBloque.ts`.

### 3.2 Zona: etiqueta, no fracción

La subdivisión por zona (que es lo que motivó todo esto) **no se modela como número**. Se
modela como etiqueta de dónde carga el ejercicio en el recorrido:

```
perfilDeResistencia: 'elongado' | 'medio' | 'acortado'
```

Y el motor no reparte fracciones por zona: **comprueba cobertura**. Para cada grupo
prioritario, avisa si toda su semana carga en la misma zona —por ejemplo, un glúteo
entrenado solo con patadas y abducciones, todo en acortamiento, sin nada en elongación.

Eso es defendible con la evidencia que hay: la selección de ejercicio sí cambia qué zona
recibe estímulo, pero **cuánto** no se puede cifrar hoy. Un aviso de cobertura da el 80 %
del valor sin fingir precisión.

### 3.3 Las cadenas, donde sí sirven

Como señal de **solapamiento de fatiga**, no de volumen: si dos ejercicios consecutivos
comparten cadena (peso muerto rumano y luego extensiones de espalda, ambos en la línea
posterior superficial), el motor lo puede señalar al ordenar la sesión. No toca el
presupuesto de series.

---

## 4. Cómo encaja con el REF

Son ejes distintos y complementarios, y conviene no confundirlos:

| Eje | Pregunta que responde | Instrumento |
|---|---|---|
| **Volumen** | ¿cuánto trabajo? | series fraccionadas por grupo, contra landmarks |
| **Esfuerzo** | ¿cuán duro? | REF por ejercicio, contra sus umbrales |
| **Zona** | ¿dónde carga? | etiqueta de perfil de resistencia, contra cobertura |

Un microciclo bien programado tiene que cerrar en los tres, y hoy la app solo mira el
primero a medias. Ver el plan de integración en
`docs/plans/2026-08-12-integracion-ref-y-nivel.md`.

---

## 5. Lo que falta y solo el coach tiene

1. **La tabla de contribución para el catálogo real de ejercicios.** Yo puedo proponer un
   borrador desde patrón de movimiento, pero la revisión es suya: es criterio clínico.
2. **La etiqueta de perfil de resistencia** por ejercicio, misma condición.
3. **Verificar en el artículo de Pelland** el rango de referencia en conteo fraccionado,
   que es lo que decide la recalibración de landmarks (§2).

---

## Fuentes

- [Pelland et al., *The Resistance Training Dose Response*, Sports Medicine 2026](https://link.springer.com/article/10.1007/s40279-025-02344-w) — conteo fraccionado, 67 estudios
- [Regional Hypertrophy with Resistance Training — Does Muscle Length Matter? (metaanálisis bayesiano, SportRxiv)](https://sportrxiv.org/index.php/server/preprint/view/464)
- [Neuromechanical basis of region-specific differences, Eur J Appl Physiol 2025](https://link.springer.com/article/10.1007/s00421-025-05889-w)
- [Lengthened partial repetitions elicit similar adaptations as full ROM (2025)](https://www.researchgate.net/publication/388949912_Lengthened_partial_repetitions_elicit_similar_muscular_adaptations_as_full_range_of_motion_repetitions_during_resistance_training_in_trained_individuals)
- [Does longer-muscle length RT cause greater longitudinal growth? Revisión sistemática 2025](https://www.sciencedirect.com/science/article/pii/S2666337625000332)
- [Krause et al., *Intermuscular force transmission along myofascial chains*, J Anat 2016](https://onlinelibrary.wiley.com/doi/full/10.1111/joa.12464)
- [Myofascial continuity: review of anatomical and functional evidence (2025)](https://pubmed.ncbi.nlm.nih.gov/41316622/)
- Interno: `wiki/motor-decision/01-volumen-landmarks.md` (Cerebro Alpha)
