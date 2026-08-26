-- Rellena `cargaKg`, `unidadCarga` y `notaCoach` leyendo la frase del coach.
-- Version SQL de `scripts/rellenar-carga.mjs`, con dos diferencias a proposito.
--
-- POR QUE EXISTE EN SQL SI YA HAY UN SCRIPT. Dos razones, y la segunda es la
-- que decide:
--
--   1. El script necesita `SUPABASE_SERVICE_KEY` en el entorno. Este archivo lo
--      pega el coach en el editor SQL, como las migraciones y las siembras: la
--      clave nunca sale de donde esta.
--   2. **El script tiene una carrera que esto no tiene.** Lee los microciclos,
--      calcula en memoria y escribe `datos` ENTERO de vuelta: una serie
--      registrada entre la lectura y la escritura se pierde sin aviso. Aqui la
--      transformacion corre dentro del UPDATE, sobre la fila ya bloqueada.
--      No hay ventana.
--
-- QUE HACE. En todo microciclo (activo o cerrado), para cada ejercicio:
--
--   · cabecera canonica con kilos y `cargaKg` AUSENTE  → separa carga, unidad
--     y nota del coach en sus campos;
--   · ondulado (`seriesPrescritas`) sin `notaCoach`    → separa solo la nota
--     (la carga vive en la escalera, un solo numero no puede representarla);
--   · todo lo demas — porcentajes, «REGISTRA TU CARGA», tiempo, peso corporal,
--     frases que mencionan KG fuera de la cabecera —  → NO SE TOCA.
--
-- **`prescripcion` no se reescribe jamas.** Solo se añaden campos al lado: si
-- el relleno se equivocara, el asesorado sigue leyendo exactamente lo mismo.
--
-- **Solo rellena donde `cargaKg` no existe.** Los ~269 activos ya poblados por
-- el script no se pisan. Idempotente: correrlo dos veces no cambia nada mas.
--
-- POR QUE TAMBIEN LOS CERRADOS, que el script nunca toco. La verificacion de
-- frase-contra-registro (§6.2 del diseño de agentes) exige el desvio sostenido
-- DOS microciclos, y el «anterior» es siempre un cerrado: con los cerrados sin
-- rellenar, la regla no podia dispararse nunca. Medido el 2026-08-25: los
-- comparables de la ventana pasan de 50 a ~200 con esta pasada.
--
-- La gramatica es la de `src/domain/prescripcion.ts` (CABECERA y
-- CABECERA_ONDULADA), transcrita a POSIX: si cambia alla, cambia aqui — mismo
-- pacto que `comprobar-alineacion.sql`.
--
-- Ensayo en seco: correr primero el SELECT del final del archivo.

update public.microciclos m
   set datos = jsonb_set(m.datos, '{sesiones}', (
     select jsonb_agg(
       case when jsonb_typeof(s.val->'ejercicios') = 'array' then
         jsonb_set(s.val, '{ejercicios}', (
           select coalesce(jsonb_agg(
             case
               -- 1 · cabecera con kilos, campo ausente: carga + unidad + nota
               when jsonb_typeof(e.val) = 'object'
                and e.val->'cargaKg' is null
                and jsonb_array_length(coalesce(e.val->'seriesPrescritas','[]'::jsonb)) = 0
                and coalesce(e.val->>'prescripcion','') ~* '^\s*\d+(?:[.,]\d+)?\s*KGS?\y(?:\s+(?:TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?\s+A\s+\d+(?:\s*-\s*\d+)?\s*REPS?(?:\s+(?:TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?\s*;\s*\d+\s*SERIES?'
               then e.val || (
                 select jsonb_build_object(
                   'cargaKg', to_jsonb(replace(g.m[1], ',', '.')::numeric),
                   'unidadCarga', case
                     when upper(coalesce(g.m[2], g.m[4], '')) like 'TOTAL%' then 'total'
                     when upper(regexp_replace(coalesce(g.m[2], g.m[4], ''), '\s+', ' ', 'g')) = 'POR MANO' then 'por mano'
                     when upper(regexp_replace(coalesce(g.m[2], g.m[4], ''), '\s+', ' ', 'g'))
                          in ('POR PIERNA', 'POR LADO', 'CADA LADO') then 'por lado'
                     else 'kg'
                   end,
                   'notaCoach', trim(regexp_replace(
                     e.val->>'prescripcion',
                     '^\s*\d+(?:[.,]\d+)?\s*KGS?\y(?:\s+(?:TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?\s+A\s+\d+(?:\s*-\s*\d+)?\s*REPS?(?:\s+(?:TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?\s*;\s*\d+\s*SERIES?(?:\s*\(([^)]*)\))?\s*\.?\s*',
                     '', 'i'))
                 )
                 from (
                   select regexp_match(
                     e.val->>'prescripcion',
                     '^\s*(\d+(?:[.,]\d+)?)\s*KGS?\y(?:\s+(TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?\s+A\s+(\d+(?:\s*-\s*\d+)?)\s*REPS?(?:\s+(TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?\s*;\s*(\d+)\s*SERIES?(?:\s*\(([^)]*)\))?\s*\.?\s*',
                     'i') as m
                 ) g
               )
               -- 2 · ondulada sin nota separada: solo la nota
               when jsonb_typeof(e.val) = 'object'
                and jsonb_array_length(coalesce(e.val->'seriesPrescritas','[]'::jsonb)) > 0
                and e.val->'notaCoach' is null
                and coalesce(e.val->>'prescripcion','') ~* '^\s*ONDULACI[ÓO]N\s+ASCENDENTE:\s*(?:\d+(?:[.,]\d+)?\s*KG\s*[×x]\s*\d+\s*(?:·\s*)?)+(?:\(([^)]*)\))?\s*\.?'
               then e.val || jsonb_build_object(
                 'notaCoach', trim(regexp_replace(
                   e.val->>'prescripcion',
                   '^\s*ONDULACI[ÓO]N\s+ASCENDENTE:\s*(?:\d+(?:[.,]\d+)?\s*KG\s*[×x]\s*\d+\s*(?:·\s*)?)+(?:\(([^)]*)\))?\s*\.?\s*',
                   '', 'i'))
               )
               else e.val
             end order by e.ord), '[]'::jsonb)
           from jsonb_array_elements(s.val->'ejercicios') with ordinality e(val, ord)
         ))
       else s.val end
       order by s.ord)
     from jsonb_array_elements(m.datos->'sesiones') with ordinality s(val, ord)
   ))
 where jsonb_typeof(m.datos->'sesiones') = 'array'
   and exists (
     select 1
       from jsonb_array_elements(m.datos->'sesiones') s2,
            jsonb_array_elements(coalesce(s2->'ejercicios','[]'::jsonb)) e2
      where jsonb_typeof(e2) = 'object'
        and (
          (e2->'cargaKg' is null
            and jsonb_array_length(coalesce(e2->'seriesPrescritas','[]'::jsonb)) = 0
            and coalesce(e2->>'prescripcion','') ~* '^\s*\d+(?:[.,]\d+)?\s*KGS?\y(?:\s+(?:TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?\s+A\s+\d+(?:\s*-\s*\d+)?\s*REPS?(?:\s+(?:TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?\s*;\s*\d+\s*SERIES?')
          or
          (jsonb_array_length(coalesce(e2->'seriesPrescritas','[]'::jsonb)) > 0
            and e2->'notaCoach' is null
            and coalesce(e2->>'prescripcion','') ~* '^\s*ONDULACI[ÓO]N\s+ASCENDENTE:\s*(?:\d+(?:[.,]\d+)?\s*KG\s*[×x]\s*\d+\s*(?:·\s*)?)+')
        )
   );

-- ── ENSAYO EN SECO ──────────────────────────────────────────────────────────
-- Correr ANTES del update. Dice cuantos ejercicios tocaria y en que estado.
--
-- with ej as (
--   select m.estado,
--          coalesce(e->>'prescripcion','') as pres,
--          e->'cargaKg' as carga,
--          e->'notaCoach' as nota,
--          jsonb_array_length(coalesce(e->'seriesPrescritas','[]'::jsonb)) as escalera
--     from public.microciclos m,
--          jsonb_array_elements(m.datos->'sesiones') s,
--          jsonb_array_elements(coalesce(s->'ejercicios','[]'::jsonb)) e
--    where jsonb_typeof(e) = 'object'
-- )
-- select estado,
--        count(*) filter (where carga is null and escalera = 0
--          and pres ~* '^\s*\d+(?:[.,]\d+)?\s*KGS?\y(?:\s+(?:TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?\s+A\s+\d+(?:\s*-\s*\d+)?\s*REPS?(?:\s+(?:TOTAL(?:ES)?|POR\s+PIERNA|POR\s+LADO|POR\s+MANO|CADA\s+LADO))?\s*;\s*\d+\s*SERIES?') as rellenaria,
--        count(*) filter (where escalera > 0 and nota is null
--          and pres ~* '^\s*ONDULACI[ÓO]N\s+ASCENDENTE:') as onduladas
--   from ej group by estado;
