-- 0146 · Registro del recordatorio de las 6 pm del check-in (Edge Function avisos-plan).
--
-- Una fila por persona y día: es el «máximo un recordatorio al día» y sirve para no duplicar aunque dos
-- corridas del cron se pisen. La función reserva la fila ANTES de enviar (índice único + ignore-duplicates).
-- Es la hermana de `avisos_plan_enviados` (0099), que cuelga de `plan_items` y solo admite a Bryan y Manuela:
-- los asesorados no tienen tarea a la que colgar el aviso, por eso es otra tabla.
--
-- Solo escribe service_role (la Edge Function). Ningún rol de la app la lee ni la escribe: se revoca todo
-- antes de conceder, la regla de siempre (lección de la 0084). Sin datos de salud: solo quién y cuándo.

begin;

create table if not exists public.avisos_checkin_enviados (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios_app (id) on delete cascade,
  fecha_aviso date not null,
  enviado_en  timestamptz not null default now()
);

comment on table public.avisos_checkin_enviados is
  'Recordatorios push del check-in de las 6 pm (0146, 2026-10-28). Uno por persona y día. Solo service_role.';

create unique index if not exists avisos_checkin_enviados_uno_por_persona_y_dia
  on public.avisos_checkin_enviados (usuario_id, fecha_aviso);

alter table public.avisos_checkin_enviados enable row level security;
revoke all on public.avisos_checkin_enviados from anon, authenticated, public;
grant all on public.avisos_checkin_enviados to service_role;
-- Sin políticas: con RLS encendida y sin privilegios, ni authenticated ni anon ven ni tocan nada.

commit;
