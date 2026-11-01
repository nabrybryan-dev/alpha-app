-- ============================================================================
-- 0155 · Praxis: la biblioteca de conceptos y su búsqueda
-- ============================================================================
--
-- APLICADA el 31-oct-2026, con el sí de Bryan (selector). Si faltara, nada se rompe: hoy nadie la llama.
-- Comprobarla con sus filas en `comprobar-migraciones.sql`.
-- 0153 y 0154 están reservadas por `fase4/praxis-deliberacion`.
--
-- QUÉ PEDIDO RESUELVE. Bryan, 31-oct: que Praxis responda con lo que dicen los cerebros, sin depender de 50
-- fichas. Plan: `docs/specs/2026-10-31-biblioteca-de-praxis.md`. Cada fila es una pieza curada, con su fuente.
--
-- LO QUE ESTA MIGRACIÓN NO HACE. No trae vectores: quién convierte la pregunta en vector sigue por decidir, y
-- agregarlos no cambia lo de aquí. La búsqueda funde palabras (español, sin tildes) y parecido de letras, que
-- aguanta los errores del reconocedor de voz. Por eso la fusión es por rangos: admite una tercera lista después.
--
-- QUIÉN PUEDE QUÉ.
--   · LEE solo el equipo (`es_staff()`). Trae citas con rutas internas: un asesorado no las ve.
--   · BUSCA el equipo, y solo sobre lo aprobado. Una pieza en borrador no se encuentra.
--   · ESCRIBE solo service_role, al cargar lo que Bryan aprobó. Nadie aprueba desde una sesión.
--   · anon: nada.
-- ============================================================================

begin;

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.praxis_conceptos (
  id                    text primary key,
  tema                  text not null,
  pregunta              text not null check (length(btrim(pregunta)) > 0),
  contexto              text not null default '',
  respuesta             text not null check (length(btrim(respuesta)) > 0),
  de_que_depende        jsonb not null default '[]'::jsonb check (jsonb_typeof(de_que_depende) = 'array'),
  estudios              text not null default '',
  criterio_de_practica  text not null default '',
  citas                 jsonb not null default '{}'::jsonb check (jsonb_typeof(citas) = 'object'),
  solidez               text not null check (solidez in ('estudios', 'mixta', 'convencion')),
  confianza             text not null check (confianza in ('alta', 'media', 'baja')),
  estado                text not null default 'borrador' check (estado in ('borrador', 'aprobada')),
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  -- La pregunta pesa más que el contexto, y este más que la respuesta. `sin_tildes` (0014) es IMMUTABLE con
  -- diccionario fijo: la voz y el teclado no siempre traen tildes.
  busqueda              tsvector generated always as (
    setweight(to_tsvector('spanish'::regconfig, public.sin_tildes(pregunta)), 'A')
    || setweight(to_tsvector('spanish'::regconfig, public.sin_tildes(contexto)), 'B')
    || setweight(to_tsvector('spanish'::regconfig, public.sin_tildes(respuesta)), 'C')
  ) stored
);

comment on table public.praxis_conceptos is
  'Biblioteca de Praxis (0155, 2026-10-31): piezas curadas de los cerebros, con su fuente. Solo lo aprobado se busca. '
  'Solo el equipo lee; solo service_role escribe. Sin datos de asesorados.';

create index if not exists praxis_conceptos_busqueda on public.praxis_conceptos using gin (busqueda);
create index if not exists praxis_conceptos_letras on public.praxis_conceptos
  using gin (public.sin_tildes(pregunta) extensions.gin_trgm_ops);

alter table public.praxis_conceptos enable row level security;

drop policy if exists praxis_conceptos_leer on public.praxis_conceptos;
create policy praxis_conceptos_leer on public.praxis_conceptos
  for select to authenticated
  using ((select public.es_staff()));

revoke all on public.praxis_conceptos from anon, public;
revoke all on public.praxis_conceptos from authenticated;
grant select on public.praxis_conceptos to authenticated;
grant all on public.praxis_conceptos to service_role;

-- SECURITY INVOKER a propósito: la política de arriba es la que deja fuera a un asesorado.
-- La frase se corta a 600, el tope de `praxis-registro`, y el tope de piezas a 20.
create or replace function public.buscar_conceptos(consulta text, tope integer default 5)
returns table (id text, tema text, pregunta text, respuesta text, de_que_depende jsonb, solidez text, confianza text, puntaje double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with entrada as (
    select public.sin_tildes(left(coalesce(consulta, ''), 600)) as texto
  ),
  -- plainto exige TODAS las palabras; una pregunta hablada casi nunca las tiene todas: se cambia Y por O.
  pedido as (
    select texto,
           nullif(replace(plainto_tsquery('spanish'::regconfig, texto)::text, ' & ', ' | '), '') as terminos
    from entrada
  ),
  aprobadas as (
    select c.* from public.praxis_conceptos c where c.estado = 'aprobada'
  ),
  por_palabras as (
    select a.id, row_number() over (order by ts_rank_cd(a.busqueda, p.terminos::tsquery) desc, a.id) as lugar
    from aprobadas a, pedido p
    where p.terminos is not null and a.busqueda @@ p.terminos::tsquery
  ),
  por_letras as (
    select a.id, row_number() over (order by extensions.similarity(public.sin_tildes(a.pregunta), p.texto) desc, a.id) as lugar
    from aprobadas a, pedido p
    where length(p.texto) >= 3 and extensions.similarity(public.sin_tildes(a.pregunta), p.texto) >= 0.2
  ),
  -- Fusión por rangos, con el k = 50 del plan.
  fundidas as (
    select coalesce(w.id, l.id) as id,
           coalesce(1.0 / (50 + w.lugar), 0) + coalesce(1.0 / (50 + l.lugar), 0) as puntaje
    from por_palabras w
    full join por_letras l on l.id = w.id
  )
  select a.id, a.tema, a.pregunta, a.respuesta, a.de_que_depende, a.solidez, a.confianza, f.puntaje::double precision
  from fundidas f
  join aprobadas a on a.id = f.id
  order by f.puntaje desc, a.id
  limit greatest(1, least(coalesce(tope, 5), 20))
$$;

comment on function public.buscar_conceptos(text, integer) is
  'Busca en lo aprobado de praxis_conceptos, fundiendo palabras y parecido de letras. Solo el equipo: SECURITY INVOKER con RLS.';

revoke all on function public.buscar_conceptos(text, integer) from public, anon;
grant execute on function public.buscar_conceptos(text, integer) to authenticated, service_role;

commit;
