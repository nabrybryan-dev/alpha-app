-- ============================================================================
-- 0156 · Praxis: vectores de la biblioteca y búsqueda por sentido
-- ============================================================================
--
-- APLICADA el 31-oct-2026, con el sí de Bryan (selector). Si faltara, nada se rompe: `praxis-registro` deja una
-- línea en el registro y la respuesta sale igual. Comprobarla con sus filas en `comprobar-migraciones.sql`.
--
-- QUÉ PEDIDO RESUELVE. Por palabras la búsqueda no alcanzó el mínimo del plan (16 de 20); con e5-base sí (19 de 20).
-- Medida y elección del modelo: `docs/specs/2026-10-31-biblioteca-de-praxis.md`.
--
-- Sin índice a propósito: son decenas de filas y una búsqueda exacta tarda poco. El plan pide medir antes de añadirlo.
-- `modelo_vector` existe porque un vector de otro modelo tiene la misma forma y no significa lo mismo.
--
-- QUIÉN PUEDE QUÉ. Igual que la 0155: el equipo busca y solo sobre lo aprobado; anon nada; escribe service_role.
-- ============================================================================

begin;

alter table public.praxis_conceptos
  add column if not exists vector extensions.vector(768),
  add column if not exists modelo_vector text;

alter table public.praxis_conceptos drop constraint if exists praxis_conceptos_vector_con_modelo;
alter table public.praxis_conceptos add constraint praxis_conceptos_vector_con_modelo
  check ((vector is null) = (modelo_vector is null));

-- SECURITY INVOKER a propósito: la política de la 0155 es la que deja fuera a un asesorado.
create or replace function public.buscar_conceptos_vector(consulta extensions.vector(768), tope integer default 5)
returns table (id text, tema text, pregunta text, coseno double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select c.id, c.tema, c.pregunta, 1 - (c.vector <=> consulta)
  from public.praxis_conceptos c
  where c.estado = 'aprobada' and c.vector is not null and consulta is not null
  order by c.vector <=> consulta, c.id
  limit greatest(1, least(coalesce(tope, 5), 20))
$$;

comment on function public.buscar_conceptos_vector(extensions.vector, integer) is
  'Busca por sentido en lo aprobado de praxis_conceptos. Solo el equipo: SECURITY INVOKER con RLS.';

revoke all on function public.buscar_conceptos_vector(extensions.vector, integer) from public, anon;
grant execute on function public.buscar_conceptos_vector(extensions.vector, integer) to authenticated, service_role;

commit;
