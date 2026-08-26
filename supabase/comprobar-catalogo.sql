-- Comprobacion de la carga del catalogo de alimentos.
--
-- Compara lo que hay en Supabase contra lo que deberia haber segun
-- herramientas/base-alimentos/catalogo.json. Si una fila no cuadra, esa parte
-- del SQL de carga no entro: se vuelve a pegar y ya, que es reejecutable.
--
-- LAS CONSTANTES SALEN DEL CATALOGO, NO DE LA BASE (2026-08-25). El 25/08 las
-- ocho decian REVISAR porque el catalogo crecio a 1.200 en otra sesion y los
-- numeros de aqui quedaron viejos — el check desactualizado señalando datos
-- sanos, que es I-3 aplicado a un SQL. Al recalcular desde catalogo.json
-- aparecio ademas una discrepancia REAL que los numeros viejos tapaban: dos
-- alimentos del catalogo sin cargar en la base (los yogures griegos). Regla:
-- cuando el catalogo cambie, estas constantes se recalculan desde el JSON en
-- el mismo commit.
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
    select 'alimentos' as que, count(*) as hay, 1200 as esperado
      from public.alimentos

    union all
    select 'medidas caseras', count(*), 581
      from public.alimento_medidas

    union all
    select 'ingredientes de recetas', count(*), 551
      from public.alimento_recetas

    -- Los ocho nutrientes nuevos. Si estos dan 0, quedo el catalogo viejo.
    union all
    select 'con vitamina C (nuevo)', count(*), 1083
      from public.alimentos
     where por_100g->>'vitamina_c_mg' is not null

    union all
    select 'con potasio (nuevo)', count(*), 1063
      from public.alimentos
     where por_100g->>'potasio_mg' is not null

    union all
    select 'con folatos (nuevo)', count(*), 926
      from public.alimentos
     where por_100g->>'folatos_ug' is not null

    -- Antes eran 329 sin carbohidratos, por pedir una columna que la TCAC no
    -- imprime para carnes, pescados, huevos ni grasas.
    union all
    select 'SIN carbohidratos', count(*), 91
      from public.alimentos
     where por_100g->>'carbos_g' is null

    union all
    select 'prescribibles', count(*), 1065
      from public.alimentos
     where confianza = 'verificado'
) as t
order by veredicto desc, que;
