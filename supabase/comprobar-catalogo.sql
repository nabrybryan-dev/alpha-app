-- Comprobacion de la carga del catalogo de alimentos.
--
-- Compara lo que hay en Supabase contra lo que deberia haber segun
-- herramientas/base-alimentos/catalogo.json. Si una fila no cuadra, esa parte
-- del SQL de carga no entro: se vuelve a pegar y ya, que es reejecutable.
--
-- Datos de composicion nutricional tomados de la Tabla de Composicion de
-- Alimentos Colombianos (TCAC 2018), Instituto Colombiano de Bienestar
-- Familiar - ICBF.

select
    que,
    hay,
    esperado,
    case when hay = esperado then 'OK' else 'REVISAR' end as veredicto
from (
    select 'alimentos' as que, count(*) as hay, 1195 as esperado
      from public.alimentos

    union all
    select 'medidas caseras', count(*), 485
      from public.alimento_medidas

    union all
    select 'ingredientes de recetas', count(*), 545
      from public.alimento_recetas

    -- Los ocho nutrientes nuevos. Si estos dan 0, quedo el catalogo viejo.
    union all
    select 'con vitamina C (nuevo)', count(*), 683
      from public.alimentos
     where por_100g->>'vitamina_c_mg' is not null

    union all
    select 'con potasio (nuevo)', count(*), 631
      from public.alimentos
     where por_100g->>'potasio_mg' is not null

    union all
    select 'con folatos (nuevo)', count(*), 518
      from public.alimentos
     where por_100g->>'folatos_ug' is not null

    -- Antes eran 329 sin carbohidratos, por pedir una columna que la TCAC no
    -- imprime para carnes, pescados, huevos ni grasas.
    union all
    select 'SIN carbohidratos', count(*), 91
      from public.alimentos
     where por_100g->>'carbos_g' is null

    union all
    select 'prescribibles', count(*), 1062
      from public.alimentos
     where confianza = 'verificado'
) as t
order by veredicto desc, que;
