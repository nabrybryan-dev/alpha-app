-- Comprobacion de la 0031. Se corre APARTE, despues de aplicarla.
--
-- Lo que mas importa son las tres primeras filas: la posta de res tenia que
-- quedarse con el zinc y la B12 de la TCAC (6,9 y 3,33) y NO con los de USDA
-- (3,54 y 1,62), pero conservando SU proteina (23,7, no los 21,8 de la TCAC).
-- Si el zinc sale 3,54, la preferencia por nutriente no llego a la base.

select 'zinc de la posta de res (de la TCAC)' as comprueba,
       coalesce(max(por_100g ->> 'zinc_mg'), 'FALTA') as sale,
       '6.9' as tiene_que_dar
from public.alimentos where id = 'carne-de-res-magra-posta-o-bola-de-pierna-cruda'

union all
select 'B12 de la posta de res (de la TCAC)',
       coalesce(max(por_100g ->> 'b12_ug'), 'FALTA'), '3.33'
from public.alimentos where id = 'carne-de-res-magra-posta-o-bola-de-pierna-cruda'

union all
select 'proteina de la posta (SUYA, no la de la TCAC)',
       coalesce(max(por_100g ->> 'proteina_g'), 'FALTA'), '23.7'
from public.alimentos where id = 'carne-de-res-magra-posta-o-bola-de-pierna-cruda'

union all
select 'nombre del lomo de USDA',
       coalesce(max(nombre), 'FALTA'), 'Lomo de cerdo entreverado, crudo'
from public.alimentos where id = 'lomo-de-cerdo-magro-crudo'

union all
select 'nombre del lomo de la TCAC',
       coalesce(max(nombre), 'FALTA'), 'Cerdo, lomo magro, crudo'
from public.alimentos where id = 'cerdo-lomo-crudo'

union all
select 'los dos lomos siguen existiendo',
       count(*)::text, '2'
from public.alimentos where id in ('lomo-de-cerdo-magro-crudo', 'cerdo-lomo-crudo')

union all
select 'nombre del arroz de USDA',
       coalesce(max(nombre), 'FALTA'), 'Arroz blanco enriquecido, cocido'
from public.alimentos where id = 'arroz-blanco-cocido'

union all
select 'alimentos en total (no se creo ninguno)',
       count(*)::text, '1198'
from public.alimentos;
