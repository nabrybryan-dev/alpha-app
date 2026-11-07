-- ============================================================================
-- 0166 · Praxis: la memoria de la charla entre días (praxis_charla_turnos)
-- ============================================================================
--
-- SIN APLICAR (6-nov-2026). Escrita con pruebas, en rama y PR borrador, por decisión de Bryan: aplicar es otro
-- «sí» suyo. Se aplica a mano en el SQL Editor y se comprueba con su fila en `comprobar-migraciones.sql`.
-- Hoy nada de la app la usa (esta pieza es solo la base): si falta, no se rompe nada.
--
-- NÚMERO. 0166 = el siguiente libre. Revisadas el 6-nov las migraciones de origin/main y de todas las ramas
-- locales y remotas: main llega a 0162; `praxis/agua-deshacer` tiene 0163; `claude/c3-derechos-20261105` tiene
-- 0164 y 0165; ninguna rama tiene 0166 o más. Si otra rama lo toma antes de aplicar, renumerar esta.
--
-- QUÉ PEDIDO RESUELVE. Decisión de Bryan (6-nov-2026): la memoria de Praxis entre días guarda LA CHARLA COMPLETA.
-- Una fila por turno (lo que dijo la persona y lo que contestó Praxis), agrupada por `charla_id` (una sesión de
-- charla). Diseño de origen: PIEZA-RANURAS.md, sección «memoria de la charla completa entre días».
--
-- QUIÉN PUEDE QUÉ (mismo patrón que 0159 y 0161: `usuario_id = auth.uid()` y `es_staff()`; no hay rol nuevo).
--   · LEER: la persona dueña (`usuario_id = auth.uid()`) y el equipo (`es_staff()`: coach y nutricionista).
--   · INSERTAR: la persona, solo a su nombre. `usuario_id` NO tiene privilegio de insert: lo pone el valor por
--     omisión `auth.uid()`, así el cliente ni siquiera puede intentar mandar el de otra persona; además el
--     `with check` lo vuelve a comprobar. `borrar_en`, `id` y `creado_en` tampoco se mandan.
--   · ACTUALIZAR / BORRAR con sesión: nadie, directo. Dos funciones `security definer`:
--       - `praxis_borrar_mi_charla(charla_id)`: la persona borra una charla SUYA al instante (usa auth.uid()).
--       - `praxis_purgar_charlas()`: borra lo que ya cumplió su plazo. Solo service_role (y pg_cron).
--   · anon: nada. Las dos funciones llevan `revoke … from public, anon`.
--   · Al borrarse la cuenta (`usuarios_app`), cascada.
--
-- PLAZO DE BORRADO. 90 días desde el turno (`borrar_en` por omisión = now() + 90 días). La cifra es propuesta del
-- diseño; la firma Bryan. Mecanismo: el mismo que la 0149 y la 0048 — función de purga + `pg_cron` si existe
-- (diario, 08:30 UTC = 03:30 en Bogotá); sin pg_cron (como en el Postgres limpio del CI) no se programa nada y la
-- función se llama a mano con service_role.
--
-- DIFERENCIAS CON EL DISEÑO (ver PIEZA-MEMORIA-MIGRACION.md):
--   · Una tabla de turnos, no dos (`praxis_charlas` + turnos): la charla es solo un `charla_id`; no hay nada que
--     guardar de la charla aparte de sus turnos.
--   · El equipo (`es_staff()`) lee el TEXTO completo, no solo el resumen: así están hechas las demás tablas praxis_*
--     (0159, 0161, 0108). El diseño decía «el coach ve el resumen, texto completo solo si la persona lo autoriza»;
--     eso exigiría una relación coach-asesorado que el repo no usa en las tablas parecidas. Lo decide Bryan.
--   · Los turnos marcados como clínicos se guardan con el TEXTO completo (el diseño proponía solo marca + palabra,
--     «salvo que Bryan decida lo contrario»; su decisión fue guardar la charla completa). `marcado_clinico` y
--     `aviso_coach` quedan como columnas para poder filtrar o decidir después.
--
-- CÓMO REVERTIRLA (solo si no importa lo guardado):
--   begin;
--   select cron.unschedule('purgar-charlas-praxis') where exists (select 1 from cron.job where jobname = 'purgar-charlas-praxis');
--   drop function if exists public.praxis_purgar_charlas();
--   drop function if exists public.praxis_borrar_mi_charla(uuid);
--   drop table if exists public.praxis_charla_turnos;
--   commit;
-- ============================================================================

begin;

create table if not exists public.praxis_charla_turnos (
  id              uuid primary key default gen_random_uuid(),
  -- De quién es la charla. Lo pone el valor por omisión (auth.uid()); el cliente no lo manda.
  usuario_id      uuid not null default auth.uid() references public.usuarios_app (id) on delete cascade,
  -- La sesión de charla a la que pertenece el turno y su orden dentro de ella.
  charla_id       uuid not null,
  n               int  not null check (n between 0 and 9999),
  -- Quién habló.
  rol             text not null check (rol in ('persona', 'praxis')),
  texto           text not null check (length(btrim(texto)) between 1 and 2000),
  marcado_clinico boolean not null default false,
  aviso_coach     boolean not null default false,
  creado_en       timestamptz not null default now(),
  -- Cuándo se borra solo (90 días).
  borrar_en       timestamptz not null default (now() + interval '90 days'),
  constraint praxis_charla_turnos_orden_unico unique (usuario_id, charla_id, n),
  constraint praxis_charla_turnos_plazo_coherente check (borrar_en > creado_en)
);

comment on table public.praxis_charla_turnos is
  'Memoria de la charla de Praxis entre dias (0166, 2026-11-06): un turno por fila, charla completa, borrado a los 90 dias (borrar_en). '
  'Lee la persona lo suyo y el equipo (es_staff); inserta la persona a su nombre (usuario_id = auth.uid() por omision); '
  'nadie actualiza ni borra directo: praxis_borrar_mi_charla (la persona) y praxis_purgar_charlas (service_role/pg_cron).';

-- La clave única de arriba ya sirve para leer una charla en orden. Este índice es para la purga diaria.
create index if not exists praxis_charla_turnos_por_borrar
  on public.praxis_charla_turnos (borrar_en);

-- Para «las charlas recientes de esta persona» sin recorrer todos sus turnos.
create index if not exists praxis_charla_turnos_recientes
  on public.praxis_charla_turnos (usuario_id, creado_en desc);

alter table public.praxis_charla_turnos enable row level security;

drop policy if exists praxis_charla_turnos_leer_propio on public.praxis_charla_turnos;
create policy praxis_charla_turnos_leer_propio on public.praxis_charla_turnos
  for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists praxis_charla_turnos_lee_staff on public.praxis_charla_turnos;
create policy praxis_charla_turnos_lee_staff on public.praxis_charla_turnos
  for select to authenticated
  using ((select public.es_staff()));

drop policy if exists praxis_charla_turnos_insertar_propio on public.praxis_charla_turnos;
create policy praxis_charla_turnos_insertar_propio on public.praxis_charla_turnos
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

revoke all on public.praxis_charla_turnos from anon, public;
revoke all on public.praxis_charla_turnos from authenticated;
grant select on public.praxis_charla_turnos to authenticated;
grant insert (charla_id, n, rol, texto, marcado_clinico, aviso_coach) on public.praxis_charla_turnos to authenticated;
grant all on public.praxis_charla_turnos to service_role;

-- ---------------------------------------------------------------------------
-- Borrar mi charla (la persona, al instante)
-- ---------------------------------------------------------------------------
create or replace function public.praxis_borrar_mi_charla(p_charla_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_filas int;
begin
  if v_uid is null then
    raise exception 'praxis_borrar_mi_charla: hace falta una sesion' using errcode = '42501';
  end if;
  if p_charla_id is null then
    raise exception 'praxis_borrar_mi_charla: falta charla_id' using errcode = '22023';
  end if;
  delete from public.praxis_charla_turnos t
   where t.usuario_id = v_uid and t.charla_id = p_charla_id;
  get diagnostics v_filas = row_count;
  return v_filas;
end
$$;

comment on function public.praxis_borrar_mi_charla(uuid) is
  'La persona borra una charla SUYA (usa auth.uid(); no recibe usuario_id). Devuelve los turnos borrados. 0166.';

revoke all on function public.praxis_borrar_mi_charla(uuid) from public, anon;
grant execute on function public.praxis_borrar_mi_charla(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Purga de lo que ya cumplió su plazo
-- ---------------------------------------------------------------------------
create or replace function public.praxis_purgar_charlas()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_filas int;
begin
  delete from public.praxis_charla_turnos where borrar_en < now();
  get diagnostics v_filas = row_count;
  return v_filas;
end
$$;

comment on function public.praxis_purgar_charlas() is
  'Borra los turnos de charla de Praxis cuyo borrar_en ya paso (90 dias). Idempotente. Solo service_role y pg_cron; devuelve las filas borradas. 0166.';

revoke all on function public.praxis_purgar_charlas() from public, anon, authenticated;
grant execute on function public.praxis_purgar_charlas() to service_role;

-- ── El cron, aparte y con la misma cautela que la 0048 y la 0149 ─────────────
-- Diario a las 08:30 UTC (03:30 en Bogotá). Sin pg_cron no se programa nada y no se rompe nada.
do $cron_setup$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    if exists (select 1 from cron.job where jobname = 'purgar-charlas-praxis') then
      perform cron.unschedule('purgar-charlas-praxis');
    end if;
    perform cron.schedule('purgar-charlas-praxis', '30 8 * * *', 'select public.praxis_purgar_charlas();');
    raise notice 'Purga de charlas de Praxis programada a diario (08:30 UTC).';
  else
    raise notice 'pg_cron no esta disponible aqui: las charlas no se purgan solas. Llamar public.praxis_purgar_charlas() con service_role.';
  end if;
end
$cron_setup$;

commit;
