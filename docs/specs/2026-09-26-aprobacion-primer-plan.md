# Aprobación del primer plan en la consola (2026-09-26)

## Decisión (Bryan, 26-sep)

El **primer plan** de un cliente nuevo (el que llega por la cola de la landing) lo aprueba
Manuela **en la app**, con un plazo. Si el perfil es de **riesgo bajo** y **no hay dudas**
que frenen la progresión, al vencer el plazo **pasa sin firma**. Lo clínico (cribado rojo,
cambios de salud declarados) **nunca pasa solo**: espera a Bryan.

No es la firma SSH de recortes/retiros de clientes existentes (0083/0084): esa sigue siendo
de Bryan y no cambia.

## Qué se construye

### Base de datos — migración `0086_aprobacion_primer_plan.sql`

- **Capacidad nueva `aprobar_primer_plan`** en el `check` de `capacidades_staff` (se
  localiza el check por definición, como hizo la 0084 con `ordenes.tipo`). Se asigna a
  Manuela (`aa202ff5-…`) y a Bryan (`28c3cfe8-…`) con un `insert … select … from
  usuarios_app where id in (…)`: en el CI, donde no existen, no inserta nada y no falla.
- **Tabla `aprobaciones_primer_plan`**: `usuario_id`, `microciclo_id` (el plan propuesto,
  `unique`), `estado` (`propuesto` → `aprobado` | `rechazado` | `vencido_aprobado` |
  `espera_bryan`), `riesgo` (`bajo` | `medio` | `alto`), `motivo_riesgo`,
  `dudas_pendientes text[]`, `plazo_hasta` (por defecto +48 h), `decidido_por`, `motivo`,
  `decidido_en`, `motivo_espera`, fechas.
  - Checks: rechazar exige motivo; `aprobado`/`rechazado` exigen autor y fecha;
    `vencido_aprobado` solo es posible con riesgo bajo, sin dudas y **sin autor**.
  - Un solo pendiente (`propuesto`/`espera_bryan`) por persona (índice único parcial).
  - Trigger de alta: el microciclo tiene que ser **de esa persona** y estar `propuesto`.
  - RLS: lee quien tenga `leer_entrenamiento`. El asesorado no ve ni su fila. `anon` nada;
    `authenticated` solo `select` (se le revoca insert/update/delete/truncate — lección de
    la 0084).
- **RPC `decidir_primer_plan(aprobacion_id, decision, motivo)`** — `security definer`,
  `search_path = public`, actor = `auth.uid()`:
  - exige `aprobar_primer_plan`; `decision` ∈ `aprobar` | `rechazar`;
  - solo sobre `propuesto`/`espera_bryan`; rechazar exige motivo;
  - aprobar un riesgo `alto` o algo en `espera_bryan` exige además `autorizar_excepcion`
    (Bryan);
  - aprobar comprueba que el microciclo sigue `propuesto` y lo **publica** con
    `activar_microciclo()` en la misma transacción (el camino que ya usa la app, que
    respeta «un solo activo», 0069).
- **`vencer_primer_plan()`** — solo `service_role` (cron o la propia cola). Para cada
  `propuesto` con el plazo vencido: si es riesgo bajo, sin dudas y el microciclo sigue
  propuesto → `vencido_aprobado` + `activar_microciclo`; si no → `espera_bryan` con
  `motivo_espera` escrito. Cada fila en su subtransacción: si publicar falla, esa fila
  espera a Bryan y las demás siguen. Devuelve `(aprobados, a_bryan)`.

Pruebas: `supabase/test/95-consola-primer-plan.sql` (en el CI, job `base-de-datos`):
Manuela aprueba bajo y el microciclo queda activo; no aprueba alto ni lo que espera a
Bryan (sí puede rechazar); rechazar sin motivo falla; nadie escribe la tabla sin la RPC;
el asesorado no ve nada; staff sin la capacidad no decide; `authenticated` no llama a
`vencer_primer_plan`; el vencimiento pasa solo el bajo sin dudas y deja medio y
bajo-con-dudas en `espera_bryan`; lo que no ha vencido no se toca; la fila no puede
apuntar al microciclo de otra persona. Señales nuevas en
`supabase/comprobar-migraciones.sql`.

### App

- `src/domain/consolaCoach/primerPlan.ts`: cuenta atrás, quién puede decidir, qué pasará al
  vencer, orden de la bandeja y resumen legible del plan propuesto. Puro, con pruebas.
- `src/data/consola/primerosPlanes.ts`: lee los pendientes, lee el plan propuesto
  (`microciclos.datos`, abierto a `leer_entrenamiento` desde la 0083) y llama a la RPC.
- `src/features/coach/consola/BandejaPrimerosPlanes.tsx`, arriba de «Revisión de la
  semana». **Solo visible con `aprobar_primer_plan`.** Por persona: semáforo de riesgo,
  motivo del riesgo, dudas, cuenta atrás (en rojo por debajo de 6 h), qué pasará si nadie
  decide, «Ver ficha», «Ver el plan propuesto» (se lee al abrirlo) y Aprobar / Rechazar.
  Confirmación **en sitio** (nunca `confirm()`/`prompt()`); rechazar pide motivo
  obligatorio; la marca «✓ Aprobado y publicado · hh:mm» aparece donde se pulsó, con el
  mismo movimiento de la consola del PR #316 (`consola-tarjeta`, `consola-confirmacion`,
  `consola-panel-entra`, sin animación con movimiento reducido).

## Qué NO hace esta migración

- **El cron, solo donde hay `pg_cron`.** La 0086 programa `vencer-primer-plan` cada 15 min
  si la extensión está disponible (mismo patrón que la 0048); en el CI no la hay y no
  programa nada. Tras aplicarla, comprobar con `select * from cron.job where jobname =
  'vencer-primer-plan'`. La cola puede llamarla igual en cada pasada.
- **No crea las filas.** Las crea la cola de la landing (contrato abajo).
- **No se aplica sola**: fusionar no aplica (`migracion-y-codigo-van-por-su-lado`).

## Contrato para la cola de la landing (quien crea la fila `propuesto`)

Cuando la cola genera el primer plan de una persona nueva, con `service_role` y en **una
transacción**:

1. Inserta el microciclo con `estado = 'propuesto'` (nunca `activo`): `id`, `usuario_id`,
   `numero = 1`, `datos` completo (sin `estado` en el blob, 0066).
2. Inserta en `aprobaciones_primer_plan`:
   - `usuario_id`, `microciclo_id` (el del paso 1);
   - `riesgo`: `alto` si el cribado sale **rojo** o hay **cambios de salud declarados**
     (lo clínico); `medio` si hay ámbar (p. ej. medicación crónica) o cualquier señal que
     pida ojo humano; `bajo` en otro caso;
   - `motivo_riesgo`: una frase en llano de por qué ese riesgo (sin datos de más);
   - `dudas_pendientes`: las dudas que frenan la progresión (lista vacía si no hay);
   - `plazo_hasta`: por defecto `now() + 48 h` (lo decide la cola si Bryan fija otro).
3. Si ya hay un pendiente para esa persona, el índice único lo impide: la cola no debe
   proponer un segundo plan mientras el primero no se decida (un `rechazado` sí deja
   proponer otro).
4. Llama a `vencer_primer_plan()` en cada pasada (o se deja al cron).
5. Para saber qué pasó: `estado` en `aprobado`/`vencido_aprobado` → el microciclo ya está
   `activo` (lo publicó la base); `rechazado` → leer `motivo` y proponer otro;
   `espera_bryan` → no hacer nada, es de Bryan.
