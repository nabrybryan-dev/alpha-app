-- 0148 · Alertas nutricionales para la nutricionista (H-02). NO APLICADA: la aplica Bryan.
--
-- Dos tablas, ambas solo de la nutricionista:
--   alertas_nutricion_ajustes  el interruptor, UNA fila por alerta, APAGADA por defecto. Una alerta
--                              no se puede encender sin firma (check): firmada_por (no vacío) y firmada_en.
--                              Solo la escribe service_role / Bryan desde el SQL Editor, cuando
--                              Manuela firma la hoja. Ningún rol de la app la escribe.
--   alertas_nutricion          las alertas levantadas por la Edge Function avisos-plan. Una ABIERTA
--                              por persona y alerta (índice único parcial). El detalle (quién, qué,
--                              por qué) se lee solo dentro de la app, con sesión de nutricionista; el aviso
--                              del teléfono no lleva datos de salud.
-- Lee SOLO es_nutricionista() (0067): el detalle, con el nombre del asesorado, lo ve Manuela y no un coach (decisión de Bryan, 29-oct). Escribe solo service_role. RLS en el mismo paso que la tabla.

begin;

create table if not exists public.alertas_nutricion_ajustes (
  clave          text primary key check (clave in ('objetivo_insuficiente', 'hambre_sostenida')),
  encendida      boolean not null default false,
  firmada_por    text,
  firmada_en     timestamptz,
  actualizado_en timestamptz not null default now(),
  constraint alertas_nutricion_ajustes_no_sin_firma
    check (not encendida or (length(btrim(coalesce(firmada_por, ''))) > 0 and firmada_en is not null))
);

insert into public.alertas_nutricion_ajustes (clave) values ('objetivo_insuficiente'), ('hambre_sostenida')
  on conflict (clave) do nothing;

create table if not exists public.alertas_nutricion (
  id           uuid primary key default gen_random_uuid(),
  asesorado_id uuid not null references public.usuarios_app (id) on delete cascade,
  clave        text not null check (clave in ('objetivo_insuficiente', 'hambre_sostenida')),
  detalle      text not null,
  creada_en    timestamptz not null default now(),
  avisada_en   timestamptz,
  resuelta_en  timestamptz
);

create unique index if not exists alertas_nutricion_una_abierta
  on public.alertas_nutricion (asesorado_id, clave) where resuelta_en is null;

alter table public.alertas_nutricion_ajustes enable row level security;
alter table public.alertas_nutricion enable row level security;

revoke all on public.alertas_nutricion_ajustes from anon, authenticated, public;
revoke all on public.alertas_nutricion from anon, authenticated, public;
grant select on public.alertas_nutricion_ajustes to authenticated;
grant select on public.alertas_nutricion to authenticated;
grant all on public.alertas_nutricion_ajustes to service_role;
grant all on public.alertas_nutricion to service_role;

drop policy if exists "alertas ajustes: lee la nutricionista" on public.alertas_nutricion_ajustes;
create policy "alertas ajustes: lee la nutricionista" on public.alertas_nutricion_ajustes
  for select to authenticated using (public.es_nutricionista());

drop policy if exists "alertas nutricion: lee la nutricionista" on public.alertas_nutricion;
create policy "alertas nutricion: lee la nutricionista" on public.alertas_nutricion
  for select to authenticated using (public.es_nutricionista());

commit;
