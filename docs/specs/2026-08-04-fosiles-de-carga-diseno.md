# Fósiles de carga: el microciclo nuevo heredaba lo que el asesorado hizo

**Fecha:** 2026-08-04
**Estado:** molde arreglado y limpieza escrita; **la limpieza todavía no se ha
aplicado en producción** (el SQL se pega a mano en el panel).

---

## Qué pasó

Las cargas de microciclo construyen la semana siguiente clonando la vigente. El
clonador de julio de 2026 lo hacía así:

```sql
jsonb_set(s, '{ejercicios}', <ejercicios con series = []>)
```

Reescribe **solo** `ejercicios`. Todo lo demás del objeto sesión pasa literal, y
ahí viven tres campos que son del microciclo **anterior**:

| Campo | Qué es | Qué veía el asesorado |
|---|---|---|
| `preparacion[].hechoEn` | marca con hora de cada ítem de calentamiento/movilidad | ítems ya tildados |
| `bloquesCardio[].hechoEn` | lo mismo para los bloques de cardio | bloques ya tildados |
| `testPost` | test de fin de sesión (duración, RPE, PRS) | ya relleno |

`series` sí se reseteaba, así que el bug no se veía en lo más obvio —la tabla de
cargas aparecía vacía y correcta— y por eso sobrevivió.

## Alcance

No fue de una persona. El cargador de flota de la semana del 2026-07-27 llama al
clonador **12 veces**, una por asesorado. Sumando dos cargas sueltas del mismo
periodo, son ~14 asesorados. (Los archivos `_app-cargar-*.sql` no están en el
repo: llevan nombres y prescripciones reales.)

Una de esas cargas tiene además un problema propio y distinto: construye las
sesiones desde cero y escribe `testPost` a mano con los tres valores en cero
(`jsonb_build_object('duracionMin',0,'rpeSesion',0,'prsEntrada',0)`, cuatro
veces). Eso no es herencia, es fabricación — y deja una firma reconocible.

## Los dos daños

**1 · La persona ve una sesión que nadie hizo.** Abre el lunes y el
calentamiento ya está tildado. Es confuso y, peor, invita a saltárselo.

**2 · Se envenenó la evidencia.** Este es el que costó encontrar.

La app rellena el formulario de registro con la carga, las reps y el RIR
pautados. Pulsar «guardar» sin tocar nada deja series que coinciden exactamente
con la prescripción. Por eso **las series no prueban esfuerzo**, y la forma de
saber si alguien estuvo de verdad en una sesión eran las marcas con hora:
`hechoEn` y `testPost`, que ninguna carga escribía.

Con la herencia, esa premisa se cae: una marca con hora en el microciclo N puede
ser un fósil del N-1. **Toda consulta forense sobre adherencia daba falsos
positivos**, y las daba en la dirección peor: hacía parecer presente a quien no
estuvo.

## Cómo se distingue un fósil de una marca real

Por la fecha. Una marca fechada **antes** del `fechaInicio` de su propio
microciclo no puede pertenecerle: es del anterior y viajó en el clon. Ese es el
criterio de borrado, y es conservador por construcción — lo posterior al inicio
no se toca nunca.

El `testPost` no se puede fechar: `TestPostSesion` (`src/domain/types.ts:77-81`)
solo lleva `duracionMin`, `rpeSesion` y `prsEntrada`. Para ese se usan dos
pistas indirectas:

- Un test en una sesión **sin marcas reales y sin series** es un test que nadie
  pudo llenar.
- Un test con los tres valores en cero lo escribió un SQL: es la firma de la
  carga que los fabricaba a mano.

## El arreglo

| Archivo | Va al repo | Qué hace |
|---|---|---|
| `supabase/plantilla-carga-microciclo.sql` | sí | Molde del clonador, con `tmp_sesion_en_limpio()` envolviendo cada sesión. **Toda carga nueva sale de aquí.** |
| `supabase/comprobar-fosiles.sql` | sí | Diagnóstico de solo lectura, por asesorado y sesión a sesión. Cero filas = limpio. |
| `supabase/_app-limpiar-fosiles.local.sql` | no (`*.local.sql`) | Limpieza de lo ya cargado. Con respaldo, foto antes/después y rollback. |

La regla que queda: **un microciclo nuevo nace sin rastro de ejecución.** Se
hereda la prescripción; lo que la persona hizo, nunca. `tmp_sesion_en_limpio()`
es el único punto donde se decide qué no se hereda — si se añade un campo de
ejecución a `Sesion`, va ahí también.

## Dos cosas que aparecieron por el camino

**`create function` expone RPC.** Concede `EXECUTE` a `PUBLIC` por defecto, y
todo lo que vive en `public` se publica como RPC. Una función que **escribe**
microciclos quedaba al alcance de la anon key. Por eso la plantilla lleva
`revoke execute … from public` bajo cada función y las borra al terminar. Es el
mismo agujero que documenta `GUIA-BRYAN.md` §10 con `buscar_ficha`.

**`create table as` no hereda RLS.** Un respaldo de microciclos creado sin
`enable row level security` queda legible con la anon key: son datos de salud de
personas reales. Los dos scripts de limpieza activan RLS en el mismo paso que
crean la tabla.

## Verificación

1. `comprobar-fosiles.sql` antes de limpiar — guardar la salida.
2. Limpieza por pasos. `marcas_reales` y `ejercicios_con_series` tienen que
   salir **idénticas** en la foto de después: si bajan, la limpieza se llevó
   algo real y hay que volver atrás con el respaldo.
3. `comprobar-fosiles.sql` después: cero filas.
4. En cada carga futura, correr el diagnóstico antes de repartir la semana.

## Lo que queda pendiente

- **Aplicar la limpieza en producción.** El repo no es la realidad en este
  proyecto: el SQL se pega a mano en el panel. Hasta que se pegue, los ~14
  asesorados siguen con los fósiles.
- **Rehacer las cargas sueltas sobre la plantilla.** Los `_app-cargar-*.sql`
  existentes conservan el clonador viejo; si alguno se reutiliza como base, el
  bug vuelve.
- **Decidir qué hacer con los `testPost` en ceros** de la carga que los fabricó.
  Caen bajo la guarda del paso 4 solo si esas sesiones no tienen rastro real;
  conviene mirarlas una por una.
- **Considerar un test de dominio** que fije la regla en `src/domain/`, para que
  no dependa solo de que la próxima carga copie el archivo correcto.
