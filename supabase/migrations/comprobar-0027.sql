-- Comprobacion de la 0027 (altas de catalogo). Se corre APARTE, despues.
--
-- Devuelve UNA fila por cosa comprobada, con lo que tiene que dar al lado, para
-- poder leerlo sin recordar ninguna cifra. Va todo en un `union all` porque el
-- editor de Supabase solo enseña el resultado de la ultima instruccion: dos
-- selects seguidos dejarian el primero invisible, que es como la 0026 parecio
-- haber entrado sin haber entrado.

select 'alimentos en total' as comprueba,
       count(*)::text as sale,
       '1196' as tiene_que_dar
from public.alimentos

union all
select 'palmito en lata existe',
       count(*)::text, '1'
from public.alimentos where id = 'palmito-en-lata'

union all
select 'potasio del palmito en lata',
       coalesce(max(por_100g ->> 'potasio_mg'), 'FALTA'), '177'
from public.alimentos where id = 'palmito-en-lata'

union all
select 'potasio del palmito crudo (sin tocar)',
       coalesce(max(por_100g ->> 'potasio_mg'), 'FALTA'), '1806'
from public.alimentos where id = 'palmito-crudo'

union all
select 'la guayaba de la TCAC ya tiene su taza',
       count(*)::text, '1'
from public.alimento_medidas
where alimento_id = 'guayaba-madura-cruda' and nombre = 'taza'

union all
select 'medidas de las cinco filas canonicas',
       count(*)::text, '13'
from public.alimento_medidas
where alimento_id in ('guayaba-madura-cruda', 'papaya-madura-cruda',
                      'mandarina-cruda', 'pera-cruda', 'ciruela-comun-cruda')

-- Y de paso los ocho micros de la 0026, que nunca se llegaron a mirar.
union all
select 'micros de la 0026 · potasio',
       count(*) filter (where jsonb_typeof(por_100g -> 'potasio_mg') = 'number')::text,
       '1059'
from public.alimentos
union all
select 'micros de la 0026 · vitamina C',
       count(*) filter (where jsonb_typeof(por_100g -> 'vitamina_c_mg') = 'number')::text,
       '1079'
from public.alimentos
union all
select 'micros de la 0026 · vitamina A',
       count(*) filter (where jsonb_typeof(por_100g -> 'vitamina_a_er') = 'number')::text,
       '1028'
from public.alimentos
union all
select 'micros de la 0026 · folatos',
       count(*) filter (where jsonb_typeof(por_100g -> 'folatos_ug') = 'number')::text,
       '926'
from public.alimentos
union all
select 'micros de la 0026 · fosforo',
       count(*) filter (where jsonb_typeof(por_100g -> 'fosforo_mg') = 'number')::text,
       '1121'
from public.alimentos
union all
select 'micros de la 0026 · niacina',
       count(*) filter (where jsonb_typeof(por_100g -> 'niacina_mg') = 'number')::text,
       '1102'
from public.alimentos
union all
select 'micros de la 0026 · riboflavina',
       count(*) filter (where jsonb_typeof(por_100g -> 'riboflavina_mg') = 'number')::text,
       '1105'
from public.alimentos
union all
select 'micros de la 0026 · tiamina',
       count(*) filter (where jsonb_typeof(por_100g -> 'tiamina_mg') = 'number')::text,
       '1100'
from public.alimentos;
