-- Comprobacion de la 0030 (lo que la fila que manda heredo de su gemelo).
-- Se corre APARTE, despues de aplicarla.
--
-- OJO AL LEER `vitamina_d = 0`: es un CERO MEDIDO, no un hueco. Antes de la 0030
-- esas cuatro filas no tenian el dato en absoluto, y "no se midio" y "se midio y
-- no contiene" son cosas distintas para el motor. Lo que se recupero son cuatro
-- ceros ciertos, no cuatro cifras grandes.

select 'las 4 filas con vitamina D medida' as comprueba,
       count(*) filter (where jsonb_typeof(por_100g -> 'vitamina_d_ug') = 'number')::text
         as sale,
       '4' as tiene_que_dar
from public.alimentos
where id in ('guayaba-madura-cruda', 'papaya-madura-cruda',
             'mandarina-cruda', 'ciruela-comun-cruda')

union all
select 'las 4 con EPA medido',
       count(*) filter (where jsonb_typeof(por_100g -> 'epa_g') = 'number')::text, '4'
from public.alimentos
where id in ('guayaba-madura-cruda', 'papaya-madura-cruda',
             'mandarina-cruda', 'ciruela-comun-cruda')

union all
select 'las 4 con DHA medido',
       count(*) filter (where jsonb_typeof(por_100g -> 'dha_g') = 'number')::text, '4'
from public.alimentos
where id in ('guayaba-madura-cruda', 'papaya-madura-cruda',
             'mandarina-cruda', 'ciruela-comun-cruda')

-- Lo que NO tenia que pasar: que heredar pisara un dato propio. La vitamina C de
-- la guayaba es de la TCAC y la de su gemelo de USDA es distinta (217 contra
-- 228). Si sale 228, se sobrescribio en vez de completar.
union all
select 'vitamina C de la guayaba (suya, NO la de USDA)',
       coalesce(max(por_100g ->> 'vitamina_c_mg'), 'FALTA'), '217'
from public.alimentos where id = 'guayaba-madura-cruda'

union all
select 'medidas caseras de las 4',
       count(*)::text, '10'
from public.alimento_medidas
where alimento_id in ('guayaba-madura-cruda', 'papaya-madura-cruda',
                      'mandarina-cruda', 'ciruela-comun-cruda')

union all
select 'alimentos en total (no se creo ninguno)',
       count(*)::text, '1198'
from public.alimentos;
