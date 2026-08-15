-- 0036 · Taxonomía por acción articular (fase 1: los microciclos ya limpios)
--
-- Reescribe la CATEGORÍA de cada ejercicio a una de las 32 acciones articulares
-- de `Cerebro Alpha/wiki/estructura-excel/04-taxonomia-categorias.md`.
--
-- POR QUÉ NO SE DEDUCE DE LA CATEGORÍA VIEJA: no es determinista. `AISLAMIENTO
-- GLÚTEOS` contiene abducciones, empujes de cadera, hiperextensiones y zancadas;
-- `ESPALDA BAJA` contiene remos. El nombre del ejercicio es la fuente fiable,
-- igual que en la limpieza del 2026-08-09.
--
-- ALCANCE: solo los 33 microciclos cuyas categorías ya están en la lista
-- simplificada de 22 (849 ejercicios). Los 40 restantes llevan basura de
-- programación en la categoría (`PRIORIDAD 1`, `(A2)`, `SERIE GIGANTE B1`) y van
-- en una fase 2 con revisión nombre a nombre.
--
-- ENSAYO EN SECO (2026-08-12): 849 de 849 clasificados, 0 sin clasificar.
-- 53 ejercicios cambian de grupo muscular, todos correcciones: los face pull
-- dejan de contar como espalda, las zancadas dejan de contar como glúteo
-- aislado, y 12 ejercicios que no contaban en ningún grupo pasan a contar.
--
-- La prescripción no se toca: solo cambia el campo `categoria`.

begin;

-- 1 · Respaldo. Lleva datos reales de salud: RLS en el mismo paso que el create.
create table if not exists respaldo_0036_microciclos as
select id, datos, now() as respaldado_en from microciclos where false;

alter table respaldo_0036_microciclos enable row level security;

-- 2 · Clasificador nombre -> categoría canónica.
--
-- Primer patrón que calza gana: el ORDEN ES LA REGLA, y cada excepción de abajo
-- costó un ejercicio mal clasificado en el ensayo en seco:
--   · COPENHAGUE antes que PLANCHA      → la plancha Copenhague es aducción.
--   · Los CURL antes que INCLINADO      → «Curl banco inclinado» no es un press.
--   · APERTURAS? INVERSAS?              → el plural caía en apertura de pecho.
--   · Solo «ISOMETRIA DE SOSTEN»        → «Sentadilla (isométrico)» sigue siendo
--     una sentadilla; la palabra suelta le borraba el patrón.
create or replace function tmp_categoria_de(nombre text) returns text
language sql immutable as $$
  select case
    when n ~ 'CARDIO|BICICLETA|CINTA|ESCALADORA|ELIPTICA|HIIT|CIRCUITO|TABATA|ERGOMETRO' then 'ACONDICIONAMIENTO'
    when n ~ 'MOVILIDAD|DISLOCACION|FOAM ROLLER' then 'MOVILIDAD'
    when n ~ 'MANGUITO|ROTADOR EXTERNO|ISOMETRIA DE SOSTEN|SUSPENSION|DEAD HANG|COLGADO EN BARRA|POGO|SALTOS CORTOS|ATERRIZAJE|APOYO ESTABLE|EQUILIBRIO|ARCO PLANTAR|SHORT FOOT|TIBIAL POSTERIOR|FUERZA REACTIVA|PLIOMETRIA' then 'PREV/REHAB'
    when n ~ 'COPENHAGUE|ADUCCION|ADUCTOR' then 'ADUCCIÓN DE CADERA'
    when n ~ 'PLANCHA LATERAL|PASEO DEL GRANJERO|CAMINATA CARGADA|FARMER|SUITCASE' then 'ANTIFLEXIÓN LATERAL'
    when n ~ 'PALLOF|ANTIRROTACION' then 'ANTIRROTACIÓN'
    when n ~ 'PLANCHA|DEAD BUG|BICHO MUERTO|RUEDA ABDOMINAL|AB WHEEL|BIRD DOG|PERRO DE MUESTRA' then 'ANTIEXTENSIÓN'
    when n ~ 'CRUNCH|ELEVACION DE PIERNAS|SIT.?UP' then 'FLEXIÓN DE TRONCO'
    when n ~ 'BANCO ROMANO|EXTENSION LUMBAR' then 'EXTENSIÓN LUMBAR'
    when n ~ 'ELEVACION DE PUNTAS|TIBIALIS|TIBIAL ANTERIOR|DORSIFLEXION' then 'DORSIFLEXIÓN'
    when n ~ 'ELEVACION DE TALONES|GEMELO|SOLEO|PANTORRILLA|(PLATI|PLANTI).?FLEXION|FLEXION PLANTAR' then 'FLEXIÓN PLANTAR'
    when n ~ 'ABDUCCION|CLAMSHELL|ALMEJA' then 'ABDUCCIÓN DE CADERA'
    when n ~ '90/90|ROTACION (EXTERNA|INTERNA) DE CADERA' then 'ROTACIÓN DE CADERA'
    when n ~ 'PESO MUERTO|RACK PULL|BUENOS DIAS|GOOD MORNING|BISAGRA|PULL.?THROUGH|BANCO 45' then 'BISAGRA DE CADERA'
    when n ~ 'HIP THRUST|EMPUJE DE CADERA|PUENTE DE GLUTEO|PATADA DE GLUTEO|PATADA DE SPRINTER|FROG PUMP|HIPEREXTENSION|EXTENSION DE CADERA|KICKBACK' then 'EXTENSIÓN DE CADERA'
    when n ~ 'CURL FEMORAL|CURL NORDICO|NORDICO|FLEXION (DE )?RODILLA|FEMORAL' then 'FLEXIÓN DE RODILLA'
    when n ~ 'TRICEPS|PRESS JM|PRESS FRANCES|TRASNUCA|FONDOS EN BANCO|PATADA DE TRICEPS|EXTENSION DE CODO' then 'EXTENSIÓN DE CODO'
    when n ~ 'CURL|BICEPS|PREDICADOR|MARTILLO|FLEXION DE CODO' then 'FLEXIÓN DE CODO'
    -- Antes que las sentadillas: la sissy lleva «sentadilla» en el nombre y
    -- caía ahí, y no es lo mismo. La sentadilla paga 0,5 a glúteo y aductores;
    -- la extensión de rodilla no paga nada fuera del cuádriceps.
    when n ~ 'EXTENSION DE RODILLA|EXTENSION DE CUADRICEPS|SISSY' then 'EXTENSIÓN DE RODILLA'
    when n ~ 'BULGARA|ZANCADA|SPLIT SQUAT|SUBIDA AL CAJON|STEP.?UP|STEP.?DOWN|BAJADA CONTROLADA' or (n ~ 'UNILATERAL' and n ~ 'SENTADILLA|PRENSA') then 'SENTADILLA UNILATERAL'
    when n ~ 'SENTADILLA|PRENSA|HACK|GOBLET' then 'SENTADILLA'
    when n ~ 'PULLOVER|PULLDOWN|BRAZO (RIGIDO|RECTO)' then 'EXTENSIÓN DE HOMBRO'
    when n ~ 'ENCOGIMIENTO|SHRUG|TRAPECIO|ELEVACIONES? Y|REMO AL MENTON|PULL APART' then 'RETRACCIÓN ESCAPULAR'
    when n ~ 'APERTURAS? INVERSAS?|FACE PULL|PAJARO|REVERSE FLY|APERTURA DE BANDA' then 'ABDUCCIÓN HORIZONTAL'
    when n ~ 'JALON|DOMINADA|PULL.?UP|CHIN.?UP' then 'TRACCIÓN VERTICAL'
    when n ~ 'REMO|SEAL ROW' then 'TRACCIÓN HORIZONTAL'
    when n ~ 'ELEVACION(ES)? LATERAL' then 'ABDUCCIÓN DE HOMBRO'
    when n ~ 'ELEVACION(ES)? FRONTAL' then 'FLEXIÓN DE HOMBRO'
    when n ~ 'PRESS MILITAR|PRESS DE HOMBRO|PRESS ARNOLD|FONDOS|OVERHEAD' then 'EMPUJE VERTICAL'
    when n ~ 'PECK DECK|CONTRACTOR|APERTURA' then 'APERTURA DE PECHO'
    when n ~ 'INCLINADO' and n ~ 'PRESS|BANCA|BANCO|PECHO' then 'EMPUJE INCLINADO'
    when n ~ 'PRESS (DE )?BANCA|PRESS (BANCO )?PLANO|PRESS DE PECHO|FLEXIONES|PRESS EN MAQUINA' then 'EMPUJE HORIZONTAL'
    else null
  end
  from (select upper(translate(coalesce(nombre,''),'áéíóúÁÉÍÓÚüÜñÑ','aeiouAEIOUuUnN')) n) t
$$;

-- `create function` concede EXECUTE a PUBLIC, y todo lo de `public` se expone
-- como RPC a `anon`. Sin este revoke queda al alcance de la anon key.
revoke execute on function tmp_categoria_de(text) from public;

-- 3 · El alcance: los microciclos cuyas categorías ya están todas en la lista
-- simplificada de 22. Los demás no se tocan.
create temporary table tmp_alcance_0036 on commit drop as
with ej as (
  select m.id, e->>'categoria' as cat
  from microciclos m,
       lateral jsonb_array_elements(m.datos->'sesiones') s,
       lateral jsonb_array_elements(s->'ejercicios') e
)
select id from ej
group by id
having count(*) = count(*) filter (where cat in (
  'AISLAMIENTO GLÚTEOS','TRACCIÓN HORIZONTAL','BISAGRA DE CADERA','SENTADILLAS',
  'TRACCIÓN VERTICAL','AISLAMIENTO ISQUIOS','TRÍCEPS','BÍCEPS','PIERNA UNILATERAL',
  'DELTOIDES LATERALES','PANTORRILLAS','AISLAMIENTO CUÁDRICEPS','EMPUJE VERTICAL',
  'ESPALDA SUPERIOR','DELTOIDES POSTERIORES','ADUCTORES','EMPUJE HORIZONTAL',
  'EMPUJE INCLINADO','ABDOMEN','PREV/REHAB','AISLAMIENTO PECTORAL','ESPALDA BAJA',
  'DELTOIDES FRONTALES','ACONDICIONAMIENTO'));

insert into respaldo_0036_microciclos (id, datos, respaldado_en)
select id, datos, now() from microciclos where id in (select id from tmp_alcance_0036);

-- 4 · La reescritura.
--
-- `jsonb_agg` de cero filas devuelve NULL, no `[]`, y `jsonb_set` con NULL se
-- lleva la sesión entera. De ahí el `coalesce`: es el fallo que en agosto dejó
-- seis microciclos con `sesiones` en null y borró siete sesiones de cardio.
-- El `with ordinality` conserva el orden de los arrays.
--
-- Si el clasificador no reconoce un nombre, se queda la categoría que tenía:
-- nunca se escribe null encima de un dato bueno.
update microciclos m
set datos = jsonb_set(m.datos, '{sesiones}', (
  select coalesce(jsonb_agg(
    case
      when jsonb_typeof(s -> 'ejercicios') = 'array' then jsonb_set(s, '{ejercicios}', (
        select coalesce(jsonb_agg(
          jsonb_set(e, '{categoria}',
            to_jsonb(coalesce(tmp_categoria_de(e ->> 'nombre'), e ->> 'categoria')))
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
where m.id in (select id from tmp_alcance_0036);

drop function tmp_categoria_de(text);

commit;

-- Después de aplicar, correr en este orden y exigir cero filas en las tres:
--   supabase/comprobar-0036.sql
--   supabase/comprobar-sesiones.sql
--   supabase/comprobar-fosiles.sql
