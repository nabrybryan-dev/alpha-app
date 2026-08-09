-- 0030 · Altas de catalogo posteriores a la carga inicial
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

delete from public.alimento_medidas
where alimento_id = 'guayaba-madura-cruda' and nombre not in ('taza');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('guayaba-madura-cruda', 'Guayaba, madura, cruda', '', 'frutas', 'crudo', 'verificado', 'tcac', 'C031', '{"kcal": 71, "proteina_g": 0.9, "grasa_g": 0.3, "carbos_g": 8.0, "fibra_g": 5.4, "hierro_mg": 0.3, "calcio_mg": 13, "b12_ug": 0.0, "zinc_mg": 0.3, "magnesio_mg": 12, "sodio_mg": 3, "potasio_mg": 337, "vitamina_c_mg": 217, "folatos_ug": 49, "fosforo_mg": 33, "niacina_mg": 1.5, "riboflavina_mg": 0.04, "tiamina_mg": 0.04, "vitamina_a_er": 31, "vitamina_d_ug": 0.0, "epa_g": 0.0, "dha_g": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('guayaba-madura-cruda', 'taza', 165.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;

delete from public.alimento_medidas
where alimento_id = 'papaya-madura-cruda' and nombre not in ('taza (1" pieces)', 'taza (pure)');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('papaya-madura-cruda', 'Papaya, madura, cruda', '', 'frutas', 'crudo', 'verificado', 'tcac', 'C065', '{"kcal": 40, "proteina_g": 0.5, "grasa_g": 0.1, "carbos_g": 6.2, "fibra_g": 2.0, "hierro_mg": 0.3, "calcio_mg": 24, "b12_ug": 0.0, "zinc_mg": 0.1, "magnesio_mg": 23, "sodio_mg": 5, "potasio_mg": 216, "vitamina_c_mg": 62, "folatos_ug": 37, "fosforo_mg": 9, "niacina_mg": 0.3, "riboflavina_mg": 0.03, "tiamina_mg": 0.03, "vitamina_a_er": 235, "vitamina_d_ug": 0.0, "epa_g": 0.0, "dha_g": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('papaya-madura-cruda', 'taza (1" pieces)', 145.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('papaya-madura-cruda', 'taza (pure)', 230.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;

delete from public.alimento_medidas
where alimento_id = 'mandarina-cruda' and nombre not in ('taza (sections)', 'unidad pequena', 'unidad mediana', 'unidad grande', 'porcion del paquete');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('mandarina-cruda', 'Mandarina, cruda', '', 'frutas', 'crudo', 'verificado', 'tcac', 'C050', '{"kcal": 54, "proteina_g": 0.9, "grasa_g": 0.1, "carbos_g": 9.6, "fibra_g": 1.8, "hierro_mg": 0.3, "calcio_mg": 35, "b12_ug": 0.0, "zinc_mg": 0.2, "magnesio_mg": 12, "sodio_mg": 2, "potasio_mg": 151, "vitamina_c_mg": 24, "folatos_ug": 18, "fosforo_mg": 21, "niacina_mg": 0.2, "riboflavina_mg": 0.03, "tiamina_mg": 0.06, "vitamina_a_er": 35, "vitamina_d_ug": 0.0, "epa_g": 0.0, "dha_g": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('mandarina-cruda', 'taza (sections)', 195.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('mandarina-cruda', 'unidad pequena', 76.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('mandarina-cruda', 'unidad mediana', 88.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('mandarina-cruda', 'unidad grande', 120.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('mandarina-cruda', 'porcion del paquete', 109.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;

delete from public.alimento_medidas
where alimento_id = 'ciruela-comun-cruda' and nombre not in ('taza (en rodajas)', 'porcion del paquete');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('ciruela-comun-cruda', 'Ciruela, común, cruda', '', 'frutas', 'crudo', 'verificado', 'tcac', 'C017', '{"kcal": 53, "proteina_g": 0.6, "grasa_g": 0.1, "carbos_g": 8.7, "fibra_g": 2.4, "hierro_mg": 0.4, "calcio_mg": 17, "b12_ug": 0.0, "zinc_mg": 0.1, "magnesio_mg": 5, "sodio_mg": 2, "potasio_mg": 134, "vitamina_c_mg": 8, "folatos_ug": 3, "fosforo_mg": 24, "niacina_mg": 0.4, "riboflavina_mg": 0.02, "tiamina_mg": 0.06, "vitamina_a_er": 2, "vitamina_d_ug": 0.0, "epa_g": 0.0, "dha_g": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('ciruela-comun-cruda', 'taza (en rodajas)', 165.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('ciruela-comun-cruda', 'porcion del paquete', 151.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
