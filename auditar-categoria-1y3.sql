-- SOLO §1 y §3 de `auditar-categorias.sql`, para pegar de una vez.
-- El archivo completo, con el porque y los otros apartados, esta al lado.
-- SOLO LEE.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · LOS QUE NO SUMAN NADA · categoria vacia o fuera de las 32
-- ═════════════════════════════════════════════════════════════════════════════
-- Esta es la consulta que importa. Cada fila es un ejercicio cuyo volumen se esta
-- perdiendo, con cuanta gente lo tiene y cuantas series se dejan de contar.

with canonicas(categoria) as (
  values
         ('ABDUCCIÓN DE CADERA'),
         ('ABDUCCIÓN DE HOMBRO'),
         ('ABDUCCIÓN HORIZONTAL'),
         ('ACONDICIONAMIENTO'),
         ('ADUCCIÓN DE CADERA'),
         ('ANTIEXTENSIÓN'),
         ('ANTIFLEXIÓN LATERAL'),
         ('ANTIRROTACIÓN'),
         ('APERTURA DE PECHO'),
         ('BISAGRA DE CADERA'),
         ('DORSIFLEXIÓN'),
         ('EMPUJE HORIZONTAL'),
         ('EMPUJE INCLINADO'),
         ('EMPUJE VERTICAL'),
         ('EXTENSIÓN DE CADERA'),
         ('EXTENSIÓN DE CODO'),
         ('EXTENSIÓN DE HOMBRO'),
         ('EXTENSIÓN DE RODILLA'),
         ('EXTENSIÓN LUMBAR'),
         ('FLEXIÓN DE CODO'),
         ('FLEXIÓN DE HOMBRO'),
         ('FLEXIÓN DE RODILLA'),
         ('FLEXIÓN DE TRONCO'),
         ('FLEXIÓN PLANTAR'),
         ('MOVILIDAD'),
         ('PREV/REHAB'),
         ('RETRACCIÓN ESCAPULAR'),
         ('ROTACIÓN DE CADERA'),
         ('SENTADILLA'),
         ('SENTADILLA UNILATERAL'),
         ('TRACCIÓN HORIZONTAL'),
         ('TRACCIÓN VERTICAL')
),
ejercicios as (
  select u.nombre                                        as asesorado,
         m.numero                                        as microciclo,
         sesion->>'nombre'                               as sesion,
         e->>'nombre'                                    as ejercicio,
         nullif(trim(coalesce(e->>'categoria','')), '')  as categoria,
         -- Cast GUARDADO: V6 dice que en la base ha habido texto en campos
         -- numericos («Control», «Superset»). Un `::int` a secas tumbaria la
         -- auditoria entera por un solo ejercicio mal escrito.
         case when e->>'sets' ~ '^[0-9]+$' then (e->>'sets')::int else 0 end as sets,
         jsonb_array_length(coalesce(e->'series','[]'::jsonb))               as registradas
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id,
       jsonb_array_elements(coalesce(m.datos->'sesiones','[]'::jsonb)) sesion,
       jsonb_array_elements(coalesce(sesion->'ejercicios','[]'::jsonb)) e
)
select coalesce(ej.categoria, '(VACIA)')      as categoria_escrita,
       ej.ejercicio,
       count(*)                               as veces,
       count(distinct ej.asesorado)           as personas,
       sum(ej.sets)                           as series_pautadas_perdidas,
       sum(ej.registradas)                    as series_REGISTRADAS_perdidas,
       string_agg(distinct ej.asesorado, ', ') as quienes
from ejercicios ej
left join canonicas c
       on upper(c.categoria) = upper(coalesce(ej.categoria,''))
where c.categoria is null                       -- no casa con ninguna canonica
group by 1, 2
order by series_REGISTRADAS_perdidas desc, series_pautadas_perdidas desc, veces desc;

-- 👉 LAS DOS COLUMNAS NO DICEN LO MISMO Y LA QUE DUELE ES LA SEGUNDA.
--    `cargaPorGrupo` cuenta con `series.length`, o sea las series REGISTRADAS.
--    Las pautadas dicen cuanto volumen se perderia si lo hiciera; las
--    registradas dicen cuanto se esta perdiendo YA.

-- OJO: el cruce es por texto EXACTO en mayusculas. Una categoria que solo se
-- diferencie por una TILDE saldra aqui, y eso NO es ruido: es exactamente el
-- fallo, porque el codigo de la app tolera acentos pero cualquier consulta a
-- mano no. Si salen muchas por eso, es que hay dos formas conviviendo.


-- ═════════════════════════════════════════════════════════════════════════════
-- 3 · Cuanto volumen se pierde por persona
-- ═════════════════════════════════════════════════════════════════════════════
-- La misma perdida, agregada: dice a quien le esta mintiendo mas el PANEL.

with canonicas(categoria) as (
  values
         ('ABDUCCIÓN DE CADERA'),
         ('ABDUCCIÓN DE HOMBRO'),
         ('ABDUCCIÓN HORIZONTAL'),
         ('ACONDICIONAMIENTO'),
         ('ADUCCIÓN DE CADERA'),
         ('ANTIEXTENSIÓN'),
         ('ANTIFLEXIÓN LATERAL'),
         ('ANTIRROTACIÓN'),
         ('APERTURA DE PECHO'),
         ('BISAGRA DE CADERA'),
         ('DORSIFLEXIÓN'),
         ('EMPUJE HORIZONTAL'),
         ('EMPUJE INCLINADO'),
         ('EMPUJE VERTICAL'),
         ('EXTENSIÓN DE CADERA'),
         ('EXTENSIÓN DE CODO'),
         ('EXTENSIÓN DE HOMBRO'),
         ('EXTENSIÓN DE RODILLA'),
         ('EXTENSIÓN LUMBAR'),
         ('FLEXIÓN DE CODO'),
         ('FLEXIÓN DE HOMBRO'),
         ('FLEXIÓN DE RODILLA'),
         ('FLEXIÓN DE TRONCO'),
         ('FLEXIÓN PLANTAR'),
         ('MOVILIDAD'),
         ('PREV/REHAB'),
         ('RETRACCIÓN ESCAPULAR'),
         ('ROTACIÓN DE CADERA'),
         ('SENTADILLA'),
         ('SENTADILLA UNILATERAL'),
         ('TRACCIÓN HORIZONTAL'),
         ('TRACCIÓN VERTICAL')
)
select u.nombre                                         as asesorado,
       count(*)                                         as ejercicios_sin_contar,
       sum(case when e->>'sets' ~ '^[0-9]+$'
                then (e->>'sets')::int else 0 end)      as series_pautadas_perdidas,
       sum(jsonb_array_length(coalesce(e->'series','[]'::jsonb)))
                                                        as series_REGISTRADAS_perdidas
from public.microciclos m
join public.usuarios_app u on u.id = m.usuario_id,
     jsonb_array_elements(coalesce(m.datos->'sesiones','[]'::jsonb)) sesion,
     jsonb_array_elements(coalesce(sesion->'ejercicios','[]'::jsonb)) e
left join canonicas c
       on upper(c.categoria) = upper(trim(coalesce(e->>'categoria','')))
where c.categoria is null
group by 1
order by series_REGISTRADAS_perdidas desc, series_pautadas_perdidas desc;
