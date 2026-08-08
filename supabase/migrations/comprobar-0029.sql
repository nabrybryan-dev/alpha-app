-- Comprobacion de la 0029 (bebidas y los dos jugos en agua). Se corre APARTE.
--
-- Una fila por cosa comprobada, con lo que tiene que dar al lado: se lee sin
-- recordar ninguna cifra. Todo en un `union all` porque el editor de Supabase
-- solo enseña el resultado de la ultima instruccion.

select 'alimentos en total' as comprueba,
       count(*)::text as sale, '1198' as tiene_que_dar
from public.alimentos

union all
select 'jugo de guayaba en agua existe',
       count(*)::text, '1'
from public.alimentos where id = 'jugo-de-guayaba-en-agua'

union all
select 'su vitamina C por 100 g',
       coalesce(max(round((por_100g ->> 'vitamina_c_mg')::numeric, 2))::text, 'FALTA'),
       '107.44'
from public.alimentos where id = 'jugo-de-guayaba-en-agua'

union all
select 'jugo de guanabana en agua existe',
       count(*)::text, '1'
from public.alimentos where id = 'jugo-de-guanabana-en-agua'

union all
select 'sus tres vasos',
       count(*)::text, '3'
from public.alimento_medidas where alimento_id = 'jugo-de-guayaba-en-agua'

-- Lo que el `delete` de la migracion tenia que limpiar.
union all
select 'bebidas curadas que AUN dicen plato (debe ser 0)',
       count(*)::text, '0'
from public.alimento_medidas m
where m.nombre = 'plato'
  and m.alimento_id in (
    'agua-de-panela','agua-de-panela-con-limon','agua-de-panela-con-queso',
    'avena-en-caja','avena-en-leche','avena-preparada-con-leche',
    'batido-de-banano-en-leche','batido-de-proteina-con-leche',
    'batido-ganador-de-peso-casero','jugo-de-guanabana-en-agua',
    'jugo-de-guanabana-en-leche','jugo-de-guayaba-en-agua',
    'jugo-de-guayaba-en-leche','jugo-de-lulo-en-agua','jugo-de-mango-en-agua',
    'jugo-de-maracuya-en-agua','jugo-de-mora-en-agua','jugo-de-mora-en-leche',
    'jugo-de-papaya-en-agua','limonada','limonada-de-coco',
    'sustituto-de-comida-preparado-con-leche','te-frio-en-botella',
    'cafe-con-leche','chocolate-caliente-en-leche','chocolate-con-leche',
    'chocolate-con-queso','chocolate-en-agua','tinto-con-azucar',
    'aguardiente-un-trago')

union all
select 'medidas de vaso, pocillo o trago',
       count(*)::text, '88'
from public.alimento_medidas
where nombre like 'vaso%' or nombre like 'pocillo%' or nombre = 'trago'

-- La comida que SI se sirve en plato no se toco: esto no fue un cambio global.
union all
select 'alimentos que siguen diciendo plato',
       count(distinct alimento_id)::text, '108'
from public.alimento_medidas where nombre = 'plato'

union all
select 'medidas con fuente fuera del check (debe ser 0)',
       count(*)::text, '0'
from public.alimento_medidas
where fuente not in ('usda', 'tcac', 'estimada', 'receta', 'asesorado');
