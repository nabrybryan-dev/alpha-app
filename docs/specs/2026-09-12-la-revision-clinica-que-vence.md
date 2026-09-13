# La revisión clínica que vence — 2026-09-12

## Qué

Una tabla `reevaluaciones_clinicas` (solo staff) y una columna nueva, `reevaluacion`, en el
export de `public.mesa_del_sabado()`: la revisión clínica **abierta** de cada persona con
microciclo activo, cuándo vence y si la persona ha escrito algo desde que se le preguntó.

## Por qué

Decisión de Bryan del 2026-09-12 (en `cerebro-alpha`, `agentes/INVARIANTES.md`, I-30,
«riesgo escalonado»): una zona clínica amarilla sin firma **ya no para el plan**. Se programa
y a la persona se le deja en el chat una pregunta concreta; se vuelve a mirar a los 10-15 días
(5-7 si el riesgo es alto). Sus palabras: *«si pasan diferentes semanas sin esa información, de
pronto ya se paran los planes»*.

La pregunta ya llega al chat (el ④ de `cerebro-alpha` genera el `INSERT` en `mensajes` con
`tuberia/sql_pregunta_clinica.py`). Lo que faltaba es que **alguien se acuerde de la fecha**: la
mesa del sábado es donde el coach mira cada semana, y hoy no tiene de dónde leerla.

## Dónde vive, y por qué no dentro del microciclo

No en `microciclos.datos`: ese blob lo escribe la app desde su propio modelo, y una clave que
la app no conoce no está garantizada. Una tabla propia, con su RLS, la escribe el ④ en el
mismo bloque que el mensaje, y la mesa la lee.

## Lo que NO hace

- No cambia nada de `src/`: la app no lee la tabla.
- No decide qué hacer con una revisión vencida: eso es de `agentes/mesa_del_sabado.py`.
- No cierra revisiones sola. Se cierran al abrir la siguiente para la misma persona (el índice
  único solo admite una abierta) o a mano con `cerrada_en`.

## Seguridad

- Tabla solo staff, mismo patrón que la `0053` (`es_staff()`), sin nada para `anon`.
- `mesa_del_sabado()` sigue siendo de **invocador** (no `security definer`): un asesorado que la
  llame por RPC solo ve lo que su RLS le deja, y de esta tabla, nada.

## Cómo se comprueba

- Señal en `supabase/comprobar-migraciones.sql`: la tabla existe con RLS, `anon` no la lee, y la
  función menciona la tabla.
- Antes de aplicar: la migración entera dentro de una transacción deshecha, y el export sigue
  devolviendo las mismas personas que antes.
