# Biomecánica de la contribución — por qué un patrón no basta como clave

**Fecha:** 2026-08-12
**Acompaña a:** `2026-08-12-reparto-de-volumen-por-zona-diseno.md`
**Origen:** criterio del coach + revisión de literatura pedida expresamente

La primera tabla asignaba una contribución fija por patrón de movimiento. El coach
señaló que eso es insuficiente: **la misma bisagra reparte distinto según haya o no
flexión de rodilla**, y el implemento cambia qué estabilizadores entran. Esta página
comprueba ese criterio contra la literatura y saca las reglas que la tabla necesita.

---

## 1. Biarticularidad y ángulo de rodilla — confirmado

Los isquiosurales cruzan cadera y rodilla, así que su longitud —y por tanto su capacidad
de producir fuerza— depende de **las dos articulaciones a la vez**.

**Con la rodilla extendida** (peso muerto rumano, stiff, buenos días) el isquio está
alargado en la cadera y no acortado en la rodilla: trabaja en posición estirada. La
comparación directa lo mide: **el ratio bíceps femoral / semitendinoso es mayor en
extensión de cadera con rodilla extendida que en curl a 90°**.

**Con la rodilla flexionada** (hip thrust, puente de glúteo) el isquio se acorta por su
extremo distal y entra en **insuficiencia activa**: no puede generar tensión eficazmente,
y la extensión de cadera recae sobre el glúteo mayor. No es una interpretación de gimnasio
— es el fundamento del test clínico estándar: *«la fuerza del glúteo mayor se evalúa en
extensión de cadera en prono con la rodilla flexionada a 90° precisamente para minimizar
la contribución de los isquios por insuficiencia activa»*.

Y funciona en la dirección contraria también: **un puente con la rodilla más extendida
sube el ratio isquio/glúteo**.

> **Regla 1.** La bisagra no es un patrón, son dos. Con rodilla extendida manda el isquio;
> con rodilla flexionada manda el glúteo.

Un matiz que también aparece y que conviene no olvidar: los ejercicios **rodilla-dominantes**
(curl) reclutan preferentemente isquios **mediales**, mientras que los **cadera-dominantes**
(rumano) dan más bíceps femoral. Contribuyen al mismo grupo, pero no a la misma región —
es hipertrofia regional dentro del propio grupo, y por eso `curl-femoral` y `bisagra` no
son intercambiables aunque ambos sumen «isquios».

---

## 2. El aductor mayor es un extensor de cadera, y en la sentadilla es el principal

Esto es más fuerte de lo que la tabla asumía. Los brazos de momento de **extensión de
cadera a 90° de flexión** —es decir, en el fondo de la sentadilla— son:

| Músculo | Brazo de momento extensor |
|---|---|
| **Aductor mayor** | **5,7 – 6,1 cm** |
| Isquiosurales | 4,0 – 4,8 cm |
| Glúteo mayor | 3,1 – 3,3 cm |

En el fondo de la sentadilla el aductor mayor es **el extensor de cadera más eficaz de
los tres**, por delante del glúteo. Hay incluso trabajo que propone redefinir el músculo:
está diseñado para actuar *primariamente en extensión de cadera*, no en aducción.

Y se traduce en crecimiento, no solo en EMG: con entrenamiento de sentadilla el **volumen
aductor creció un 6,2 %** frente a un **6,7 % del glúteo**. Prácticamente lo mismo.

> **Regla 2.** La sentadilla alimenta al aductor tanto como al glúteo. Dejarlo fuera no
> era una simplificación: era un error de reparto.

Con la condición que el coach señaló: **depende de la profundidad**. El brazo de momento
del aductor crece con la flexión de cadera, así que una sentadilla parcial no reparte
igual que una profunda.

---

## 3. El implemento cambia quién estabiliza — confirmado, con un límite

El criterio del coach —que una máquina pendular o guiada descarga estabilizadores que un
peso libre exige— se sostiene en la medida directa:

- El **remo libre bilateral** da **+34 % de erector espinal** que el mismo remo en máquina.
- En máquina, oblicuo externo y multífido bajan al **50-57 %** y **70-73 %** del valor del
  peso libre.
- **Bilateral** da más erector y multífido; **unilateral** da más oblicuo externo, por la
  demanda antirrotacional.

Sobre la forma de la resistencia: el peso libre carga al máximo donde la palanca es peor;
una **leva** intenta seguir la curva de fuerza; un **pendular** da una curva **en campana**,
con el torque máximo en la mitad del recorrido.

> **Regla 3.** El implemento no cambia el músculo objetivo, cambia **el impuesto de
> estabilización**. Libre y bilateral cargan erectores; unilateral carga oblicuos.

### ⚠️ Dónde la evidencia NO acompaña

Sería fácil llevar esto más lejos de lo que aguanta, así que conviene dejarlo escrito:

- Un **metaanálisis** de peso libre contra máquina **no encontró diferencias** en fuerza,
  salto ni hipertrofia.
- Un estudio de 2025 encontró **hipertrofia regional comparable del cuádriceps** entrenando
  con máquinas o con peso libre.

Es decir: el implemento **sí** cambia qué estabilizadores trabajan —eso está medido— pero
**no** hay evidencia de que cambie cuánto crece el músculo objetivo. Por eso el modificador
de implemento debe tocar **solo** los estabilizadores (erectores, oblicuos), nunca la
contribución del grupo primario.

---

## 4. Lo que sigue sin soporte suficiente, y por qué no entra en la tabla

El coach pidió integrar cadenas miofasciales, fuerzas de fricción/compresión/rotación y
cadenas abiertas/cerradas/cruzadas. Revisado el estado de la evidencia (ver §1.C del
documento de diseño):

- **Continuidad anatómica de las cadenas: bien soportada.** Catorce estudios de disección
  verifican la línea posterior superficial completa.
- **Transmisión funcional de fuerza: solo moderada, y en algunas transiciones.** La propia
  revisión sistemática concluye que falta evidencia sobre la significación funcional in
  vivo, y que los métodos no son comparables entre estudios.

**Conclusión operativa:** las cadenas explican *por qué* un gesto solicita estructuras
lejanas, pero no permiten hoy asignar un número de series. Entran como criterio de
**secuenciación** (qué no encadenar por fatiga compartida), no de reparto de volumen.
Cifrarlas sería inventar precisión, y ese es justo el fallo que este proyecto viene
arrastrando desde la frase contra los campos.

---

## 5. Reglas que la tabla debe implementar

1. **Desdoblar `bisagra`** por ángulo de rodilla → `bisagra-rodilla-extendida` y
   `bisagra-rodilla-flexionada`.
2. **La sentadilla suma aductores**, con el glúteo, y ambos por debajo del cuádriceps.
3. **Erectores como grupo propio** (`Erectores`), no dentro de `Espalda`: dorsal y lumbar
   no se recuperan igual ni se programan juntos.
4. **Modificador de implemento**, que solo toca estabilizadores:
   - libre / bilateral → `Erectores +0,5`
   - libre / unilateral → `Abdomen +0,5` (demanda antirrotacional)
   - máquina / guiado → sin añadido
5. **No modelar** cadenas miofasciales, fricción/compresión/rotación ni cadena
   abierta/cerrada como fracciones de volumen. Se anotan como criterio de secuenciación.

---

## Fuentes

- [Adductor magnus hip extension moment arms & squat, Stronger by Science](https://www.strongerbyscience.com/squats-adductors/)
- [Redefining muscular action: human "adductor" magnus acts primarily for hip extension, J Appl Physiol 2025](https://journals.physiology.org/doi/full/10.1152/japplphysiol.00600.2024)
- [Task-dependent differences in hamstring EMG during leg curls and hip extensions, PLoS ONE](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0245838)
- [Assessing and treating gluteus maximus weakness — clinical commentary (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6670060/)
- [Gluteus maximus and hamstring activation during prone hip extension with knee flexion, Man Ther 2013](https://pubmed.ncbi.nlm.nih.gov/23312068/)
- [Core muscle activation: free-weight vs machine rows (Thieme)](https://www.thieme-connect.com/products/ejournals/abstract/10.1055/s-0034-1398646)
- [Free-weight vs machine-based training: systematic review and meta-analysis, 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10426227/)
- [Comparable regional hypertrophy of knee extensors: machines vs free weights, 2025](https://www.sciencedirect.com/science/article/abs/pii/S1360859225003742)
- [Krause et al., Intermuscular force transmission along myofascial chains, J Anat 2016](https://onlinelibrary.wiley.com/doi/full/10.1111/joa.12464)
