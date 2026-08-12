# Integración de los tres Excel de cálculo — plan

**Fecha:** 2026-08-12
**Origen:** `Z:\Downloads\ecxel de ondulacion de programacion`
**Diseño que lo acompaña:** `docs/specs/2026-08-12-reparto-de-volumen-por-zona-diseno.md`

El criterio que pidió el coach: quedarnos con lo que dé plusvalía real hoy y **sacar lo
que no**, aunque sea interesante.

---

## Veredicto de los tres

| Excel | Veredicto | Motivo en una línea |
|---|---|---|
| **Ratio estímulo–fatiga (REF)** | ✅ **Adoptar entero** | Da un eje que hoy no existe, y es calculable sin dato nuevo |
| **Verdadero nivel de entrenamiento** | 🟡 **Adoptar reducido** | El concepto vale; el cuestionario completo no se sostiene |
| **Perfil F-V** | ⛔ **Descartar por ahora** | Exige medir velocidad de barra, y lo que aporta ya lo cubrimos |

### ✅ REF — adoptar entero

```
REF = repeticiones ÷ (100 − %1RM)
```

Verificado contra la propia hoja: 85 kg con 1RM 113 → %1RM 75,2 → 10/24,8 = **0,4036**,
idéntico a la celda.

**Lo que lo hace barato:** en el Excel hace falta el 1RM porque el usuario mete peso real.
En nuestra app no. `src/domain/cargas.ts` ya tiene la matriz CARGAS (reps × RIR → fracción
del 1RM), copiada literal de los 21 libros de asesorados y verificada el 2026-08-01. Esa
fracción **es** el %1RM, así que el 1RM se cancela:

```
REF_serie = reps ÷ (100 × (1 − coeficienteCarga(reps, RIR)))
```

De ahí salen dos cosas que hoy no tenemos:

- **REF previsto**, solo con `reps` y `rirObjetivo` — los dos campos que se alinearon esta
  mañana. Se puede calcular sobre un microciclo **antes** de repartirlo.
- **REF real**, con lo que el asesorado registró. Comparar previsto contra real es la
  misma tensión «frase vs campos» de hoy, pero en versión «prescrito vs ejecutado».

**Umbrales del Excel, tal cual:**

| REF por sesión | | REF por semana | |
|---|---|---|---|
| < 0,4 | Poco estímulo | < 2,0 | Descarga, recuperación, transición |
| 0,4 – 1,3 | Buen estímulo, recuperable | 2,0 – 3,4 | Carga y adaptación |
| 1,3 – 2,3 | Bueno en acumulación de volumen | 3,4 – 4,6 | Demandante, solo etapas cortas |
| > 2,3 | Muy difícil | > 4,6 | No más de una semana |

⚠️ **El REF no se suma entre ejercicios distintos.** En la hoja 2 cada ejercicio acumula el
suyo (jalón 2,22 · press banca 1,80 · remo 1,13). Ambas escalas son **por ejercicio**.

✅ **Resuelto el 2026-08-12 — la escala «por sesión» es por ejercicio.** Estaba planteado
como pregunta para el coach, pero la propia hoja lo decide sin necesidad de opinión:

- Los **ocho ejercicios de la semana 1 suman 10,76**. Si la escala se aplicara al total de
  la sesión o de la persona, la hoja de ejemplo del propio autor quedaría al **doble** del
  umbral «no recomendado más de una semana» (4,6) y al **cuádruple** del «muy difícil» de
  sesión (2,3). Un autor no publica su ejemplo en zona prohibida.
- Leídos **por ejercicio**, los doce valores rellenados de la hoja caen entre **0,88 y
  2,22**: todos en «buen estímulo, recuperable» o «bueno en acumulación de volumen»,
  ninguno en «poco estímulo» ni en «muy difícil».

La escala de sesión y la semanal son la misma medida en dos ventanas: series de ese
ejercicio en una sesión, y series de ese ejercicio en toda la semana.

> Es inferencia sobre la hoja, no una declaración del autor. Si algún día aparece la fuente
> original y dice otra cosa, lo que cambia son los dos `clasificar*` y sus tests, nada más.

### 🟡 Nivel de entrenamiento — adoptar reducido

El concepto es valioso y encaja con un hueco real: hoy los landmarks son los mismos para
todos, y el MEV de una principiante no es el de una avanzada.

Pero el cuestionario completo **no se sostiene en nuestro contexto**: pide 1RM real en
banca, dominadas, sentadilla y peso muerto (nuestras asesoradas no hacen tests de fuerza
máxima), más tres autoevaluaciones subjetivas.

**Lo que sí se adopta:** un campo `nivelEntrenamiento` en el PERFIL con los cuatro valores
(`Principiante` · `Intermedio` · `Avanzado` · `Experto`), **puesto por el coach**, no
autocalculado. Modula los landmarks. La fuerza relativa se puede estimar desde
`estimarUnRm` si algún día se quiere ayudar a rellenarlo, pero no como cálculo automático.

### ⛔ Perfil F-V — descartar por ahora

De Balsalobre-Fernández y David Marchante. Estima el 1RM del día por velocidad de barra,
con control de calidad por R² (≥0,99 preciso · <0,98 repetir el test).

Tres razones para dejarlo fuera:

1. **Exige equipo que no hay.** Encoder o app de velocidad, en gimnasio comercial, con
   asesoradas que ya tienen fricción para registrar series.
2. **Lo que aporta ya lo tenemos.** El 1RM del día sale de `estimarUnRm(carga, reps, RIR)`
   sin test de fuerza máxima — que es justamente cómo el método detecta progreso.
3. **El VBT ya está contemplado** en `wiki/motor-decision/03-vbt-perdida-velocidad.md`, y
   la jerarquía Heracles lo pone en el puesto 4, por debajo de tensión mecánica, «cuando
   hay datos». No los hay.

**No se borra:** queda archivado. Si algún día hay encoder, se recupera.

---

## Plan por fases

Cada fase cierra con `npm run verify` en verde y su propio commit. Rama nueva desde
`entrenar/alineacion-frase-campos` una vez esa se mergee. **Nada se empuja a `main` sin
autorización**: Vercel publica en producción con solo hacer push allí.

### Fase 1 — REF en dominio (no bloqueada, se puede empezar ya)

- `src/domain/ref.ts` + `ref.test.ts`
- `refDeSerie(reps, rir)` apoyado en `coeficienteCarga`; `undefined` fuera de tabla, **sin
  extrapolar**, igual que hace `cargas.ts`
- `refDeEjercicio(ejercicio)` sumando sus series
- `clasificarRefSemanal(valor)` con los cuatro tramos
- Encabezado documentando la fórmula, su origen y la equivalencia %1RM ↔ matriz CARGAS
- **Test de anclaje**: reproducir el caso del Excel (85 kg · 10 reps · 1RM 113 → 0,4036)
  para que un cambio en la matriz CARGAS que rompa la equivalencia salte

### Fase 2 — REF en la propuesta de microciclo ✅ *hecha el 2026-08-12*

- `FilaPropuesta.ref` y `.tramoRef`: el REF **de lo que se va a prescribir**, no de lo
  que se hizo. Sale de las series ya onduladas, así que mide la propuesta
- `PropuestaMicrociclo.refSemanal`: agrupado **por ejercicio** sumando sus sesiones, que
  es la ventana de la escala semanal. De mayor a menor, el orden en que hay que mirarlos
- Si una sola aparición del ejercicio no se pudo calcular, el ejercicio se cae de la lista
  en vez de salir con un total corto. Un total corto diría «va suave» justo cuando falta
  medirle una sesión
- `GenerarMicrocicloSheet` muestra `REF x,xx · lectura` en cada tarjeta y levanta un aviso
  con los ejercicios que pasan del techo semanal (4,6)

La hoja no tenía tests. Siguiendo `tests-primero-sin-cobertura`, se escribieron primero
seis que cubren su comportamiento anterior y se comprobaron **en verde contra el código
viejo** antes de tocarlo; los dos del REF eran los únicos en rojo.

### Fase 3 — Nivel de entrenamiento ✅ *hecha el 2026-08-12*

- `NivelEntrenamiento` y `Perfil.nivelEntrenamiento`, opcional. Viaja en
  `perfiles.datos` (JSONB): **sin migración**
- `techoDe()` lo suma al techo por prioridad, con tope en MRV — pasar de ahí es volumen
  basura, y eso no lo compra la experiencia
- Sin dato, o con `Intermedio`, el motor decide exactamente lo mismo que antes: los 18
  asesorados sin el campo no ven cambiar nada. Hay un test que lo fija

**Ajuste por nivel** (cuarta interpolación del módulo; la fuente pide ajustar «según
recuperación individual» sin cifrar cuánto):

| Nivel | Series sobre el techo |
|---|---|
| Principiante | −3 |
| Intermedio | 0 |
| Avanzado | +2 |
| Experto | +3 |

⚠️ **Todavía no se nota en pantalla, y es esperable.** `volumenDelMicrociclo` **no lo
consume nadie aún**: el motor de volumen sigue sin conectarse a `proponerMicrociclo`
porque falta la regla de reparto (ver el documento de diseño). El nivel está listo para
cuando se conecte.

**Falta la UI para cargarlo.** Se hace cuando el motor se conecte: antes, el coach estaría
rellenando un campo que no mueve nada.

### Fase 4 — Conteo fraccionado ✅ *desbloqueada el 2026-08-12*

Se leyó el artículo de Pelland (ver §2 del documento de diseño). Resultado:

- **No hay que recalibrar los landmarks.** MEV/MAV/MRV caen en el mismo orden de magnitud
  que los niveles de eficiencia del artículo
- **El «5–10» que circulaba no era un techo** sino el primer escalón de eficiencia. La
  dosis mínima eficaz está en **4** series fraccionadas, y no hay meseta clara
- **El riesgo era el contrario del que anoté.** La app cuenta hoy en moneda **directa**
  (`grupoDeCategoria` da un grupo por ejercicio), no total. Pasar a fraccionado **sube** el
  conteo, así que con landmarks fijos el peligro es quedarse corto, no pasarse

Queda por delante, en este orden:

1. Declarar la moneda en el código y en el Cerebro
2. La tabla de contribución `ejercicio → { grupo: fracción }` con valores `1 · 0,5 · 0`
3. **Medir el salto real** sobre los 18 asesorados antes de mover ningún número

### Fase 5 — REF previsto contra REF real

Lo más valioso a medio plazo y lo que menos se puede hacer hoy: solo hay **68 series
registradas** en toda la base. Hasta que el registro suba, cualquier comparación sería
anecdótica.

---

## Mantenimiento de los Excel

El riesgo real es que estos tres libros repitan la historia del Excel congelado: dos
fuentes de verdad que divergen en silencio.

**Regla propuesta:** los Excel son **fuente de fórmula, no fuente de dato**. De ellos se
extrae la fórmula y los umbrales, se escriben en `src/domain/` con su test de anclaje, y
los libros quedan archivados como referencia. No se mantienen en paralelo ni se consultan
para decidir nada.

Los tres originales conviene moverlos de `Z:\Downloads` a un sitio con respaldo, y dejar
lo extraído (fórmula, umbrales, niveles) en el Cerebro, en `wiki/conocimiento/`, con su
línea en `log.md`.

---

## Orden recomendado

1. ~~Fase 1~~ — hecha el 2026-08-12 (`src/domain/ref.ts`, 20 tests)
2. ~~Resolver el REF por sesión~~ — resuelto por análisis de la propia hoja
3. ~~Fase 2~~ — hecha el 2026-08-12 (propuesta + hoja del coach, 16 tests)
4. **Fase 3**, que nunca dependió de nada
5. **Verificar el rango de referencia de Pelland** en el artículo original — decide la fase 4
6. Fases 4 → 5
