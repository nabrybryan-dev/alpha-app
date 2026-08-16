-- 0031 · Altas de catalogo posteriores a la carga inicial
--
-- 4 alimento(s) que no existian cuando se cargo el catalogo. Se emiten
-- con `on conflict do update`, asi que correr esto dos veces deja lo mismo.
--
-- Generado por `generar_sql_altas.py`, no escrito a mano.
--
-- SIN `begin;` NI `commit;` Y SIN SELECT DE COMPROBACION: el editor de Supabase
-- ya envuelve el lote en su transaccion, y solo enseña el resultado de la ultima
-- instruccion -con el select dentro, la comprobacion no se ve y una carga que no
-- entra parece que si-.
--
-- ATRIBUCION: datos de composicion de USDA FoodData Central (dominio publico) y
-- de la Tabla de Composicion de Alimentos Colombianos (TCAC 2018, ICBF).

delete from public.alimento_medidas where alimento_id = 'carne-de-res-magra-posta-o-bola-de-pierna-cruda';

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('carne-de-res-magra-posta-o-bola-de-pierna-cruda', 'Carne de res magra, posta o bola de pierna (cruda)', '', 'proteinas', 'crudo', 'verificado', 'usda', '334963', '{"kcal": 123.0, "proteina_g": 23.7, "grasa_g": 2.41, "carbos_g": 0.0, "fibra_g": 0.0, "hierro_mg": 2.34, "calcio_mg": 13.0, "vitamina_d_ug": 0.0, "b12_ug": 3.33, "zinc_mg": 6.9, "magnesio_mg": 11.9, "sodio_mg": 55.0, "epa_g": 0.002, "dha_g": 0.002, "potasio_mg": 316.0, "fosforo_mg": 220.0, "riboflavina_mg": 0.25, "tiamina_mg": 0.064, "niacina_mg": 6.16, "vitamina_a_er": 0, "folatos_ug": 8, "vitamina_c_mg": 0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;

delete from public.alimento_medidas where alimento_id = 'lomo-de-cerdo-magro-crudo';

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('lomo-de-cerdo-magro-crudo', 'Lomo de cerdo entreverado, crudo', 'lomo de cerdo, lomo entreverado', 'proteinas', 'crudo', 'verificado', 'usda', '168230', '{"kcal": 143.0, "proteina_g": 21.43, "grasa_g": 5.66, "carbos_g": 0.0, "fibra_g": 0.0, "hierro_mg": 0.84, "calcio_mg": 17.0, "vitamina_d_ug": 0.5, "b12_ug": 0.63, "zinc_mg": 1.84, "magnesio_mg": 23.0, "sodio_mg": 52.0, "epa_g": 0.0, "dha_g": 0.0, "potasio_mg": 389.0, "vitamina_a_er": 2.0, "vitamina_c_mg": 0.6, "fosforo_mg": 211.0, "riboflavina_mg": 0.267, "tiamina_mg": 0.989, "niacina_mg": 4.915, "folatos_ug": 5.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;

delete from public.alimento_medidas where alimento_id = 'cerdo-lomo-crudo';

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('cerdo-lomo-crudo', 'Cerdo, lomo magro, crudo', 'lomo de cerdo magro, lomo magro', 'proteinas', 'crudo', 'verificado', 'tcac', 'F019', '{"kcal": 110, "proteina_g": 21.6, "grasa_g": 2.5, "carbos_g": 0.3, "fibra_g": 0.0, "hierro_mg": 0.9, "calcio_mg": 10, "b12_ug": 0.51, "zinc_mg": 1.9, "magnesio_mg": 27, "sodio_mg": 53, "potasio_mg": 368, "vitamina_c_mg": 0, "folatos_ug": 0, "fosforo_mg": 216, "niacina_mg": 7.1, "riboflavina_mg": 0.34, "tiamina_mg": 0.95, "vitamina_a_er": 0, "vitamina_d_ug": null, "epa_g": null, "dha_g": null}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;

delete from public.alimento_medidas
where alimento_id = 'arroz-blanco-cocido' and nombre not in ('taza');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('arroz-blanco-cocido', 'Arroz blanco enriquecido, cocido', '', 'carbohidratos', 'cocido', 'verificado', 'usda', '168878', '{"kcal": 130.0, "proteina_g": 2.69, "grasa_g": 0.28, "carbos_g": 28.17, "fibra_g": 0.4, "hierro_mg": 1.2, "calcio_mg": 10.0, "vitamina_d_ug": 0.0, "b12_ug": 0.0, "zinc_mg": 0.49, "magnesio_mg": 12.0, "sodio_mg": 1.0, "epa_g": 0.0, "dha_g": 0.0, "potasio_mg": 35.0, "vitamina_a_er": 0.0, "vitamina_c_mg": 0.0, "fosforo_mg": 43.0, "riboflavina_mg": 0.013, "tiamina_mg": 0.163, "niacina_mg": 1.476, "folatos_ug": 58.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('arroz-blanco-cocido', 'taza', 158.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
