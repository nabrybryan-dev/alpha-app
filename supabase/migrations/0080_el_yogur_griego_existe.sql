-- 0080 · El yogur griego existe tambien en la base
--
-- Los dos yogures griegos entraron en el catalogo de la app el 16-ago (#62, «las seis
-- recetas reales, con el yogur griego que faltaba en el catalogo»), pero ninguna
-- migracion de altas los subio a `public.alimentos`. La app los ofrece, la persona los
-- anota, y `registro_item.alimento_id` los rechaza por su clave ajena (23503): el
-- registro de comida no se guarda. Medido el 14-sep en los registros de la API: 27
-- rechazos en 24 h, de dos asesorados. Comparando los 1.200 ids de
-- `src/data/catalogo/alimentos.json` con los 1.198 de la base, estos dos son los unicos
-- que faltan.
--
-- Mismos valores que el catalogo de la app, que es lo que la persona ve al anotar.
-- Idempotente como las altas anteriores: `on conflict do update`.
--
-- SIN `begin;` NI `commit;`: el editor de Supabase ya envuelve el lote.
--
-- ATRIBUCION: datos de composicion de USDA FoodData Central (dominio publico).

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('yogur-griego-entero', 'Yogur griego natural entero', 'yogur griego', 'lacteos', 'listo', 'verificado', 'usda', null, '{"kcal": 94.507135, "proteina_g": 8.77888, "carbos_g": 4.75402, "grasa_g": 4.394, "hierro_mg": 0, "vitamina_c_mg": null, "potasio_mg": 146.9, "vitamina_a_er": null}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('yogur-griego-descremado', 'Yogur griego natural descremado', 'yogur griego light', 'lacteos', 'listo', 'verificado', 'usda', null, '{"kcal": 61, "proteina_g": 10.3, "carbos_g": 3.64, "grasa_g": 0.37, "hierro_mg": 0.07, "vitamina_c_mg": null, "potasio_mg": 141, "vitamina_a_er": 1}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
