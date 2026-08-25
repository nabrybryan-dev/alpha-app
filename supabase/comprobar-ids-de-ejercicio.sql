-- ¿Sirve `ejercicio.id` como clave de `estandarizado_ejercicio`?
--
-- ESTO SE CORRE ANTES DE LA MIGRACION, y decide si la migracion se aplica.
--
-- POR QUE EXISTE. El diseño de `estandarizado` usa el id del ejercicio como
-- clave de linaje: cuenta tres microciclos seguidos sin nota tecnica nueva y con
-- el RIR dentro de mas/menos 1. Eso solo funciona si el id (a) sobrevive al
-- clonado y (b) es unico dentro de una persona.
--
-- (a) esta VERIFICADO CONTRA EL CODIGO: `tmp_cargar_siguiente` inserta
--     `tmp_nuevo_micro(...) || jsonb_build_object('id', v_id)`, que solo
--     reescribe el id del MICROCICLO; `tmp_nuevo_micro` parte de cada ejercicio
--     `e` y solo vacia `series` y sustituye campos concretos; y
--     `tmp_sesion_en_limpio` solo toca cardio, preparacion y testPost. El id del
--     ejercicio no lo toca nadie en toda la cadena.
--
-- (b) NO se puede saber leyendo codigo. Si el coach duplico una sesion, o dos
--     microciclos se construyeron por separado, puede haber ids repetidos. Eso
--     es lo que mide esta consulta.
--
-- Y hay precedente para no fiarse del codigo solo: la pagina del PRS decia tres
-- botones dieciocho dias despues de que el codigo tuviera cuatro, y una
-- respuesta real se leyo como dato corrupto.
--
--   VEREDICTO: si las cuatro filas dicen OK, la migracion puede aplicarse.
--
-- ══ CORRIDA DEL 2026-08-25 · LAS CUATRO OK ════════════════════════════════
--   1 · ejercicios sin id ................................ 0    OK
--   2 · ids repetidos dentro de un microciclo ............ 0    OK
--   3 · ids compartidos entre usuarios ................... 0    OK
--   4 · ejercicios en 3+ microciclos de la misma persona . 424  OK
--
-- La clave `ejercicio.id` es valida: unica, estable y con 424 linajes reales
-- detras. Lo que se dedujo leyendo el SQL del clonador queda confirmado con
-- datos delante.
--
-- Y de paso salio un hallazgo que no se buscaba: **79 ejercicios tienen texto
-- en `rirObjetivo`** —Control, Isometria, Movilidad, Test, Cribado, Suave,
-- Conversacional— mas 12 que son valores de verdad escritos como texto,
-- «RIR 1» y «RIR 2-3», todos de Manuela Quintero y 2 en microciclo activo.
-- La 0041 no cerro del todo el patron de las 81 series. `desviacionDeRir` en
-- TypeScript ya lo sobrevive (typeof !== 'number' -> undefined), pero esos 12
-- nunca podran estandarizar hasta que sean numeros.

-- ── 1 · Ningun ejercicio sin id ────────────────────────────────────────────
-- Un id nulo o vacio no puede ser clave. Si aparece, hay que rellenarlos antes.
select '1 · ejercicios sin id' as comprueba,
       count(*)::text as sale,
       '0' as tiene_que_dar,
       case when count(*) = 0 then 'OK' else 'FALLA' end as veredicto
  from public.microciclos m,
       jsonb_array_elements(m.datos->'sesiones') s,
       jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
 where coalesce(e->>'id','') = ''

union all

-- ── 2 · Ningun id repetido DENTRO del mismo microciclo ─────────────────────
-- Es el caso mas probable: duplicar una sesion copiando el bloque entero. Si
-- pasa, dos ejercicios distintos comparten linaje y el contador de
-- estandarizacion mezclaria sus rachas.
select '2 · ids repetidos dentro de un microciclo',
       count(*)::text,
       '0',
       case when count(*) = 0 then 'OK' else 'FALLA' end
  from (
    select m.id, e->>'id' as eid
      from public.microciclos m,
           jsonb_array_elements(m.datos->'sesiones') s,
           jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
     where coalesce(e->>'id','') <> ''
     group by 1, 2
    having count(*) > 1
  ) d

union all

-- ── 3 · Ningun id compartido entre DOS PERSONAS ────────────────────────────
-- La clave primaria es (usuario_id, ejercicio_id), asi que compartir id entre
-- personas no rompe nada por si mismo. Se mide igualmente: si sale distinto de
-- cero, los ids no se generan por persona y conviene saberlo antes de apoyarse
-- en ellos para otra cosa.
select '3 · ids compartidos entre usuarios (informativo)',
       count(*)::text,
       '0 (si no, no es bloqueante)',
       case when count(*) = 0 then 'OK' else 'MIRAR' end
  from (
    select e->>'id' as eid
      from public.microciclos m,
           jsonb_array_elements(m.datos->'sesiones') s,
           jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
     where coalesce(e->>'id','') <> ''
     group by 1
    having count(distinct m.usuario_id) > 1
  ) d

union all

-- ── 4 · ¿Hay linajes de verdad? ────────────────────────────────────────────
-- La prueba de que el id SI persiste, medida y no deducida: cuantos ejercicios
-- aparecen con el mismo id en tres o mas microciclos de la misma persona. Si
-- esto sale 0, el id se regenera en alguna parte que el codigo no delata, y el
-- diseño entero de `estandarizado` hay que rehacerlo sobre otra clave.
select '4 · ejercicios presentes en 3+ microciclos de la misma persona',
       count(*)::text,
       '>0',
       case when count(*) > 0 then 'OK' else 'FALLA' end
  from (
    select m.usuario_id, e->>'id' as eid
      from public.microciclos m,
           jsonb_array_elements(m.datos->'sesiones') s,
           jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
     where coalesce(e->>'id','') <> ''
     group by 1, 2
    having count(distinct m.id) >= 3
  ) d;


-- ── Detalle, por si algo FALLA ─────────────────────────────────────────────
-- Descomentar para ver QUE ids estan repetidos dentro de un microciclo.
--
-- select m.id as microciclo, e->>'id' as ejercicio_id,
--        string_agg(e->>'nombre', ' | ') as nombres, count(*) as veces
--   from public.microciclos m,
--        jsonb_array_elements(m.datos->'sesiones') s,
--        jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
--  where coalesce(e->>'id','') <> ''
--  group by 1, 2
-- having count(*) > 1
--  order by veces desc;
