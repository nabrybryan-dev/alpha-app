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
suyo (press banca 2,22 · jalón 1,80 · remo 1,13). Alguien con 8 ejercicios no tiene REF 12.
Ambas escalas son **por ejercicio**.

❓ **Pregunta abierta para el coach:** la escala «por sesión», ¿se aplica al REF acumulado
de *un ejercicio* en esa sesión, o al de la sesión entera? La estructura de la hoja sugiere
lo primero; el rótulo dice «por sesión» a secas. **Esto bloquea la fase 2.**

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

### Fase 2 — REF en la propuesta de microciclo ⛔ *bloqueada por la pregunta abierta*

- `propuestaMicrociclo` calcula el REF previsto por ejercicio y lo muestra con su tramo
- Aviso cuando un ejercicio queda `< 0,4` (poco estímulo) o `> 4,6` semanal
- El motivo va escrito al lado, para que el coach pueda moverlo al aprobar

### Fase 3 — Nivel de entrenamiento

- `nivelEntrenamiento` en el PERFIL (`src/domain/types.ts`), opcional
- `volumenDelBloque.ts` lo usa para mover los techos de `techoDe()`
- Sin dato → comportamiento actual, sin cambios

### Fase 4 — Conteo fraccionado ⛔ *bloqueada por la recalibración de landmarks*

Lo del documento de diseño. **No se toca hasta resolver la moneda del volumen**: cambiar a
conteo fraccionado sin recalibrar los landmarks hace que el motor programe más volumen del
que cree. Va en la misma tanda que la recalibración o no va.

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

1. **Verificar el rango de referencia de Pelland** en el artículo original — decide la fase 4
2. **Responder la pregunta del REF por sesión** — desbloquea la fase 2
3. **Fase 1**, que no depende de ninguna de las dos y se puede empezar ya
4. Fases 3 → 2 → 4 → 5
