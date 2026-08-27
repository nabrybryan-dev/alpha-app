-- Banco de pruebas de carga: mil asesorados, datos 100 % sintéticos.
--
-- ⚠️  NO CORRER ESTO CONTRA PRODUCCIÓN. Crea tablas y mete 5.300 filas.
--     Va sobre una rama de Supabase o cualquier Postgres de usar y tirar.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ UN BANCO MÍNIMO Y NO LAS 49 MIGRACIONES
-- ─────────────────────────────────────────────────────────────────────────────
-- Una rama de Supabase nace VACÍA y se reconstruye aplicando el historial de
-- migraciones. En este proyecto ese historial solo tiene 2 entradas, porque las
-- 0001–0049 se aplican a mano en el SQL Editor. Resultado: la rama sale con cero
-- tablas. Es el precio de ese flujo, y conviene saberlo antes de intentarlo.
--
-- Así que esto reproduce SOLO el camino que se quiere pesar: qué se lleva el
-- coach de `microciclos`. Sin FK a `auth.users` a propósito — aquí no se prueba
-- la autenticación, se pesa una descarga.
--
-- Resultados de la corrida del 2026-08-27 en
-- `docs/specs/2026-08-27-informe-de-carga-mil-usuarios.md`.

create table usuarios_app (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rol text not null check (rol in ('coach','nutricionista','asesorado')),
  avatar_iniciales text
);

create table microciclos (
  id text primary key,
  usuario_id uuid not null references usuarios_app(id) on delete cascade,
  numero int not null,
  estado text not null check (estado in ('activo','cerrado','propuesto')),
  datos jsonb not null,
  actualizado_en timestamptz not null default now()
);
create index microciclos_usuario on microciclos (usuario_id);

-- Igual que en producción: `stable security definer`, consultando usuarios_app.
create or replace function es_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from usuarios_app where id = auth.uid() and rol = 'coach');
$$;

alter table usuarios_app enable row level security;
alter table microciclos enable row level security;

-- Las políticas TAL CUAL quedaron tras la 0045: envueltas en (select ...).
create policy usuarios_leer on usuarios_app for select
  using (id = (select auth.uid()) or (select es_coach()));
create policy microciclos_leer on microciclos for select
  using (usuario_id = (select auth.uid()) or (select es_coach()));

-- ── El blob ──────────────────────────────────────────────────────────────────
--
-- `p_relleno = 6` da 20.709 bytes, calibrado contra los 20.983 reales de
-- producción. Si el tamaño medio de un microciclo cambia, recalibrar aquí: un
-- banco que pesa otra cosa mide otra cosa.

create or replace function blob_microciclo(p_usuario uuid, p_numero int, p_estado text, p_relleno int default 6)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'id', 'm-' || p_usuario || '-' || p_numero,
    'usuarioId', p_usuario, 'numero', p_numero, 'cadenciaDias', 8,
    'estado', p_estado, 'fechaInicio', '2026-07-20',
    'sesiones', (
      select jsonb_agg(jsonb_build_object(
        'id', 's' || s, 'nombre', 'SESION ' || s,
        'tipo', case when s = 5 then 'metabolica' else 'fuerza' end,
        'preparacion', jsonb_build_array(
          jsonb_build_object('id','p1','texto','Movilidad de cadera y hombro','hechoEn', null)),
        'ejercicios', (
          select jsonb_agg(jsonb_build_object(
            'id', 'e' || s || '-' || e, 'nombre', 'EJERCICIO ' || e,
            'sets', 4, 'rirObjetivo', 2, 'repsDiana', 8,
            -- Las prescripciones reales son texto largo: son la mitad del peso.
            'notaAsesorado', repeat('4 SERIES DE 8 REPS A RIR 2. Sube 2,5 kg si cierras las cuatro. ', p_relleno),
            'series', (
              select jsonb_agg(jsonb_build_object('reps', 8, 'cargaKg', 60 + r * 2.5, 'rir', 2))
              from generate_series(1, 4) r)))
          from generate_series(1, 6) e)))
      from generate_series(1, 5) s));
$$;

-- ── La siembra ───────────────────────────────────────────────────────────────
-- Misma proporción que producción: ~4,7 microciclos por asesorado, 1 activo, y
-- un 30 % con propuesta preparada.

insert into usuarios_app (id, nombre, rol, avatar_iniciales)
values ('00000000-0000-4000-8000-000000000001', 'Coach de prueba', 'coach', 'CP');

insert into usuarios_app (nombre, rol, avatar_iniciales)
select 'Asesorado ' || lpad(n::text, 4, '0'), 'asesorado', 'A' || lpad(n::text, 2, '0')
from generate_series(1, 1000) n;

-- En tandas de 250: 105 MB de JSON de una sentada tumban la conexión.
do $$
declare desde int;
begin
  for desde in select generate_series(1, 1000, 250) loop
    insert into microciclos (id, usuario_id, numero, estado, datos)
    select 'm-' || u.id || '-' || n, u.id, n,
           case when n = 5 then 'activo' else 'cerrado' end,
           blob_microciclo(u.id, n, case when n = 5 then 'activo' else 'cerrado' end)
    from (select id, row_number() over (order by nombre) rn
            from usuarios_app where rol = 'asesorado') u
    cross join generate_series(1, 5) n
    where u.rn between desde and desde + 249;
  end loop;
end $$;

insert into microciclos (id, usuario_id, numero, estado, datos)
select 'm-' || u.id || '-6', u.id, 6, 'propuesto', blob_microciclo(u.id, 6, 'propuesto')
from (select id, row_number() over (order by nombre) rn
        from usuarios_app where rol = 'asesorado') u
where u.rn % 10 < 3;

analyze microciclos;
analyze usuarios_app;

-- ── La medición ──────────────────────────────────────────────────────────────

create temp table medicion (variante text, pasada int, ms numeric, bytes bigint);

do $$
declare t0 timestamptz; n int; b bigint;
begin
  perform count(*) from microciclos;  -- calentamiento, no se cuenta
  for n in 1..5 loop
    t0 := clock_timestamp();
    select sum(octet_length(datos::text)) into b from microciclos;
    insert into medicion values ('ANTES (todo)', n,
      round(extract(epoch from clock_timestamp() - t0) * 1000, 1), b);

    t0 := clock_timestamp();
    select sum(octet_length(datos::text)) into b from microciclos
     where estado in ('activo','propuesto');
    insert into medicion values ('DESPUES (#142)', n,
      round(extract(epoch from clock_timestamp() - t0) * 1000, 1), b);
  end loop;
end $$;

select variante, round(avg(ms), 1) as media_ms,
       pg_size_pretty(max(bytes)) as carga,
       round(max(bytes) * (86400/45.0) / 1024/1024/1024, 1) as gb_al_dia
from medicion group by variante order by max(bytes) desc;

-- ── Y el cliff, que NO está en Postgres ──────────────────────────────────────
-- `mockDb.ts:53` escribe la instantánea entera en `localStorage`, sin
-- protección de cuota. Esto dice a cuántos asesorados revienta.

with por_asesorado as (
  select sum(octet_length(datos::text))::numeric
         / (select count(*) from usuarios_app where rol='asesorado') as bytes
  from microciclos where estado in ('activo','propuesto')),
limites(navegador, cuota) as (values
  ('Chrome / Edge (5 MB)', 5 * 1024 * 1024),
  ('Firefox (10 MB)', 10 * 1024 * 1024))
select l.navegador, round(p.bytes) as bytes_por_asesorado,
       floor(l.cuota / p.bytes) as asesorados_hasta_reventar
from por_asesorado p, limites l;
