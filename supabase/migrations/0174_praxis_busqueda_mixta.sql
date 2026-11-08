-- ============================================================================
-- 0174 · Praxis: búsqueda mixta (palabras + sentido) con fusión por rango recíproco
-- ============================================================================
--
-- PROPUESTA, NO APLICADA (7-nov-2026). Agrega una función NUEVA y no toca `buscar_conceptos` (0155) ni
-- `buscar_conceptos_vector` (0156): lo que usa hoy la Edge Function sigue igual. Nada la llama todavía.
--
-- QUÉ MIDIÓ. Examen nuevo de 64 preguntas con pieza (escritas por Claude desde las piezas, sin frases de
-- asesorados), 64 piezas, acierto = esperada o aceptable. Solo vectores 88 % entre 5; mixta 91 % entre 5
-- (+2 netas, dentro del ruido; NO cumple la regla de +3 de `diagnostico-20261107`). Ver
-- `busqueda-mejora/mixta-20261107/RESULTADO-MIXTA-20261107.md`. La medida usó un BM25 en memoria; esta función usa
-- `ts_rank_cd` sobre la columna `busqueda` de la 0155: son cercanos, no idénticos. Antes de cablearla hay que
-- repetir la medida con ESTA función en una base de pruebas con las 64 piezas cargadas.
--
-- ENTRADAS. `consulta_texto` (la frase, se corta a 600) y `consulta_vector` (el vector de la frase, 768, que sigue
-- calculando el servicio del portátil). Si el vector es nulo, solo cuentan las palabras; si el texto está vacío,
-- solo cuenta el sentido. RRF con k = 60 por omisión (Cormack 2009); no se ajustó con el examen nuevo.
--
-- QUIÉN PUEDE QUÉ. Igual que 0155 y 0156: SECURITY INVOKER (la política deja fuera a un asesorado), solo lo
-- aprobado, anon nada.
-- ============================================================================

begin;

create or replace function public.buscar_conceptos_mixta(
  consulta_texto text,
  consulta_vector extensions.vector(768),
  tope integer default 5,
  k integer default 60
)
returns table (id text, tema text, pregunta text, puntaje double precision, coseno double precision, lugar_palabras integer, lugar_sentido integer)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with entrada as (
    select public.sin_tildes(left(coalesce(consulta_texto, ''), 600)) as texto,
           greatest(1, least(coalesce(k, 60), 1000)) as kk
  ),
  pedido as (
    select texto, kk,
           nullif(replace(plainto_tsquery('spanish'::regconfig, texto)::text, ' & ', ' | '), '') as terminos
    from entrada
  ),
  aprobadas as (
    select c.* from public.praxis_conceptos c where c.estado = 'aprobada'
  ),
  por_palabras as (
    select a.id, (row_number() over (order by ts_rank_cd(a.busqueda, p.terminos::tsquery) desc, a.id))::integer as lugar
    from aprobadas a, pedido p
    where p.terminos is not null and a.busqueda @@ p.terminos::tsquery
  ),
  por_sentido as (
    select a.id, (row_number() over (order by a.vector <=> consulta_vector, a.id))::integer as lugar,
           1 - (a.vector <=> consulta_vector) as coseno
    from aprobadas a
    where consulta_vector is not null and a.vector is not null
  ),
  fundidas as (
    select coalesce(w.id, s.id) as id, w.lugar as lw, s.lugar as ls, s.coseno,
           coalesce(1.0 / ((select kk from pedido) + w.lugar), 0) + coalesce(1.0 / ((select kk from pedido) + s.lugar), 0) as puntaje
    from por_palabras w
    full join por_sentido s on s.id = w.id
  )
  select a.id, a.tema, a.pregunta, f.puntaje::double precision, f.coseno::double precision, f.lw, f.ls
  from fundidas f
  join aprobadas a on a.id = f.id
  order by f.puntaje desc, a.id
  limit greatest(1, least(coalesce(tope, 5), 20))
$$;

comment on function public.buscar_conceptos_mixta(text, extensions.vector, integer, integer) is
  'Busca en lo aprobado de praxis_conceptos fundiendo palabras (ts_rank_cd) y sentido (coseno) por rango recíproco, k=60. Propuesta 0174, sin cablear. Solo el equipo: SECURITY INVOKER con RLS.';

revoke all on function public.buscar_conceptos_mixta(text, extensions.vector, integer, integer) from public, anon;
grant execute on function public.buscar_conceptos_mixta(text, extensions.vector, integer, integer) to authenticated, service_role;

commit;
