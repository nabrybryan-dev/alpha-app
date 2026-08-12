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

## 2. La moneda del volumen — verificado contra el artículo el 2026-08-12

> **Corrección.** La primera versión de esta página decía que pasar a conteo fraccionado
> haría **bajar** el número contado por grupo, y que por eso el motor programaría de más.
> **Es al revés**, y el error estaba en dar por supuesto cómo cuenta la app. Se comprobó
> en el código: `grupoDeCategoria` (`domain/fatiga.ts`) devuelve **un solo grupo** por
> ejercicio —«el primer patrón que calce gana»—, así que hoy la app cuenta en moneda
> **directa**, con las indirectas valiendo **cero**. Al pasar a fraccionado esas
> contribuciones suben de 0 a 0,5 y el conteo **sube**. Con landmarks fijos, el riesgo no
> es programar de más: es **quedarse corto**.

### Lo que dice el artículo, ya leído

Pelland et al. cuantifican tres monedas y las definen con un ejemplo propio: 5 series de
press de banca en una sesión y 5 de remo en otra dan un volumen semanal de **10 (total),
7,5 (fraccionado) y 5 (directo)**. Es decir: `total ≥ fraccionado ≥ directo`. La app está
hoy en el extremo bajo.

Sus **niveles de eficiencia para hipertrofia** (Tabla 3), en series fraccionadas por grupo
y semana:

| Nivel | Series fraccionadas | Qué significa |
|---|---|---|
| **Dosis mínima eficaz** | **4** | suficiente para hipertrofia detectable |
| Mayor eficiencia | **5–10** | ~6 series más para el siguiente incremento detectable |
| Eficiencia intermedia | **11–18** | ~8,5 más |
| Menor eficiencia | **19–29** | ~10,75 más |
| Eficiencia mínima | **30–42** | ~12,5 más |
| Sin datos | 43+ | insuficiente, o potencialmente menos hipertrofia |

Mediana de los estudios de hipertrofia: **10,5 series fraccionadas/semana**; media
**13,00 ± 8,87**.

### Dos cosas que hay que sacar de aquí

**El «5–10» no era lo que parecía.** Circulaba en resúmenes secundarios como «la zona
eficiente» o el punto dulce, y no lo es: es el **primer escalón de eficiencia**, no un
techo ni una recomendación. El artículo es explícito en que **no hay meseta clara** —solo
hacen falta cada vez más series por incremento detectable— y que la dosis mínima eficaz
está tan abajo como 4.

**Los landmarks no hay que recalibrarlos.** Puestos uno junto a otro, MEV 8–12, MAV 12–20
y MRV 18–26 caen respectivamente en mayor/intermedia, intermedia y menor eficiencia: el
mismo orden de magnitud, sin desfase que obligue a mover nada. La alarma de la primera
versión era prudente pero no se materializa.

> ⚠️ Con un matiz que conviene anotar en el Cerebro: el artículo **no encuentra meseta ni
> perjuicio** hasta ~42 series, lo que no respalda el «pasarse de MRV es volumen basura y
> fatiga». Tampoco lo refuta —los propios autores avisan de que **pocos estudios exploran
> ~25+ series**, así que no pueden situar el punto de meseta—. El MRV del Cerebro cae
> justo en ese borde de incertidumbre.

### Lo que sí hay que hacer

Declarar la moneda una vez, en el código y en el Cerebro —hecho el 2026-08-12, ver
`domain/fatiga.ts` y `wiki/motor-decision/01-volumen-landmarks.md`— y **medir**.

---

## 2.1 Medición basal contra la base real (2026-08-12)

Sobre los **20 microciclos activos**: 506 ejercicios de fuerza, **1.467 series pautadas**.
Es la foto contra la que se medirá el salto el día que se adopte el conteo fraccionado.

### Reparto actual, en moneda directa

| Grupo | Series | % |
|---|---|---|
| Espalda | 255 | 17,4 |
| Cuádriceps | 233 | 15,9 |
| Isquios | 211 | 14,4 |
| Hombros | 172 | 11,7 |
| Glúteos | 171 | 11,7 |
| Pecho | 88 | 6,0 |
| Abdomen | 81 | 5,5 |
| Pantorrillas | 67 | 4,6 |
| Tríceps / Bíceps | 55 / 55 | 3,7 / 3,7 |
| **(sin grupo)** | **54** | **3,7** |
| Aductores | 25 | 1,7 |

### Hallazgo 1 — hay trabajo de pierna que hoy no cuenta para nadie

De las **54 series huérfanas**, la mayoría está bien que no cuente (PREV/REHAB —rotación
externa, control escapular, movilidad, saltos— y ACONDICIONAMIENTO). Pero **19 series son
`PIERNA UNILATERAL`** y sí son trabajo de fuerza que debería sumar:

- Zancada con mancuernas · Zancada en déficit · Zancada sobre cajón
- Subida al cajón · Bajada controlada desde cajón

`GRUPOS` (`domain/fatiga.ts`) no tiene patrón para `PIERNA UNILATERAL` ni para `ZANCADA`,
así que desaparecen del presupuesto de cuádriceps y glúteo. **No se ha tocado a propósito**:
a qué grupo va una zancada es criterio del coach, y cambiarlo mueve la programación de
gente real.

### Hallazgo 2 — el volumen medido queda muy por debajo de los landmarks

185 pares asesorado × grupo:

| | Series por grupo y microciclo |
|---|---|
| Media | **7,6** |
| Rango | 2 – 21 |
| Por debajo de la **dosis mínima eficaz** (4) | **58 pares · 31 %** |
| Entre 4 y 7 | 45 · 24 % |
| En MEV (8–11) | 41 · 22 % |
| En MAV o más (12+) | 41 · 22 % |
| **Por debajo de MEV (8)** | **55,7 %** |

Y hay que corregir a la baja, no al alza: **19 de los 20 microciclos son de 8 días**, no de
7 (el otro es de 15). Llevado a semana, la media baja de 7,6 a **~6,7 series por grupo**.

### Cómo leer esto, con cuidado

Son dos hipótesis distintas y los datos no distinguen entre ellas:

1. **Medimos por debajo.** El conteo directo ignora todo el trabajo indirecto; en
   fraccionado, muchos de esos 58 pares subirían solos sin cambiar una sola serie real.
2. **El volumen es de verdad bajo** en parte de la cartera.

La primera explica parte y la segunda probablemente también. **Distinguirlas es
exactamente para lo que sirve el conteo fraccionado**, y por eso el salto no se puede
estimar todavía: necesita la tabla de contribución (§3.1). Cualquier ajuste de landmarks
antes de eso sería a ciegas.

> Lo que sí queda fijado: esta foto es la línea base. El día que la tabla exista, la misma
> consulta da el salto por grupo.

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

#### La clave NO puede ser la categoría — medido el 2026-08-12

Primer instinto: usar la taxonomía del coach (`categoria`) como clave, que ya es un
vocabulario de movimiento. **No funciona.** En la base hay **210 categorías distintas**
para doce grupos musculares:

- **23 variantes solo de glúteo**: `GLÚTEO` · `GLÚTEO PRIORITARIO` · `GLÚTEO MEDIO` ·
  `GLÚTEO DINÁMICO` · `GLÚTEO COMPLEMENTO` · `GLÚTEO FINISHER` · `GLÚTEO NUEVO` ·
  `AISLAMIENTO GLÚTEOS` · `GLÚTEO (CONTROL)` · `GLÚTEO (SIN CARGA SACRA)`…
- **8 de sentadilla**, 
- Y **120 series** viven en etiquetas que **no nombran ningún grupo**: `SUPERSERIE A1`,
  `SERIE GIGANTE B2`, `DROP SET`, `FINISHER`, `CLUSTER · SENTADILLA`, `TRI-SET B1`.

Una tabla con esa clave nacería con 210 filas y crecería cada vez que se escriba una
etiqueta nueva. Es la misma trampa de la ortografía, elevada.

#### Catálogo cerrado de movimientos — 24 patrones, cobertura medida

La clave es el **movimiento**, reconocido sobre `CATEGORÍA + NOMBRE` normalizado, igual
que hace hoy `grupoDeCategoria`. Probado contra las **5.249 series** de toda la base:
**solo el 0,8 % queda sin clasificar**, y un 1,8 % cae en «no cuenta» (prev/rehab,
movilidad, cardio, isometrías de sostén), que es lo correcto.

**Aprobado por el coach el 2026-08-12**, con el repaso aplicado. En orden de evaluación:
el primero que calce gana, como en `GRUPOS`.

| # | Movimiento | % series | Contribución |
|---|---|---|---|
| 1 | `fondos` | 0,7 | Pecho 1 · Tríceps 0,5 · Hombros 0,5 |
| 2 | `triceps` | 3,8 | Tríceps 1 |
| 3 | `curl-femoral` | 7,2 | Isquios 1 |
| 4 | `zancada-split` | 4,5 | Cuádriceps 1 · Glúteos 0,5 |
| 5 | `hip-thrust` | 5,8 | Glúteos 1 · Isquios 0,5 |
| 6 | `extension-cadera` | 3,3 | Glúteos 1 |
| 7 | `abduccion` | 3,8 | Glúteos 1 |
| 8 | `aduccion` | 2,2 | Aductores 1 |
| 9 | `bisagra` | 6,1 | Isquios 1 · Glúteos 0,5 |
| 10 | `sentadilla` | 9,1 | Cuádriceps 1 · Glúteos 0,5 |
| 11 | `prensa` | 1,0 | Cuádriceps 1 · Glúteos 0,5 |
| 12 | `extension-rodilla` | 3,6 | Cuádriceps 1 |
| 13 | `pantorrilla` | 4,4 | Pantorrillas 1 |
| 14 | `tibial` | 0,7 | **Tibial 1** *(grupo nuevo)* |
| 15 | `apertura` | 3,0 | Pecho 1 |
| 16 | `press-horizontal` | 8,1 | Pecho 1 · Tríceps 0,5 · Hombros 0,5 |
| 17 | `press-vertical` | 3,0 | Hombros 1 · Tríceps 0,5 |
| 18 | `elevacion-lateral` | 5,2 | Hombros 1 |
| 19 | `deltoides-posterior` | 1,6 | Hombros 1 · Espalda 0,5 |
| 20 | `pullover` | 1,4 | Espalda 1 · Pecho 0,5 |
| 21 | `remo` | 7,1 | Espalda 1 · Bíceps 0,5 · **Hombros 0,5** |
| 22 | `jalon` | 3,3 | Espalda 1 · Bíceps 0,5 |
| 23 | `trapecio` | 0,4 | Espalda 1 |
| 24 | `curl-biceps` | 3,7 | Bíceps 1 |
| 25 | `core` | 4,6 | Abdomen 1 |
| — | *(no cuenta)* | 1,8 | prev/rehab · movilidad · cardio · isometrías de sostén |

### Qué cambió en el repaso

**Un error mío, corregido.** El patrón `triceps` incluía `FONDO`, así que los **fondos en
paralelas** —un compuesto de pecho— contaban como tríceps puro. Son 36 series, 26 de ellas
con lastre o en paralelas. Van en su propio movimiento y **antes** que `triceps`, o el
orden se los volvería a tragar.

**Una omisión, corregida.** `remo` no daba nada al deltoides posterior, y el remo es uno de
sus mayores contribuyentes. Son **442 series** —el segundo movimiento en volumen—, así que
sin ese `Hombros 0,5` el hombro se subestima de forma apreciable.

**Grupo nuevo: `Tibial`.** 38 series que hoy no cuentan para nadie.

### Decisiones que siguen abiertas, y por qué no las cierro yo

1. **`bisagra`: ¿el glúteo es 0,5 o 1?** En un peso muerto rumano el glúteo es
   co-primario, no accesorio. Son **434 series**, así que la diferencia no es cosmética.
   Lo dejo en 0,5 porque el patrón agrupa también hiperextensiones y buenos días, donde
   sí es más secundario.
2. **`sentadilla`: ¿añadir Aductores 0,5?** El aductor mayor es un extensor de cadera
   potente en sentadilla profunda. Son **584 series**, el mayor movimiento del catálogo:
   añadirlo dispararía el volumen de aductores. Por eso no lo meto sin tu visto bueno.
3. **Los erectores espinales no tienen grupo.** Cargan en toda la `bisagra` y en las 58
   series de hiperextensión/lumbar. ¿Se crea un grupo como con `Tibial`, o se asume que
   `Espalda` los cubre? Meterlos en `Espalda` mezclaría dorsal con lumbar.

#### Deuda que esta tabla tiene que saldar el primer día

`PIERNA UNILATERAL` es hoy un agujero medido: **64 series** que no cuentan para ningún
grupo (19 en microciclos activos), y que cuentan o no según cómo se escribiera el nombre
—«Sentadilla búlgara» sí, «BÚLGARA EN SMITH» no—. El coach decidió el 2026-08-12 **no
parchear el mapa** y esperar aquí, porque en moneda directa habría que mandar el
movimiento entero a un solo grupo y estos reparten. Lo que la tabla debe traer:

```
zancada             → { cuádriceps: 0,5, glúteo: 0,5 }
sentadilla-búlgara  → { cuádriceps: 0,5, glúteo: 0,5 }
subida-al-cajón     → { cuádriceps: 0,5, glúteo: 0,5 }
bajada-desde-cajón  → { cuádriceps: 0,5, glúteo: 0,5 }
```

Valores de partida a revisar por el coach. Y una nota para quien implemente: la clave debe
ser el **movimiento**, no la categoría ni el nombre literal. Por categoría se tragaría un
peso muerto unilateral; por nombre literal repetiríamos el fallo de la ortografía.

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
3. ~~Verificar en el artículo de Pelland el rango de referencia~~ — hecho el 2026-08-12,
   ver §2. No hay que recalibrar landmarks; lo que hay que hacer es declarar la moneda y
   medir el salto real sobre los datos.

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
