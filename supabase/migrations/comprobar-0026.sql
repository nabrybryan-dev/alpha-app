-- Comprobacion de la 0026. Se corre APARTE, despues de aplicarla.
--
-- SE CUENTA `jsonb_typeof(...) = 'number'`, NO `por_100g ? 'clave'`. El operador
-- `?` dice si la CLAVE existe, y tras la migracion TODAS existen -las que no se
-- midieron estan en null a proposito-. Contar con `?` daria 1.195 en las ocho y
-- pareceria que todo esta cubierto.
select
  -- tiene que dar 925
  count(*) filter (where jsonb_typeof(por_100g -> 'folatos_ug') = 'number') as folatos_ug,
  -- tiene que dar 1120
  count(*) filter (where jsonb_typeof(por_100g -> 'fosforo_mg') = 'number') as fosforo_mg,
  -- tiene que dar 1101
  count(*) filter (where jsonb_typeof(por_100g -> 'niacina_mg') = 'number') as niacina_mg,
  -- tiene que dar 1058
  count(*) filter (where jsonb_typeof(por_100g -> 'potasio_mg') = 'number') as potasio_mg,
  -- tiene que dar 1104
  count(*) filter (where jsonb_typeof(por_100g -> 'riboflavina_mg') = 'number') as riboflavina_mg,
  -- tiene que dar 1099
  count(*) filter (where jsonb_typeof(por_100g -> 'tiamina_mg') = 'number') as tiamina_mg,
  -- tiene que dar 1027
  count(*) filter (where jsonb_typeof(por_100g -> 'vitamina_a_er') = 'number') as vitamina_a_er,
  -- tiene que dar 1078
  count(*) filter (where jsonb_typeof(por_100g -> 'vitamina_c_mg') = 'number') as vitamina_c_mg
from public.alimentos;
