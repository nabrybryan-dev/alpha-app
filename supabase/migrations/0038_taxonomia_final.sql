-- 0038 · La taxonomía final, sobre los 73 microciclos
--
-- Cierra lo que la 0036 dejó a medias y corrige lo que dejó mal:
--   · Los 40 microciclos sucios (960 ejercicios) que la 0036 no tocó.
--   · Los 13 «Extensión de cadera en banco 45°» que quedaron en BISAGRA DE
--     CADERA y no lo son.
--   · `m-jacobo-2`, que el móvil de su dueño revirtió el mismo día.
--
-- Incorpora las 44 decisiones de Bryan
-- (`wiki/estructura-excel/_revision-fase2-decisiones-2026-08-15.md`).
--
-- NO SE APLICA HASTA QUE LA APP CON LA 0037 ESTÉ DESPLEGADA. Mientras el móvil
-- suba el blob entero, cualquier microciclo activo puede deshacer esto — que es
-- exactamente lo que le pasó a la 0036 el día que se aplicó.

begin;

create table if not exists respaldo_0038_microciclos as
select id, datos, now() as respaldado_en from microciclos where false;

alter table respaldo_0038_microciclos enable row level security;

-- Clasificador. El orden es la regla, y cada excepción de abajo costó un
-- ejercicio mal clasificado en un ensayo en seco.
create or replace function tmp_categoria_final(nombre text) returns text
language sql immutable as $$
  select case
    -- Nombres que por sí solos no dicen qué son. Se resolvieron mirando con qué
    -- ejercicios comparten sesión: el hueco que dejan los delata.
    when n = 'ELEVACION EN POLEA' then 'ABDUCCIÓN DE HOMBRO'
    when n = 'EXTENSION EN POLEA' then 'EXTENSIÓN DE CODO'
    when n = 'PRESS MAQUINA AGARRE NEUTRO' then 'EMPUJE HORIZONTAL'
    when n = 'MAQUINA DE GLUTEO' then 'EXTENSIÓN DE CADERA'
    when n ~ 'LIME PRESS' then 'EMPUJE VERTICAL'   -- con barra, no máquina: hombro anterior y medial

    -- Lo que no suma volumen de hipertrofia. Va primero porque varios de estos
    -- llevan dentro el nombre de un patrón que sí contaría.
    when n ~ 'CARDIO|BICICLETA|CINTA|ESCALADORA|ELIPTICA|HIIT|CIRCUITO|TABATA|ERGOMETRO|TRINEO|SWING' then 'ACONDICIONAMIENTO'
    when n ~ 'MOVILIDAD|DISLOCACION|FOAM ROLLER|GATO.?CAMELLO' then 'MOVILIDAD'
    when n ~ 'MANGUITO|ROTADOR|ROTACION EXTERNA|PULL APART|CONTROL ESCAPULAR|ACTIVACION GLUTEA|ISOMETRIA DE SOSTEN|SUSPENSION|DEAD HANG|COLGADO EN BARRA|POGO|SALTOS CORTOS|ATERRIZAJE|APOYO ESTABLE|APOYO MONOPODAL|EQUILIBRIO|ARCO PLANTAR|SHORT FOOT|TIBIAL POSTERIOR|FUERZA REACTIVA|PLIOMETRIA'
         and n !~ 'ELEVACIONES? Y|FACE PULL|DE CADERA' then 'PREV/REHAB'

    -- Tronco. El bird dog es cadena cruzada posterior: resiste rotación.
    when n ~ 'COPENHAGUE' then 'ADUCCIÓN DE CADERA'
    when n ~ 'PALLOF|ANTIRROTACION|BIRD.?DOG|PERRO DE MUESTRA' then 'ANTIRROTACIÓN'
    when n ~ 'PLANCHA LATERAL|SIDE BRIDGE|PASEO DEL GRANJERO|CAMINATA DEL GRANJERO|CAMINATA CARGADA|FARMER|SUITCASE' then 'ANTIFLEXIÓN LATERAL'
    when n ~ 'PLANCHA|DEAD BUG|BICHO MUERTO|RUEDA ABDOMINAL|AB WHEEL|HOLLOW' then 'ANTIEXTENSIÓN'
    when n ~ 'CRUNCH|ELEVACION DE PIERNAS|SIT.?UP' then 'FLEXIÓN DE TRONCO'
    when n ~ 'BANCO ROMANO|EXTENSION LUMBAR' then 'EXTENSIÓN LUMBAR'

    -- Tobillo antes que pierna: «elevación de talones en prensa» no es prensa.
    when n ~ 'ELEVACION DE PUNTAS|TIBIALIS|TIBIAL ANTERIOR|DORSIFLEXION' then 'DORSIFLEXIÓN'
    when n ~ 'ELEVACION DE TALONES|GEMELO|SOLEO|PANTORRILLA|(PLATI|PLANTI).?FLEXION|FLEXION PLANTAR' then 'FLEXIÓN PLANTAR'

    -- Hombro antes que cadera: «elevación lateral (abducción de hombro)» lleva
    -- la palabra ABDUCCION y caía en la cadera.
    when n ~ 'ELEVACION(ES)? LATERAL' then 'ABDUCCIÓN DE HOMBRO'
    when n ~ 'ELEVACION(ES)? FRONTAL' then 'FLEXIÓN DE HOMBRO'

    when n ~ 'ADUCCION|ADUCTOR' then 'ADUCCIÓN DE CADERA'
    when n ~ 'ABDUCCION|CLAMSHELL|ALMEJA' then 'ABDUCCIÓN DE CADERA'
    when n ~ '90/90|ROTACION (EXTERNA|INTERNA) DE CADERA' then 'ROTACIÓN DE CADERA'

    -- La hiperextensión NO es una bisagra: en el banco de 45° el segmento móvil
    -- es el torso y el fijo el tren inferior. Va antes que la bisagra porque
    -- varios nombres arrastran un «(bisagra de cadera)» que se contradice.
    when n ~ 'HIPEREXTENSION|BANCO 45|REVERSE HYPER|HIP THRUST|EMPUJE DE CADERA|PUENTE DE GLUTEO|PATADA DE GLUTEO|PATADA DE SPRINTER|FROG PUMP|EXTENSION (DE )?CADERA|KICKBACK' then 'EXTENSIÓN DE CADERA'
    when n ~ 'PESO MUERTO|RACK PULL|BUENOS DIAS|GOOD MORNING|BISAGRA|PULL.?THROUGH' then 'BISAGRA DE CADERA'
    when n ~ 'CURL FEMORAL|CURL NORDICO|NORDICO|FLEXION (DE )?RODILLA|FEMORAL' then 'FLEXIÓN DE RODILLA'

    -- Brazo antes que pierna: «curl banco inclinado» no es un press inclinado.
    when n ~ 'TRICEPS|PRESS JM|JM PRESS|ENTERRADORAS|PRESS FRANCES|TRASNUCA|FONDOS EN BANCO|PATADA DE TRICEPS|EXTENSION (DE )?CODO' then 'EXTENSIÓN DE CODO'
    when n ~ 'CURL|BICEPS|PREDICADOR|MARTILLO|FLEXION DE CODO' then 'FLEXIÓN DE CODO'

    -- El wall sit y la isometría española cuentan volumen de cuádriceps.
    -- Ojo al «isométrico» suelto: «empuje de cadera (isométrico)» sigue siendo
    -- extensión de cadera, y ya salió arriba.
    when n ~ 'EXTENSION DE RODILLA|EXTENSION DE CUADRICEPS|SISSY' then 'EXTENSIÓN DE RODILLA'
    when n ~ 'ISOMETRIC|ISOMETRIA' and n ~ 'SENTADILLA|PARED' then 'EXTENSIÓN DE RODILLA'

    when n ~ 'BULGARA|ZANCADA|SPLIT SQUAT|SUBIDA AL CAJON|STEP.?UP|STEP.?DOWN|BAJADA CONTROLADA'
         or (n ~ 'UNILATERAL' and n ~ 'SENTADILLA|PRENSA') then 'SENTADILLA UNILATERAL'
    when n ~ 'SENTADILLA|PRENSA|HACK|GOBLET' then 'SENTADILLA'

    -- Espalda y hombro.
    when n ~ 'PULLOVER|PULLDOWN|BRAZO (RIGIDO|RECTO)' then 'EXTENSIÓN DE HOMBRO'
    when n ~ 'ENCOGIMIENTO|SHRUG|TRAPECIO|ELEVACIONES? Y|REMO AL MENTON|KELSO' then 'RETRACCIÓN ESCAPULAR'
    when n ~ 'APERTURAS? INVERSAS?|FACE PULL|PAJARO|REVERSE FLY|APERTURA DE BANDA' then 'ABDUCCIÓN HORIZONTAL'
    when n ~ 'JALON|DOMINADA|PULL.?UP|CHIN.?UP' then 'TRACCIÓN VERTICAL'
    when n ~ 'REMO|SEAL ROW' then 'TRACCIÓN HORIZONTAL'

    -- Empuje. El inclinado antes que el plano, y el vertical antes que los dos.
    when n ~ 'PRESS MILITAR|PRESS DE HOMBRO|PRESS ARNOLD|PRESS VERTICAL|FONDOS|OVERHEAD' then 'EMPUJE VERTICAL'
    when n ~ 'PECK DECK|CONTRACTOR|APERTURA|CRUCE (DE POLEAS|EN POLEA)' then 'APERTURA DE PECHO'
    when n ~ 'INCLINADO' and n ~ 'PRESS|BANCA|BANCO|PECHO' then 'EMPUJE INCLINADO'
    when n ~ 'PRESS (DE )?BANCA|PRESS (BANCO )?PLANO|PRESS DE PECHO|FLEXIONES|PRESS EN MAQUINA' then 'EMPUJE HORIZONTAL'
    else null
  end
  from (select upper(translate(coalesce(nombre,''),'áéíóúÁÉÍÓÚüÜñÑ','aeiouAEIOUuUnN')) n) t
$$;

revoke execute on function tmp_categoria_final(text) from public, anon;

insert into respaldo_0038_microciclos (id, datos, respaldado_en)
select id, datos, now() from microciclos
where id not in (select id from respaldo_0038_microciclos);

update microciclos m
set datos = jsonb_set(m.datos, '{sesiones}', (
  select coalesce(jsonb_agg(
    case
      when jsonb_typeof(s -> 'ejercicios') = 'array' then jsonb_set(s, '{ejercicios}', (
        select coalesce(jsonb_agg(
          jsonb_set(e, '{categoria}',
            to_jsonb(coalesce(tmp_categoria_final(e ->> 'nombre'), e ->> 'categoria')))
          order by orden_e
        ), '[]'::jsonb)
        from jsonb_array_elements(s -> 'ejercicios') with ordinality as ejs(e, orden_e)
      ))
      else s
    end
    order by orden_s
  ), '[]'::jsonb)
  from jsonb_array_elements(m.datos -> 'sesiones') with ordinality as ses(s, orden_s)
))
where m.id in (select id from respaldo_0038_microciclos);

drop function tmp_categoria_final(text);

commit;

-- Después: supabase/comprobar-0038.sql, y las cinco señales en cero.
