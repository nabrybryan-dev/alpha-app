-- 0099 · Registro de los avisos push del organizador (Edge Function avisos-plan).
--
-- Una fila por aviso enviado: sirve para no duplicar. El índice único (item_id, fecha_aviso) es
-- «máximo 1 aviso por tarea y día», sea del tipo que sea. La función reserva la fila ANTES de
-- enviar, así que dos corridas pisadas no mandan dos avisos.
--
-- Solo escribe service_role (la Edge Function). Ningún rol de la app la lee ni la escribe: se
-- revoca todo antes de conceder, la regla de siempre (lección de la 0084).

begin;

create table if not exists public.avisos_plan_enviados (
  id          uuid primary key default gen_random_uuid(),
  dueno       text not null check (dueno in ('bryan', 'manuela')),
  tipo        text not null check (tipo in ('inicio_bloque', 'atascada')),
  item_id     uuid not null references public.plan_items(id) on delete cascade,
  fecha_aviso date not null,
  enviado_en  timestamptz not null default now()
);

comment on table public.avisos_plan_enviados is
  'Avisos push del organizador (0099, 2026-09-30). Un aviso por tarea y día. Solo service_role.';

create unique index if not exists avisos_plan_enviados_una_por_tarea_y_dia
  on public.avisos_plan_enviados (item_id, fecha_aviso);

alter table public.avisos_plan_enviados enable row level security;
revoke all on public.avisos_plan_enviados from anon, authenticated, public;
grant all on public.avisos_plan_enviados to service_role;
-- Sin políticas: con RLS encendida y sin privilegios, ni authenticated ni anon ven ni tocan nada.

commit;
