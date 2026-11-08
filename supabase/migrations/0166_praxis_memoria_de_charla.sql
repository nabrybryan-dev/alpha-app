-- ============================================================================
-- 0166 · Praxis: la memoria de la charla entre días (praxis_charla_turnos)
-- ============================================================================
--
-- SIN APLICAR (6-nov-2026; reescrita el 7-nov con las decisiones de Bryan sobre quién lee y el plazo). Escrita con pruebas, en rama y PR borrador, por decisión de Bryan: aplicar es otro
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
-- QUIÉN PUEDE QUÉ (decisión de Bryan, 7-nov-2026, tras el informe del custodio de datos: «solo los agentes y yo»).
--   · LEER: solo quien tenga la capacidad `leer_charlas_praxis` (se asigna a mano a las cuentas de Bryan, ver
--     abajo) y los agentes del servidor (service_role). Ni el resto del equipo ni la propia persona la leen por la
--     API: el acceso de la persona a sus datos va por la pantalla de derechos (0165, solicitudes_de_derechos).
--     Antes (6-nov) leía todo `es_staff()`: más ancho que la ficha clínica, que en la base real solo lee el coach
--     asignado (custodio, INFORME-PRAXIS-20261107, hallazgo 1).
--   · ESCRIBIR: solo los agentes del servidor (service_role). El navegador no inserta: así nadie puede escribir
--     turnos con rol 'praxis' ni apagar `marcado_clinico`/`aviso_coach` (custodio, hallazgo 4).
--   · ACTUALIZAR / BORRAR con sesión: nadie, directo. Tres funciones `security definer`:
--       - `praxis_borrar_mi_charla(charla_id)`: la persona borra una charla SUYA al instante (usa auth.uid()).
--       - `praxis_marcar_charla_atendida(usuario_id, charla_id)`: acorta el plazo a 30 días. Solo service_role.
--       - `praxis_purgar_charlas()`: borra lo que ya cumplió su plazo. Solo service_role (y pg_cron).
--   · anon: nada. Al borrarse la cuenta (`usuarios_app`), cascada.
--
-- PLAZO DE BORRADO (decisión de Bryan, 7-nov-2026; igual que C-1 del texto libre): 90 días como tope desde el
-- turno (`borrar_en` por omisión) y 30 días desde que la charla se marca atendida (`atendida_en`), lo que llegue
-- antes. Mecanismo: función de purga + `pg_cron` si existe (diario, 08:30 UTC = 03:30 en Bogotá); sin pg_cron
-- (como en el CI) la función se llama a mano con service_role.
--
-- AL APLICAR (a mano, Bryan): asignar la capacidad a sus cuentas, sin escribir ids en el repo:
--   insert into public.capacidades_staff (usuario_id, capacidad)
--   select id, 'leer_charlas_praxis' from public.usuarios_app where <las cuentas de Bryan> on conflict do nothing;
--
-- DIFERENCIAS CON EL DISEÑO (ver PIEZA-MEMORIA-MIGRACION.md):
--   · Una tabla de turnos, no dos: la charla es solo un `charla_id`.
--   · Los turnos clínicos se guardan con el TEXTO completo (decisión de Bryan: charla completa). Como solo los leen
--     Bryan y los agentes, la promesa de ranuras «al coach, solo la palabra clínica» sigue en pie para el resto del
--     equipo (custodio, hallazgo 6).
--
-- CÓMO REVERTIRLA (solo si no importa lo guardado):
--   begin;
--   select cron.unschedule('purgar-charlas-praxis') where exists (select 1 from cron.job where jobname = 'purgar-charlas-praxis');
--   drop function if exists public.praxis_purgar_charlas();
--   drop function if exists public.praxis_marcar_charla_atendida(uuid, uuid);
--   delete from public.capacidades_staff where capacidad = 'leer_charlas_praxis';  -- y quitarla del check
--   drop function if exists public.praxis_borrar_mi_charla(uuid);
--   drop table if exists public.praxis_charla_turnos;
--   commit;
-- ============================================================================

begin;

-- ── Capacidad nueva: leer_charlas_praxis (conserva todas las actuales; mismo patrón que la 0106) ──────────
do $$
declare
  v_nombre text;
  v_def    text;
  v_lista  text[];
begin
  select conname, pg_get_constraintdef(oid) into v_nombre, v_def
    from pg_constraint
   where conrelid = 'public.capacidades_staff'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%capacidad%'
   limit 1;
  if v_nombre is null then
    raise exception 'no se encontró el check de capacidades_staff: no se reescribe a ciegas';
  end if;
  select array_agg(distinct x order by x) into v_lista
    from (
      select m[1] as x from regexp_matches(v_def, '''([a-z_]+)''', 'g') as t(m)
      union
      select regexp_split_to_table(substring(v_def from '''\{([a-z_,]+)\}'''), ',')
    ) s
   where x is not null;
  v_lista := array(select distinct x from unnest(v_lista || array['leer_charlas_praxis']) as x order by x);
  execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  execute format(
    'alter table public.capacidades_staff add constraint capacidades_staff_capacidad_check check (capacidad in (%s))',
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(v_lista) as x)
  );
end $$;

create table if not exists public.praxis_charla_turnos (
  id              uuid primary key default gen_random_uuid(),
  -- De quién es la charla. Lo escribe el agente del servidor (service_role); el navegador no inserta.
  usuario_id      uuid not null references public.usuarios_app (id) on delete cascade,
  -- La sesión de charla a la que pertenece el turno y su orden dentro de ella.
  charla_id       uuid not null,
  n               int  not null check (n between 0 and 9999),
  -- Quién habló.
  rol             text not null check (rol in ('persona', 'praxis')),
  texto           text not null check (length(btrim(texto)) between 1 and 2000),
  marcado_clinico boolean not null default false,
  aviso_coach     boolean not null default false,
  creado_en       timestamptz not null default now(),
  -- Cuándo se marcó atendida la charla (acorta el plazo a 30 días). Nulo = sin atender.
  atendida_en     timestamptz,
  -- Cuándo se borra sola: tope 90 días; 30 desde atendida (lo que llegue antes).
  borrar_en       timestamptz not null default (now() + interval '90 days'),
  constraint praxis_charla_turnos_orden_unico unique (usuario_id, charla_id, n),
  constraint praxis_charla_turnos_plazo_coherente check (borrar_en > creado_en)
);

comment on table public.praxis_charla_turnos is
  'Memoria de la charla de Praxis entre dias (0166): un turno por fila, charla completa. Plazo: 90 dias tope, 30 desde atendida_en. '
  'Lee solo quien tiene la capacidad leer_charlas_praxis (Bryan) y service_role; escribe solo service_role (los agentes). '
  'Funciones: praxis_borrar_mi_charla (la persona), praxis_marcar_charla_atendida y praxis_purgar_charlas (service_role).';

-- La clave única de arriba ya sirve para leer una charla en orden. Este índice es para la purga diaria.
create index if not exists praxis_charla_turnos_por_borrar
  on public.praxis_charla_turnos (borrar_en);

-- Para «las charlas recientes de esta persona» sin recorrer todos sus turnos.
create index if not exists praxis_charla_turnos_recientes
  on public.praxis_charla_turnos (usuario_id, creado_en desc);

alter table public.praxis_charla_turnos enable row level security;

-- Una sola política de lectura. Sin política de insert/update/delete: el navegador no escribe; service_role
-- salta RLS y es el único que inserta.
drop policy if exists praxis_charla_turnos_leer_propio on public.praxis_charla_turnos;
drop policy if exists praxis_charla_turnos_lee_staff on public.praxis_charla_turnos;
drop policy if exists praxis_charla_turnos_insertar_propio on public.praxis_charla_turnos;
drop policy if exists praxis_charla_turnos_lee_con_capacidad on public.praxis_charla_turnos;
create policy praxis_charla_turnos_lee_con_capacidad on public.praxis_charla_turnos
  for select to authenticated
  using ((select public.tiene_capacidad('leer_charlas_praxis')));

revoke all on public.praxis_charla_turnos from anon, public;
revoke all on public.praxis_charla_turnos from authenticated;
grant select on public.praxis_charla_turnos to authenticated;
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
-- Marcar una charla atendida: el plazo pasa a 30 días desde ahora (nunca alarga el tope de 90)
-- ---------------------------------------------------------------------------
create or replace function public.praxis_marcar_charla_atendida(p_usuario_id uuid, p_charla_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_filas int;
begin
  if p_usuario_id is null or p_charla_id is null then
    raise exception 'praxis_marcar_charla_atendida: faltan usuario_id o charla_id' using errcode = '22023';
  end if;
  update public.praxis_charla_turnos t
     set atendida_en = coalesce(t.atendida_en, now()),
         borrar_en   = least(t.borrar_en, coalesce(t.atendida_en, now()) + interval '30 days')
   where t.usuario_id = p_usuario_id and t.charla_id = p_charla_id;
  get diagnostics v_filas = row_count;
  return v_filas;
end
$$;

comment on function public.praxis_marcar_charla_atendida(uuid, uuid) is
  'Marca atendida una charla: borrar_en = el menor entre el tope de 90 dias y 30 dias desde atendida. Idempotente (no reinicia el plazo). Solo service_role. 0166.';

revoke all on function public.praxis_marcar_charla_atendida(uuid, uuid) from public, anon, authenticated;
grant execute on function public.praxis_marcar_charla_atendida(uuid, uuid) to service_role;

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
  'Borra los turnos de charla de Praxis cuyo borrar_en ya paso (90 dias tope, 30 desde atendida). Idempotente. Solo service_role y pg_cron; devuelve las filas borradas. 0166.';

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
