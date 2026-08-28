-- ¿Alguna prescripcion NUEVA lleva la carga en una forma que el parser no sabe leer?
--
-- CONTRATO: cero filas en microciclos ACTIVOS. Se corre con las demas despues de
-- cada carga.
--
-- QUE VIGILA. La cabecera canonica es `{CARGA}KG A {REPS} REPS; {N} SERIES`, y es
-- la unica que `src/domain/prescripcion.ts` sabe partir. Cuando la frase empieza
-- por kilos pero no encaja en ese patron, `cargaKg` se queda vacio — y entonces
-- el ejercicio es INVISIBLE para `comprobar-alineacion-ejecutada.sql`, que es la
-- que compara lo pautado contra lo registrado. No falla nada: simplemente ese
-- ejercicio deja de estar vigilado, que es peor porque no se nota.
--
-- POR QUE ESTO Y NO AMPLIAR LA GRAMATICA. Medido el 2026-08-25: de las 108 filas
-- sin `cargaKg` con pinta de cabecera, **77 son de julio y 4 de agosto**, y las
-- formas sueltas —`A 12;` sin la palabra REPS, `x13` en vez de `A 13 REPS`,
-- `A 11 REPS (10-12)` con el rango en parentesis— tienen CERO apariciones en
-- agosto. Es un estilo que se dejo de escribir solo. Ampliar `CABECERA` para
-- cazarlas habria tocado el nucleo del que cuelgan el cargador, el alineador y el
-- compositor, para recuperar 10 ejercicios historicos que ademas se caen de la
-- ventana de la §6.2 en dos semanas. Esta consulta cuesta cero y avisa si el
-- estilo vuelve.
--
-- LO QUE NO ES UN HALLAZGO, y por eso se excluye: las frases de tecnica
-- (myo-reps, rest-pause, drop sets, parciales, isometrias) y las de PASOS. Ahi la
-- carga NO se debe extraer a `cargaKg` — un drop set de `170KG x15, BAJAS A 85KG`
-- no tiene UNA carga, igual que un ondulado; y en un paseo del granjero los
-- «pasos» no son repeticiones. Esas viven vigiladas por
-- `comprobar-base-de-tecnica.sql`, que es su sitio.

with ej as (
  select u.nombre                          as asesorado,
         m.id                              as microciclo,
         m.numero,
         m.estado,
         s->>'nombre'                      as sesion,
         e->>'nombre'                      as ejercicio,
         coalesce(e->>'prescripcion','')   as pres,
         jsonb_array_length(coalesce(e->'seriesPrescritas','[]'::jsonb)) as escalera,
         jsonb_array_length(coalesce(e->'series','[]'::jsonb))           as series_registradas
    from public.microciclos m
    join public.usuarios_app u on u.id = m.usuario_id,
         jsonb_array_elements(m.datos->'sesiones') s,
         jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
   where jsonb_typeof(e) = 'object'
     and e->'cargaKg' is null
)
select asesorado,
       microciclo,
       numero,
       estado,
       sesion,
       ejercicio,
       series_registradas,
       case
         when pres ~* '^\s*\d+(?:[.,]\d+)?\s*KGS?[^;]*\yA\s+\d+\s*;'   then 'falta la palabra REPS'
         when pres ~* '^\s*\d+(?:[.,]\d+)?\s*KGS?[^;]*\sx\s*\d+'        then 'usa xN en vez de A N REPS'
         when pres ~* 'REPS\s*\('                                       then 'el rango va en parentesis tras REPS'
         else 'otra forma no canonica'
       end                                                              as por_que_no_encaja,
       left(pres, 110)                                                  as prescripcion
  from ej
 where escalera = 0
   -- Empieza por kilos: hay una carga ahi que se esta perdiendo.
   and pres ~* '^\s*\d+(?:[.,]\d+)?\s*KGS?\y[^;]*;\s*\d+\s*SERIES?'
   -- Y NO encaja en la cabecera canonica, que es la que sabe leer el dominio.
   and pres !~* '^\s*\d+(?:[.,]\d+)?\s*KGS?\y(?:\s+(?:TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?\s+A\s+\d+(?:\s*-\s*\d+)?\s*REPS?(?:\s+(?:TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?\s*;\s*\d+\s*SERIES?'
   -- Las de tecnica y las de pasos NO son un hallazgo: ver la cabecera.
   and pres !~* 'BAJAS A|->|\+ *PAUSA|PARCIALES|\+ *ISO|PASOS|MYO|REST[- ]?PAUSE'
   -- El contrato es sobre lo VIVO. Lo cerrado es historia y no se reescribe.
   and estado = 'activo'
 order by asesorado, numero, sesion, ejercicio;

-- SI SALEN FILAS: hay dos salidas y la primera suele ser la buena.
--
--   1. **Reescribir la frase a la forma canonica** antes de cargar. Es un cambio
--      de texto en la prescripcion, no en el registro, y deja el ejercicio
--      vigilado desde el primer dia.
--   2. Si la forma nueva viniera para quedarse —varias filas, varias semanas—,
--      entonces si toca ampliar `CABECERA` en `src/domain/prescripcion.ts`, con
--      sus tests, y actualizar `supabase/rellenar-carga.sql` en el mismo commit.
--      Las tres piezas comparten gramatica: si cambia una, cambian las tres.
