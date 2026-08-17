-- 0023 · Que las comidas puedan subir de verdad.
--
-- EL FALLO. Desde que existe el registro de comidas, ni una sola comida llegó al
-- servidor. `registro_comida`, `registro_item` y `prueba_calibracion` estaban a
-- cero mientras los check-ins y los mensajes subian con normalidad. Lo que
-- tienen en comun las tres: la app las sube con `onConflict: 'cliente_id'`.
--
-- POR QUE FALLABA. La 0017 y la 0020 crearon esos indices como PARCIALES:
--
--     create unique index ... on tabla (cliente_id) where cliente_id is not null
--
-- PostgreSQL solo puede inferir un indice parcial para un `ON CONFLICT` si la
-- sentencia repite el mismo predicado, y supabase-js manda `on_conflict=
-- cliente_id` a secas. Asi que cada subida moria con 42P10 ("no hay una
-- restriccion unica que corresponda a la especificacion ON CONFLICT"), se
-- reintentaba ocho veces y se descartaba. En silencio, a proposito: el
-- descarte existe para no perder el registro local, pero eso hizo que nadie
-- viera nunca un error. El asesorado anotaba su dia con normalidad.
--
-- EL PREDICADO NO HACIA FALTA. Se puso para permitir varias filas sin
-- `cliente_id` (las que existieran antes de la 0017). Pero un indice unico
-- normal de PostgreSQL YA admite varios NULL: los trata como distintos entre
-- si. Quitar el `where` no relaja ninguna garantia.
--
-- SEGURIDAD DE ESTE CAMBIO. Las tres tablas estan vacias, asi que no hay
-- duplicados posibles al recrear. Si en el futuro se corriera con datos y
-- fallara la creacion, seria por dos filas con el mismo `cliente_id`: eso
-- habria que resolverlo a mano antes, nunca relajando el indice.

drop index if exists public.registro_comida_cliente_id_unico;
create unique index if not exists registro_comida_cliente_id_unico
  on public.registro_comida (cliente_id);

drop index if exists public.registro_item_cliente_id_unico;
create unique index if not exists registro_item_cliente_id_unico
  on public.registro_item (cliente_id);

drop index if exists public.prueba_calibracion_cliente_id_unico;
create unique index if not exists prueba_calibracion_cliente_id_unico
  on public.prueba_calibracion (cliente_id);

comment on index public.registro_comida_cliente_id_unico is
  'No parcial a proposito: ON CONFLICT (cliente_id) no puede inferir un indice con WHERE. Ver 0023.';
comment on index public.registro_item_cliente_id_unico is
  'No parcial a proposito: ON CONFLICT (cliente_id) no puede inferir un indice con WHERE. Ver 0023.';
comment on index public.prueba_calibracion_cliente_id_unico is
  'No parcial a proposito: ON CONFLICT (cliente_id) no puede inferir un indice con WHERE. Ver 0023.';
