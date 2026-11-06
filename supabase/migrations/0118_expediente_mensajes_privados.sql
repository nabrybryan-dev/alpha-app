-- PROTOTYPE ONLY. D-14-11(b): isolated synthetic private-message expediente.
-- NOT APPLIED. It is not connected to the gate, alerts, or application routes.
begin;

create table if not exists public.expediente_mensajes_privados (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.usuarios_app(id) on delete cascade,
  coach_asignado_id uuid not null references public.usuarios_app(id) on delete restrict,
  mensaje_completo text not null check (length(btrim(mensaje_completo)) > 0),
  recibido_en timestamptz not null default now()
);

create index if not exists expediente_privado_persona_recibido
  on public.expediente_mensajes_privados (persona_id, recibido_en desc);
create index if not exists expediente_privado_coach_recibido
  on public.expediente_mensajes_privados (coach_asignado_id, recibido_en desc);

alter table public.expediente_mensajes_privados enable row level security;
revoke all on public.expediente_mensajes_privados from anon, public, authenticated;
grant select on public.expediente_mensajes_privados to authenticated;
grant all on public.expediente_mensajes_privados to service_role;

create policy expediente_mensajes_privados_leer
  on public.expediente_mensajes_privados for select to authenticated
  using (
    (select auth.uid()) = persona_id
    or (select auth.uid()) = coach_asignado_id
  );

comment on table public.expediente_mensajes_privados is
  'Prototype only: full message in a separate private record; read by its owner and explicitly assigned coach.';

commit;
