-- Segunda pasada del rellenador: SOLO las notas de las onduladas.
--
-- La primera pasada rellevo los 1.050 cargaKg (patrones ASCII) pero las 144
-- onduladas quedaron fuera: su patron llevaba tres caracteres no ASCII
-- (la O acentuada de ONDULACION, el signo de multiplicar y el punto medio) y el
-- portapapeles de Windows los manglo al pegar en el editor SQL. Los patrones
-- ASCII de la misma pasada corrieron perfectos — esa asimetria es el sintoma.
--
-- Aqui esos tres caracteres se construyen con chr() sobre el punto de codigo
-- Unicode, asi que este archivo es 100 % ASCII y ningun portapapeles puede
-- romperlo: chr(211) = O acentuada, chr(215) = signo de multiplicar,
-- chr(183) = punto medio.
--
-- Igual que la primera pasada: solo rellena donde `notaCoach` no existe, jamas
-- reescribe `prescripcion`, e idempotente.

update public.microciclos m
   set datos = jsonb_set(m.datos, '{sesiones}', (
     select jsonb_agg(
       case when jsonb_typeof(s.val->'ejercicios') = 'array' then
         jsonb_set(s.val, '{ejercicios}', (
           select coalesce(jsonb_agg(
             case
               when jsonb_typeof(e.val) = 'object'
                and jsonb_array_length(coalesce(e.val->'seriesPrescritas','[]'::jsonb)) > 0
                and e.val->'notaCoach' is null
                and coalesce(e.val->>'prescripcion','') ~*
                    ('^\s*ONDULACI(' || chr(211) || '|O)N\s+ASCENDENTE:\s*' ||
                     '(?:\d+(?:[.,]\d+)?\s*KG\s*(' || chr(215) || '|x)\s*\d+\s*(?:' || chr(183) || '\s*)?)+' ||
                     '(?:\(([^)]*)\))?\s*\.?')
               then e.val || jsonb_build_object(
                 'notaCoach', trim(regexp_replace(
                   e.val->>'prescripcion',
                   '^\s*ONDULACI(' || chr(211) || '|O)N\s+ASCENDENTE:\s*' ||
                   '(?:\d+(?:[.,]\d+)?\s*KG\s*(' || chr(215) || '|x)\s*\d+\s*(?:' || chr(183) || '\s*)?)+' ||
                   '(?:\(([^)]*)\))?\s*\.?\s*',
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
        and jsonb_array_length(coalesce(e2->'seriesPrescritas','[]'::jsonb)) > 0
        and e2->'notaCoach' is null
        and coalesce(e2->>'prescripcion','') ~*
            ('^\s*ONDULACI(' || chr(211) || '|O)N\s+ASCENDENTE:')
   );
