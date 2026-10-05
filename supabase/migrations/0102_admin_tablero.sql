-- ============================================================================
-- 0102 · Área administrativa interactiva: admin_tablero + capacidad ver_administracion
-- ============================================================================
--
-- Respalda la pantalla «Área administrativa» (antes «Estrategia» de Manuela) según
-- bola-de-nieve/organizador/ESPEC-ADMINISTRACION-INTERACTIVA.md (29-sep-2026): siete secciones
-- (finanzas, plan, propuestas, desvíos, influencers, mercadeo, plataforma), cada una con una
-- tarjeta, filas de detalle y su fuente.
--
--   · UNA fila por sección y corte; la app lee el último corte de cada sección.
--   · `datos` (jsonb) lleva {tarjeta, filas, grafico}; la app lo valida al leer, la base solo
--     exige que sea un objeto.
--   · Sin datos de salud ni nombres de asesorados.
--
-- SEGURIDAD, la regla de siempre: RLS en el mismo paso y `revoke all … from anon, authenticated,
-- public` antes de conceder nada. LEE quien tiene la capacidad `ver_administracion` (Bryan y
-- Manuela; un asesorado nunca). ESCRIBE solo service_role: la carga la hace un importador con
-- el OK de Bryan.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · CAPACIDAD NUEVA: ver_administracion
-- ────────────────────────────────────────────────────────────────────────────
-- Un solo check compartido: se lee la lista VIGENTE de la base y se reescribe entera + la nueva.
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
  v_lista := array(select distinct x from unnest(v_lista || array['ver_administracion']) as x order by x);
  execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  execute format(
    'alter table public.capacidades_staff add constraint capacidades_staff_capacidad_check check (capacidad in (%s))',
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(v_lista) as x)
  );
end
$$;

-- Solo casa con filas reales (el CI arranca con la base vacía).
--   aa202ff5-… = Manuela (nutricionista)   28c3cfe8-… = Bryan (coach)
insert into public.capacidades_staff (usuario_id, capacidad)
select u.id, 'ver_administracion'
  from public.usuarios_app u
 where u.id in ('aa202ff5-74c1-4b76-9140-8ba44dc62f17', '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce')
on conflict do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · ADMIN_TABLERO
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.admin_tablero (
  id        uuid primary key default gen_random_uuid(),
  seccion   text not null
              check (seccion in ('finanzas', 'plan', 'propuestas', 'desvios', 'influencers', 'mercadeo', 'plataforma')),
  corte     date not null,
  datos     jsonb not null check (jsonb_typeof(datos) = 'object'),
  fuente    text check (char_length(fuente) between 1 and 300),
  huella    text check (char_length(huella) between 1 and 200),
  creado_en timestamptz not null default now(),
  -- Una fila por sección y corte: el importador reintenta sin duplicar.
  constraint admin_tablero_una_por_seccion_y_corte unique (seccion, corte)
);

comment on table public.admin_tablero is
  'Área administrativa (0102, 2026-09-29): una fila por sección y corte con la tarjeta, las filas y las '
  'fuentes en `datos`. La app lee el último corte de cada sección. Sin datos de salud; escribe solo service_role.';

create index if not exists admin_tablero_por_seccion_corte on public.admin_tablero (seccion, corte desc);

alter table public.admin_tablero enable row level security;
-- Sin este revoke, un privilegio heredado dejaría pasar lo que la política no dice (lección de la 0084).
revoke all on public.admin_tablero from anon, authenticated, public;
grant select on public.admin_tablero to authenticated;
grant all on public.admin_tablero to service_role;

create policy admin_tablero_leer on public.admin_tablero
  for select to authenticated
  using ((select public.tiene_capacidad('ver_administracion')));
-- Sin política ni privilegio de insert/update/delete para authenticated: solo service_role escribe.

commit;
