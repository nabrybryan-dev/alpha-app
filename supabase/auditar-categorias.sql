-- Auditoria de categorias por ejercicio — que esta sumando CERO en silencio
--
-- Pegar en: Supabase → SQL Editor → New query → Run. SOLO LEE: no crea, no borra
-- y no modifica nada. Se puede ejecutar tantas veces como se quiera.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE EXISTE
-- ─────────────────────────────────────────────────────────────────────────────
-- El 2026-08-26 se descubrio que un dictamen conto 8 de los 12 ejercicios que la
-- asesorada habia hecho de verdad. Se dejo fuera los cuatro accesorios del tren
-- superior —elevacion lateral, extension de codo, curl y face pull— y por eso su
-- volumen de hombro salia a 4,5 series cuando eran 10,5.
--
-- Ese fallo concreto fue de conteo a mano. Pero deja ver uno mas grande y callado:
-- **el volumen de un ejercicio sale de su `categoria`, y si esa categoria esta
-- vacia o no es una de las 32 canonicas, el ejercicio suma CERO a todos los
-- grupos.** No falla, no avisa: desaparece del PANEL y de los landmarks.
--
-- Y no desaparece para una persona: desaparece para TODAS las que tengan ese
-- ejercicio, en todos sus microciclos, hasta que alguien lo mire.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LO QUE ESTA CONSULTA NO PUEDE CONTESTAR
-- ─────────────────────────────────────────────────────────────────────────────
-- Si una categoria esta BIEN ESCRITA pero es la EQUIVOCADA —un curl catalogado
-- como traccion— esto no lo ve: es canonica y suma. Eso solo lo caza alguien que
-- conozca el ejercicio, y para eso esta el apartado 2.


-- ═════════════════════════════════════════════════════════════════════════════
-- 0 · Las 32 canonicas, para tenerlas delante
-- ═════════════════════════════════════════════════════════════════════════════
-- Salen de `wiki/estructura-excel/04-taxonomia-categorias.md` §3bis, que es la
-- fuente de verdad, y coinciden con `alpha-app/src/domain/taxonomia.ts`.

with canonicas(categoria, directo, indirecto) as (
  values
         ('ABDUCCIÓN DE CADERA', 'Glúteos', '—'),
         ('ABDUCCIÓN DE HOMBRO', 'Hombros', '—'),
         ('ABDUCCIÓN HORIZONTAL', 'Hombros', 'Espalda'),
         ('ACONDICIONAMIENTO', '—', '—'),
         ('ADUCCIÓN DE CADERA', 'Aductores', '—'),
         ('ANTIEXTENSIÓN', 'Abdomen', '—'),
         ('ANTIFLEXIÓN LATERAL', 'Abdomen', 'Glúteos'),
         ('ANTIRROTACIÓN', 'Abdomen', '—'),
         ('APERTURA DE PECHO', 'Pecho', 'Hombros'),
         ('BISAGRA DE CADERA', 'Isquios', 'Glúteos · Lumbares'),
         ('DORSIFLEXIÓN', '—', 'Pantorrillas'),
         ('EMPUJE HORIZONTAL', 'Pecho', 'Tríceps · Hombros'),
         ('EMPUJE INCLINADO', 'Pecho', 'Hombros · Tríceps'),
         ('EMPUJE VERTICAL', 'Hombros', 'Tríceps · Pecho'),
         ('EXTENSIÓN DE CADERA', 'Glúteos', 'Isquios'),
         ('EXTENSIÓN DE CODO', 'Tríceps', '—'),
         ('EXTENSIÓN DE HOMBRO', 'Espalda', 'Tríceps'),
         ('EXTENSIÓN DE RODILLA', 'Cuádriceps', '—'),
         ('EXTENSIÓN LUMBAR', 'Lumbares', 'Glúteos · Isquios'),
         ('FLEXIÓN DE CODO', 'Bíceps', '—'),
         ('FLEXIÓN DE HOMBRO', 'Hombros', 'Pecho'),
         ('FLEXIÓN DE RODILLA', 'Isquios', '—'),
         ('FLEXIÓN DE TRONCO', 'Abdomen', '—'),
         ('FLEXIÓN PLANTAR', 'Pantorrillas', '—'),
         ('MOVILIDAD', '—', '—'),
         ('PREV/REHAB', '—', '—'),
         ('RETRACCIÓN ESCAPULAR', 'Espalda', 'Hombros'),
         ('ROTACIÓN DE CADERA', '—', 'Glúteos'),
         ('SENTADILLA', 'Cuádriceps', 'Glúteos · Aductores'),
         ('SENTADILLA UNILATERAL', 'Glúteos', 'Cuádriceps'),
         ('TRACCIÓN HORIZONTAL', 'Espalda', 'Bíceps · Hombros'),
         ('TRACCIÓN VERTICAL', 'Espalda', 'Bíceps')
)
select categoria, directo as "suma 1,0 a", indirecto as "suma 0,5 a"
from canonicas
order by categoria;


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
         m.datos->>'microciclo'                          as microciclo,
         sesion->>'nombre'                               as sesion,
         e->>'nombre'                                    as ejercicio,
         nullif(trim(coalesce(e->>'categoria','')), '')  as categoria,
         coalesce((e->>'sets')::int, 0)                  as sets
  from microciclos m
  join usuarios_app u on u.id = m.usuario_id,
       jsonb_array_elements(coalesce(m.datos->'sesiones','[]'::jsonb)) sesion,
       jsonb_array_elements(coalesce(sesion->'ejercicios','[]'::jsonb)) e
)
select coalesce(ej.categoria, '(VACIA)')      as categoria_escrita,
       ej.ejercicio,
       count(*)                               as veces,
       count(distinct ej.asesorado)           as personas,
       sum(ej.sets)                           as series_que_no_se_cuentan,
       string_agg(distinct ej.asesorado, ', ') as quienes
from ejercicios ej
left join canonicas c
       on upper(c.categoria) = upper(coalesce(ej.categoria,''))
where c.categoria is null                       -- no casa con ninguna canonica
group by 1, 2
order by series_que_no_se_cuentan desc, veces desc;

-- OJO: el cruce es por texto EXACTO en mayusculas. Una categoria que solo se
-- diferencie por una TILDE saldra aqui, y eso NO es ruido: es exactamente el
-- fallo, porque el codigo de la app tolera acentos pero cualquier consulta a
-- mano no. Si salen muchas por eso, es que hay dos formas conviviendo.


-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · El catalogo completo · que categoria lleva cada ejercicio
-- ═════════════════════════════════════════════════════════════════════════════
-- Para leerlo de arriba abajo UNA vez y cazar el fallo que la consulta 1 no ve:
-- la categoria bien escrita pero equivocada. Es trabajo de coach, no de SQL.

select nullif(trim(coalesce(e->>'categoria','')), '') as categoria,
       e->>'nombre'                                   as ejercicio,
       count(*)                                       as veces,
       count(distinct m.usuario_id)                   as personas
from microciclos m,
     jsonb_array_elements(coalesce(m.datos->'sesiones','[]'::jsonb)) sesion,
     jsonb_array_elements(coalesce(sesion->'ejercicios','[]'::jsonb)) e
group by 1, 2
order by 1 nulls first, 2;


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
       sum(coalesce((e->>'sets')::int, 0))              as series_perdidas
from microciclos m
join usuarios_app u on u.id = m.usuario_id,
     jsonb_array_elements(coalesce(m.datos->'sesiones','[]'::jsonb)) sesion,
     jsonb_array_elements(coalesce(sesion->'ejercicios','[]'::jsonb)) e
left join canonicas c
       on upper(c.categoria) = upper(trim(coalesce(e->>'categoria','')))
where c.categoria is null
group by 1
order by series_perdidas desc;


-- ═════════════════════════════════════════════════════════════════════════════
-- 4 · La comprobacion de Dhanny, que es la que origino todo esto
-- ═════════════════════════════════════════════════════════════════════════════
-- Cuantas SERIES registro de verdad en cada ejercicio del UPPER A de su M22. Es
-- el dato que falta para cerrar su dictamen: si los cuatro accesorios salen a 3,
-- el conteo corregido cuadra exacto con lo que se le escribio en el M23.

select sesion->>'nombre'                          as sesion,
       e->>'nombre'                               as ejercicio,
       e->>'categoria'                            as categoria,
       (e->>'sets')::int                          as series_pautadas,
       jsonb_array_length(coalesce(e->'series','[]'::jsonb)) as series_registradas
from microciclos m
join usuarios_app u on u.id = m.usuario_id,
     jsonb_array_elements(coalesce(m.datos->'sesiones','[]'::jsonb)) sesion,
     jsonb_array_elements(coalesce(sesion->'ejercicios','[]'::jsonb)) e
where u.nombre ilike '%dhanny%'
  and coalesce(m.datos->>'microciclo', '') ilike '%22%'
order by sesion, (e->>'orden')::int;
