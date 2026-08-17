-- Comprobacion de la 0033. Se corre APARTE, despues de aplicarla.
--
-- Lo que mas importa es la posta: es la unica fila del repo cuya composicion se
-- REESCRIBIO con un promedio en vez de rellenarse. Si el zinc sale 6.9, el
-- promedio no llego a la base; si sale 3.6, se aplico al reves.

select 'zinc de la posta (media de 6,90 y 3,60)' as comprueba,
       coalesce(max(por_100g ->> 'zinc_mg'), 'FALTA') as sale,
       '5.25' as tiene_que_dar
from public.alimentos where id = 'carne-de-res-magra-posta-o-bola-de-pierna-cruda'

union all
select 'kcal de la posta (media de 123 y 139)',
       coalesce(max(por_100g ->> 'kcal'), 'FALTA'), '131.0'
from public.alimentos where id = 'carne-de-res-magra-posta-o-bola-de-pierna-cruda'

union all
select 'vitamina D del bagre magro (la TCAC no la tiene)',
       coalesce(max(por_100g ->> 'vitamina_d_ug'), 'FALTA'), '12.5'
from public.alimentos where id = 'bagre-magro-sin-cabeza-crudo'

union all
select 'medida del filete de bagre',
       coalesce(max(gramos::text), 'FALTA'), '159'
from public.alimento_medidas
where alimento_id = 'bagre-magro-sin-cabeza-crudo' and nombre = 'filete'

union all
select 'los duplicados escondidos SIGUEN existiendo',
       count(*)::text, '4'
from public.alimentos where id in ('bagre-crudo', 'fresa', 'res-carne-magra-cruda', 'res-pierna-cruda')

union all
select 'alimentos en total (no se creo ni borro ninguno)',
       count(*)::text, '1198'
from public.alimentos;
