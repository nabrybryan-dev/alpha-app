-- Comprobación de la migración 0036 (taxonomía por acción articular, fase 1).
-- Las cuatro consultas tienen que devolver CERO filas. Si alguna no lo hace, se
-- restaura desde `respaldo_0036_microciclos` antes de repartir la semana.

-- 1 · Ningún ejercicio de los microciclos migrados se quedó con una categoría
--     que no sea una de las 32 canónicas.
with canonicas as (
  select unnest(array[
    'BISAGRA DE CADERA','EXTENSIÓN DE CADERA','ABDUCCIÓN DE CADERA','ADUCCIÓN DE CADERA',
    'ROTACIÓN DE CADERA','SENTADILLA','SENTADILLA UNILATERAL','EXTENSIÓN DE RODILLA',
    'FLEXIÓN DE RODILLA','FLEXIÓN PLANTAR','DORSIFLEXIÓN','EMPUJE HORIZONTAL',
    'EMPUJE INCLINADO','EMPUJE VERTICAL','APERTURA DE PECHO','TRACCIÓN VERTICAL',
    'TRACCIÓN HORIZONTAL','EXTENSIÓN DE HOMBRO','RETRACCIÓN ESCAPULAR','ABDUCCIÓN DE HOMBRO',
    'ABDUCCIÓN HORIZONTAL','FLEXIÓN DE HOMBRO','FLEXIÓN DE CODO','EXTENSIÓN DE CODO',
    'ANTIEXTENSIÓN','ANTIRROTACIÓN','ANTIFLEXIÓN LATERAL','FLEXIÓN DE TRONCO',
    'EXTENSIÓN LUMBAR','PREV/REHAB','ACONDICIONAMIENTO','MOVILIDAD']) c
)
select '1 · categoría no canónica' as señal, m.id, e ->> 'nombre' as nombre, e ->> 'categoria' as categoria
from microciclos m
join respaldo_0036_microciclos r on r.id = m.id,
     lateral jsonb_array_elements(m.datos -> 'sesiones') s,
     lateral jsonb_array_elements(s -> 'ejercicios') e
where e ->> 'categoria' not in (select c from canonicas);

-- 2 · No se perdió ninguna sesión ni ningún ejercicio, y ninguna quedó en null.
--     Es la comprobación que faltaba en agosto, cuando una carga escribió null
--     en `sesiones` de seis microciclos y nadie lo vio hasta que avisó una
--     asesorada.
select '2 · se perdieron sesiones o ejercicios' as señal, m.id,
       jsonb_array_length(r.datos -> 'sesiones') as sesiones_antes,
       jsonb_array_length(m.datos -> 'sesiones') as sesiones_ahora
from microciclos m
join respaldo_0036_microciclos r on r.id = m.id
where m.datos -> 'sesiones' is null
   or jsonb_typeof(m.datos -> 'sesiones') <> 'array'
   or jsonb_array_length(m.datos -> 'sesiones') <> jsonb_array_length(r.datos -> 'sesiones')
   or (select count(*) from jsonb_array_elements(m.datos -> 'sesiones') s,
              lateral jsonb_array_elements(s -> 'ejercicios') e)
   <> (select count(*) from jsonb_array_elements(r.datos -> 'sesiones') s,
              lateral jsonb_array_elements(s -> 'ejercicios') e);

-- 3 · Lo único que cambió es `categoria`. Si algo más se movió —una carga, un
--     RIR, una serie registrada— la migración tocó lo que no debía.
select '3 · cambió algo que no era la categoría' as señal, m.id, e_ahora ->> 'nombre' as nombre
from microciclos m
join respaldo_0036_microciclos r on r.id = m.id,
     lateral jsonb_array_elements(m.datos -> 'sesiones') with ordinality as sa(s_ahora, i),
     lateral jsonb_array_elements(r.datos -> 'sesiones') with ordinality as sr(s_antes, j),
     lateral jsonb_array_elements(s_ahora -> 'ejercicios') with ordinality as ea(e_ahora, k),
     lateral jsonb_array_elements(s_antes -> 'ejercicios') with ordinality as er(e_antes, l)
where i = j and k = l
  and (e_ahora - 'categoria') <> (e_antes - 'categoria');

-- 4 · Ningún microciclo fuera del alcance fue tocado: los 40 sucios siguen
--     exactamente como estaban.
select '4 · se tocó un microciclo fuera del alcance' as señal, m.id
from microciclos m
where m.id not in (select id from respaldo_0036_microciclos)
  and exists (
    select 1 from jsonb_array_elements(m.datos -> 'sesiones') s,
         lateral jsonb_array_elements(s -> 'ejercicios') e
    where e ->> 'categoria' in ('ANTIEXTENSIÓN','ANTIRROTACIÓN','ANTIFLEXIÓN LATERAL',
      'ABDUCCIÓN DE HOMBRO','ABDUCCIÓN HORIZONTAL','FLEXIÓN DE CODO','EXTENSIÓN DE CODO',
      'SENTADILLA UNILATERAL','FLEXIÓN DE RODILLA','FLEXIÓN PLANTAR','DORSIFLEXIÓN')
  );
