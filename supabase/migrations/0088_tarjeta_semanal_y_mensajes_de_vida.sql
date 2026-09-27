-- ============================================================================
-- 0088 · Estilo de vida: la tarjeta semanal y la bandeja de mensajes
-- ============================================================================
--
-- NÚMERO. `main` llega a la 0087 (`aprobacion_plan_estrategico_renovado`). Comprobado el
-- 27-sep contra `origin/main`, `mcp__supabase__list_migrations` (última aplicada:
-- `aprobacion_plan_estrategico_renovado`, sin número en el nombre pero la 0087 por
-- contenido) y las ramas remotas vivas: ninguna trae una 0088. Es el siguiente libre.
--
-- QUÉ ENTRA AQUÍ. Dos tablas nuevas para el agente de estilo de vida
-- (`cerebro-alpha` rama `planes/estilo-de-vida-2`, `agentes/estilo_vida.py` +
-- `agentes/cola_mensajes_vida.py`), que hoy vive fuera de la base y escribe a un
-- directorio de estado (`ALPHA_ESTADO_DIR`). Esta migración le da a esa cola un sitio
-- donde escribir que el navegador pueda leer con RLS, y a la consola un sitio donde leer
-- lo que la persona respondió. Contrato completo (columna por columna, diferencias con el
-- schema de la cola, qué falta a propósito): `docs/specs/2026-09-27-mensajes-de-estilo-de-
-- vida.md`. Las 7 preguntas de la tarjeta (texto exacto, escalas): `src/domain/
-- tarjetaVida.ts`, que cita a su vez `DISENO-AGENTE-ESTILO-DE-VIDA.md` §2.
--
--   1. `tarjetas_vida` — las 7 preguntas semanales (V1..V7, catálogo
--      `catalogo-vida-v2.json`; V7 añadida el 26-sep: rendimiento laboral/académico
--      comparado con una semana normal, 1-5). El ASESORADO la responde desde la app; el
--      dueño inserta y lee la suya, y quien tenga `leer_entrenamiento` (0083) lee todas —
--      es la misma capacidad con la que la consola ya lee microciclos y check-ins.
--      Sin política de update ni de delete: una tarjeta ya respondida no se reescribe —
--      "el domingo, o si no se contestó esa semana" es cuándo se OFRECE en la app, no una
--      licencia para pisar la respuesta de otra semana. Única por persona y semana
--      (`unique (usuario_id, semana_inicio)`): dos respuestas de la misma semana son un
--      conflicto de aplicación, no dos hechos distintos.
--
--   2. `mensajes_vida` — la proyección legible de `cola_mensajes_vida.py` (mismo contrato
--      que `agentes/estilo-vida/contratos/mensaje_vida.schema.json`, recortado a lo que la
--      app necesita mostrar: sin `id` de cola, `clave_persona` ni `fuentes`, que son
--      internos del agente). Escribe SOLO `service_role` — igual que `cadena_corridas` y
--      `planes_estrategicos` (0083): la cola de Python usa la clave de servicio, nunca la
--      anon key ni una sesión de usuario. El asesorado SOLO lee los suyos, y solo los que
--      ya tocan enviarse y no están detenidos (`enviar_despues_de <= now() and
--      detenido_en is null`) — un mensaje "pendiente" antes de su ventana, o uno que Bryan
--      detuvo, no es una fuga si nadie puede leerlo por la API; aquí además NO llega ni
--      con `select *`, porque la condición está en la propia política, no en la app.
--
-- QUÉ NO ENTRA. El *envío* de verdad (WhatsApp/push) sigue sin existir — la cola de Python
-- documenta "EN SECO: nada de aquí ENVÍA" y esto tampoco lo resuelve; es la proyección que
-- un futuro job puede escribir. Tampoco entra la escritura desde la app de las respuestas
-- V1..V6 del check-in diario (ya viven en `checkins`, 0001): esta tabla es SOLO la tarjeta
-- semanal de 7 preguntas, que es una superficie distinta con su propia cadencia.
--
-- SEGURIDAD, la misma regla de siempre (`GUIA-BRYAN.md` §10): `create table` enciende RLS
-- en el mismo paso y pierde sus privilegios por defecto con `revoke all from anon, public`
-- antes de conceder nada. Ninguna función `security definer` nueva hace falta aquí:
-- `tiene_capacidad()` y `es_coach()` ya existen desde la 0083/0085.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · TARJETAS_VIDA
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.tarjetas_vida (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.usuarios_app(id) on delete cascade,
  -- El LUNES de la semana que la tarjeta describe (misma convención que
  -- `cadena_corridas.semana_inicio` y `agentes/estilo_vida.py::lunes_de`). No "cuándo se
  -- respondió" — eso es `creado_en` — sino DE QUÉ SEMANA habla.
  semana_inicio  date not null,
  -- V1..V7, tal como las define `catalogo-vida-v2.json`. Forma abierta a propósito: el
  -- catálogo vive versionado en `cerebro-alpha` (`indice_adaptacion.pregunta_vida` para
  -- V7) y esta tabla no repite su esquema — lo haría divergir en silencio el día que el
  -- catálogo suba de versión. Cada clave ausente es "se saltó esa pregunta", no un cero.
  respuestas     jsonb not null default '{}'::jsonb,
  creado_en      timestamptz not null default now(),
  unique (usuario_id, semana_inicio)
);

comment on table public.tarjetas_vida is
  'La tarjeta semanal de 7 preguntas del agente de estilo de vida (V1..V7). El dueño '
  'inserta y lee la suya; quien tenga la capacidad leer_entrenamiento lee todas. Sin '
  'update ni delete: una tarjeta respondida no se reescribe.';

create index if not exists tarjetas_vida_por_usuario
  on public.tarjetas_vida (usuario_id, semana_inicio desc);

alter table public.tarjetas_vida enable row level security;

create policy tarjetas_vida_insertar_propia on public.tarjetas_vida
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

create policy tarjetas_vida_leer on public.tarjetas_vida
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

-- Sin política de update/delete: ni el dueño ni el coach pisan una tarjeta ya respondida
-- por la API. Corregir un error de captura es cosa de `service_role`, no de este flujo.
revoke all on public.tarjetas_vida from anon, public;
grant select, insert on public.tarjetas_vida to authenticated;
grant all on public.tarjetas_vida to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · MENSAJES_VIDA
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.mensajes_vida (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references public.usuarios_app(id) on delete cascade,
  texto               text not null check (length(btrim(texto)) > 0),
  -- Mismo enum que `agentes/estilo-vida/contratos/mensaje_vida.schema.json`. `ayuda_animo`
  -- sale inmediato (ventana de 0h); `prescripcion_vida` espera 2h — esa lógica vive en
  -- `cola_mensajes_vida.py` (quien escribe `enviar_despues_de`), no aquí: esta tabla solo
  -- guarda el resultado, no decide la ventana.
  tipo                text not null check (tipo in ('prescripcion_vida', 'ayuda_animo')),
  enviar_despues_de   timestamptz not null,
  enviado_en          timestamptz,
  -- La orden de detener MÁS RECIENTE manda y el tiempo nunca reanuda nada (mismo patrón
  -- que `tuberia/verificar_carga._orden_detener_vigente`): `service_role` limpia este
  -- campo si alguien reanuda, en vez de guardar aquí una lista de órdenes.
  detenido_en         timestamptz,
  creado_en           timestamptz not null default now()
);

comment on table public.mensajes_vida is
  'Proyección legible de la cola de mensajes de estilo de vida (cola_mensajes_vida.py, '
  'cerebro-alpha). Escribe SOLO service_role. El asesorado lee los suyos con '
  'enviar_despues_de <= now() y detenido_en is null.';

create index if not exists mensajes_vida_por_usuario
  on public.mensajes_vida (usuario_id, enviar_despues_de desc);

alter table public.mensajes_vida enable row level security;

create policy mensajes_vida_leer on public.mensajes_vida
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    and enviar_despues_de <= now()
    and detenido_en is null
  );

-- Sin política de insert/update/delete: nadie escribe por la API, ni con sesión de
-- usuario ni con la anon key. Solo `service_role` (bypassa RLS) inserta y actualiza
-- `enviado_en`/`detenido_en` — la misma regla que `cadena_corridas` y
-- `planes_estrategicos` (0083).
revoke all on public.mensajes_vida from anon, public;
grant select on public.mensajes_vida to authenticated;
grant all on public.mensajes_vida to service_role;

commit;
