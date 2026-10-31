-- La salud de Hermes en la consola del coach (0152, ALARMA-1, 30-oct-2026).
--
-- QUÉ ES. Una fila por pieza del minipc (puerta, hermes, custodio) con su estado y la hora a la
-- que el vigía la vio por última vez. La escribe SOLO el vigía (service_role, o el SQL Editor);
-- el puesto de coach la lee para pintar una tarjeta en «Mi día».
--
-- QUÉ NO ES. No guarda nada de personas: ni usuario_id, ni texto libre. Pieza y estado son listas
-- cerradas (check); la hora la pone la base. `observaciones_agente` no sirve para esto: exige el
-- usuario_id de una persona.
--
-- POR QUÉ LA HORA ES LO QUE MANDA. Un minipc apagado no escribe nada, y una tabla con «arriba» de
-- hace tres horas parece sana. Por eso la app no se fía del estado sino de `visto_en`: si el más
-- reciente tiene más de 45 minutos, o no hay filas, la tarjeta dice que NO HAY SEÑAL.
--
-- NÚMERO. 0152: la rama del atajo de salud ya usa la 0151.

begin;

create table if not exists public.salud_hermes (
  pieza    text primary key check (pieza in ('puerta', 'hermes', 'custodio')),
  estado   text not null check (estado in ('arriba', 'caido', 'desconocido')),
  visto_en timestamptz not null default now()
);

comment on table public.salud_hermes is
  '0152 (2026-10-30): estado de cada pieza de Hermes en el minipc y cuándo lo vio el vigía. Sin datos de personas. '
  'Escribe service_role o el SQL Editor; lee el puesto de coach.';

alter table public.salud_hermes enable row level security;

drop policy if exists salud_hermes_leer_coach on public.salud_hermes;
create policy salud_hermes_leer_coach on public.salud_hermes
  for select to authenticated
  using ((select public.es_coach()));

revoke all on public.salud_hermes from anon, public;
revoke all on public.salud_hermes from authenticated;
grant select on public.salud_hermes to authenticated;
grant all on public.salud_hermes to service_role;

commit;
