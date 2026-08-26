-- Los seis que no volvieron tras el cierre — estado real antes de escribir la tanda
--
-- Pegar en: Supabase → SQL Editor → New query → Run. SOLO LEE: no crea, no borra
-- y no modifica nada. Se puede ejecutar tantas veces como se quiera.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ EXISTE
-- ─────────────────────────────────────────────────────────────────────────────
-- El agente ⑤ corrió el 2026-08-25 sobre los siete vencidos y dejó el mapa:
-- la semana del 10/08 fue un corte de CARTERA (gimnasios cerrados, causa externa
-- ya escrita en el log del 16/08) y el 17/08 la cartera volvió entera —12
-- personas, 113 marcas—. Seis no volvieron: Felipe Murillo, Alejandra Cardona,
-- Juan Carlos Parra, Damián, Mara Piedrahita y Luis Hernández.
--
-- Ese diagnóstico se hizo con las marcas `preparacion[].hechoEn`, que es el único
-- timestamp que deja el asesorado. Esta consulta REHACE ese conteo con fecha de
-- hoy, porque el diagnóstico tiene ya un día y la pregunta que decide la tanda
-- —¿alguno volvió desde entonces?— solo la contesta el dato de hoy.
--
--   👉 NO filtra por `rol`, a propósito. Ver la cabecera de `comprobar-cobertura.sql`:
--      cualquier `where rol = 'asesorado'` borra del mapa a quien es staff además
--      de asesorado, y ya mordió dos veces.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LO QUE ESTA CONSULTA NO PUEDE CONTESTAR
-- ─────────────────────────────────────────────────────────────────────────────
-- Si alguien SALIÓ del programa, su último microciclo se queda vencido y se ve
-- idéntico a un olvido. La base no distingue «inactivo» de «se nos pasó»: esa
-- diferencia solo la tiene el coach. Cero marcas aquí NO significa abandono.


-- ═════════════════════════════════════════════════════════════════════════════
-- 0 · Quiénes son, y con qué nombre están escritos
-- ═════════════════════════════════════════════════════════════════════════════
-- Correr esta primero: si alguna fila sale vacía, el patrón no acierta con el
-- `nombre` de la base y TODO lo demás de este archivo dará un cero engañoso.

with los_seis(patron, quien) as (
  values ('%murillo%',     'Felipe Murillo'),
         ('%cardona%',     'Alejandra Cardona'),
         ('%parra%',       'Juan Carlos Parra'),
         ('%damia%',       'Damián'),
         ('%piedrahita%',  'Mara Piedrahita'),
         ('%hern%ndez%',   'Luis Hernández')
)
select s.quien       as buscado,
       u.id,
       u.nombre      as en_la_base,
       u.rol
  from los_seis s
  left join public.usuarios_app u on u.nombre ilike s.patron
 order by s.quien;


-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · Su microciclo: cuál es, cuándo arrancó, si de verdad está vencido
-- ═════════════════════════════════════════════════════════════════════════════
-- El ⑤ dio a los seis por «vencido hoy» el 25/08. Comprobarlo: el M18 de Mara
-- se escribió como semana de valoración del 19 al 27 de agosto, así que hasta
-- el 27 NO está vencido — y programarle encima una semana nueva pisaría la
-- valoración que todavía está corriendo.

with los_seis(patron, quien) as (
  values ('%murillo%',    'Felipe Murillo'),  ('%cardona%',    'Alejandra Cardona'),
         ('%parra%',      'Juan Carlos Parra'),('%damia%',     'Damián'),
         ('%piedrahita%', 'Mara Piedrahita'), ('%hern%ndez%',  'Luis Hernández')
)
select s.quien,
       m.numero,
       m.estado,
       (m.datos->>'fechaInicio')::date                          as arranco,
       coalesce((m.datos->>'cadenciaDias')::int, 8)             as cadencia,
       (m.datos->>'fechaInicio')::date
         + coalesce((m.datos->>'cadenciaDias')::int, 8)         as vence,
       current_date - ((m.datos->>'fechaInicio')::date
         + coalesce((m.datos->>'cadenciaDias')::int, 8))        as dias_vencido,
       jsonb_array_length(coalesce(m.datos->'sesiones','[]'::jsonb)) as sesiones
  from los_seis s
  join public.usuarios_app u on u.nombre ilike s.patron
  join public.microciclos m  on m.usuario_id = u.id
 where (m.estado = 'activo' or m.datos->>'estado' = 'activo')
 order by dias_vencido desc nulls last, s.quien;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · Marcas de preparación por semana · ¿ha vuelto alguno desde el 25?
-- ═════════════════════════════════════════════════════════════════════════════
-- Es la consulta que decide la tanda. Una marca nueva después del 2026-08-25
-- cambia a esa persona de «no volvió» a «volvió», y con eso deja de necesitar
-- una pregunta y pasa a necesitar una rampa — que es lo que ya se hizo con
-- Dhanny cuando apareció su marca del 25.

with los_seis(patron, quien) as (
  values ('%murillo%',    'Felipe Murillo'),  ('%cardona%',    'Alejandra Cardona'),
         ('%parra%',      'Juan Carlos Parra'),('%damia%',     'Damián'),
         ('%piedrahita%', 'Mara Piedrahita'), ('%hern%ndez%',  'Luis Hernández')
), marcas as (
  select s.quien,
         (p->>'hechoEn')::timestamptz as cuando
    from los_seis s
    join public.usuarios_app u on u.nombre ilike s.patron
    join public.microciclos m  on m.usuario_id = u.id,
         jsonb_array_elements(coalesce(m.datos->'sesiones','[]'::jsonb)) sesion,
         jsonb_array_elements(coalesce(sesion->'preparacion','[]'::jsonb)) p
   where p->>'hechoEn' is not null
)
select quien,
       count(*)                                                    as marcas_totales,
       max(cuando)::date                                           as ultima_marca,
       current_date - max(cuando)::date                            as dias_sin_marcar,
       count(*) filter (where cuando::date >= date '2026-08-25')    as marcas_desde_el_25,
       count(*) filter (where cuando::date between date '2026-08-10'
                                              and date '2026-08-16') as durante_el_cierre,
       count(*) filter (where cuando::date >= date '2026-08-17')     as tras_la_vuelta
  from marcas
 group by quien
 order by dias_sin_marcar desc;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3 · Registro: series anotadas y `ANOTA ESTE` cumplidos
-- ═════════════════════════════════════════════════════════════════════════════
-- Para Juan Carlos, esta es la fila que importa: su M5 llevaba 15 ejercicios
-- marcados `ANOTA ESTE` con CERO registrados. Si sigue en cero, el mínimo que se
-- le pidió no funcionó y REPETIRLO PIERDE OTRO MICROCICLO — hay que pedirle otra
-- cosa, no la misma cosa más fuerte.

with los_seis(patron, quien) as (
  values ('%murillo%',    'Felipe Murillo'),  ('%cardona%',    'Alejandra Cardona'),
         ('%parra%',      'Juan Carlos Parra'),('%damia%',     'Damián'),
         ('%piedrahita%', 'Mara Piedrahita'), ('%hern%ndez%',  'Luis Hernández')
), ej as (
  select s.quien,
         m.numero,
         e->>'nombre'                                             as ejercicio,
         jsonb_array_length(coalesce(e->'series','[]'::jsonb))     as series_registradas,
         -- `ANOTA ESTE` viaja en la frase que lee el asesorado (`prescripcion`);
         -- `cues` va detrás por si algún microciclo lo escribió como cue técnico.
         coalesce(e->>'prescripcion','') || ' '
           || coalesce(e->>'cues','')                              as texto
    from los_seis s
    join public.usuarios_app u on u.nombre ilike s.patron
    join public.microciclos m  on m.usuario_id = u.id,
         jsonb_array_elements(coalesce(m.datos->'sesiones','[]'::jsonb)) sesion,
         jsonb_array_elements(coalesce(sesion->'ejercicios','[]'::jsonb)) e
   where (m.estado = 'activo' or m.datos->>'estado' = 'activo')
)
select quien,
       numero                                                          as microciclo,
       count(*)                                                        as ejercicios,
       count(*) filter (where series_registradas > 0)                  as con_alguna_serie,
       count(*) filter (where texto ilike '%anota este%')              as anota_este,
       count(*) filter (where texto ilike '%anota este%'
                          and series_registradas > 0)                  as anota_este_cumplidos
  from ej
 group by quien, numero
 order by quien;


-- ═════════════════════════════════════════════════════════════════════════════
-- 4 · ¿Sus sesiones traen items MARCABLES? — la de Luis
-- ═════════════════════════════════════════════════════════════════════════════
-- El ⑤ no pudo diagnosticar a Luis porque sus microciclos no aparecen en el
-- barrido de `preparacion`: o sea que sus sesiones no traen items que marcar.
-- Si esto sale en cero, su silencio NO es suyo — es que no se le dio dónde
-- decir nada, y eso se arregla al escribir el microciclo, no pidiéndoselo a él.

with los_seis(patron, quien) as (
  values ('%murillo%',    'Felipe Murillo'),  ('%cardona%',    'Alejandra Cardona'),
         ('%parra%',      'Juan Carlos Parra'),('%damia%',     'Damián'),
         ('%piedrahita%', 'Mara Piedrahita'), ('%hern%ndez%',  'Luis Hernández')
)
select s.quien,
       m.numero,
       sesion->>'nombre'                                              as sesion,
       jsonb_array_length(coalesce(sesion->'preparacion','[]'::jsonb)) as items_marcables
  from los_seis s
  join public.usuarios_app u on u.nombre ilike s.patron
  join public.microciclos m  on m.usuario_id = u.id,
       jsonb_array_elements(coalesce(m.datos->'sesiones','[]'::jsonb)) sesion
 where (m.estado = 'activo' or m.datos->>'estado' = 'activo')
 order by s.quien, sesion;


-- ═════════════════════════════════════════════════════════════════════════════
-- 5 · Test post-sesión · el otro rastro, y el que delata datos imposibles
-- ═════════════════════════════════════════════════════════════════════════════
-- Mara tiene 4 test post con RPE 0, duración 0 y PRS 0 — y el PRS 0 no existe en
-- la escala. Un test así no es contexto: es un botón pulsado. No alimenta nada.

with los_seis(patron, quien) as (
  values ('%murillo%',    'Felipe Murillo'),  ('%cardona%',    'Alejandra Cardona'),
         ('%parra%',      'Juan Carlos Parra'),('%damia%',     'Damián'),
         ('%piedrahita%', 'Mara Piedrahita'), ('%hern%ndez%',  'Luis Hernández')
)
select s.quien,
       m.numero,
       sesion->>'nombre'                                     as sesion,
       sesion->'testPost'->>'prsEntrada'                     as prs,
       sesion->'testPost'->>'rpeSesion'                      as rpe,
       sesion->'testPost'->>'duracionMin'                    as minutos,
       case when (sesion->'testPost'->>'prsEntrada') = '0'
             or (sesion->'testPost'->>'rpeSesion')  = '0'
            then '⚠ valor imposible' end                     as aviso
  from los_seis s
  join public.usuarios_app u on u.nombre ilike s.patron
  join public.microciclos m  on m.usuario_id = u.id,
       jsonb_array_elements(coalesce(m.datos->'sesiones','[]'::jsonb)) sesion
 where sesion ? 'testPost'
   and sesion->'testPost' is not null
 order by s.quien, m.numero;


-- ═════════════════════════════════════════════════════════════════════════════
-- 6 · Check-ins · la pata 2 del ⑤, sin la cual no hay causa de contexto
-- ═════════════════════════════════════════════════════════════════════════════
-- Las columnas de `checkins` no están confirmadas en el cerebro más allá del
-- jsonb `datos`. Esta consulta las LISTA primero para no adivinarlas: si la
-- segunda falla, es que la columna de persona o de fecha se llama distinto, y se
-- corrige aquí en vez de en la cabeza.

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'checkins'
 order by ordinal_position;

-- Descomentar cuando los nombres de arriba estén confirmados:
--
-- with los_seis(patron, quien) as (
--   values ('%murillo%',    'Felipe Murillo'),  ('%cardona%',    'Alejandra Cardona'),
--          ('%parra%',      'Juan Carlos Parra'),('%damia%',     'Damián'),
--          ('%piedrahita%', 'Mara Piedrahita'), ('%hern%ndez%',  'Luis Hernández')
-- )
-- select s.quien,
--        c.fecha,
--        c.datos->>'horasSueno'   as sueno,
--        c.datos->>'estres'       as estres,
--        c.datos->>'cansancio'    as cansancio,
--        c.datos->>'motivacion'   as motivacion,
--        c.datos->>'comentarios'  as comentarios
--   from los_seis s
--   join public.usuarios_app u on u.nombre ilike s.patron
--   join public.checkins c     on c.usuario_id = u.id
--  where c.fecha >= date '2026-08-01'
--  order by s.quien, c.fecha desc;
