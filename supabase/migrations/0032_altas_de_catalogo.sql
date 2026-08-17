-- 0032 · Altas de catalogo posteriores a la carga inicial
--
-- 13 alimento(s) que no existian cuando se cargo el catalogo. Se emiten
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

delete from public.alimento_medidas where alimento_id = 'mango-tommy-atkins-crudo';

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('mango-tommy-atkins-crudo', 'Mango Tommy Atkins, deshidratado', 'mango deshidratado, mango tommy', 'frutas', 'seco', 'verificado', 'tcac', 'C052', '{"kcal": 194, "proteina_g": 0.4, "grasa_g": 0.1, "carbos_g": 44.8, "fibra_g": 2.1, "hierro_mg": 0.1, "calcio_mg": 8, "b12_ug": 0.0, "zinc_mg": 0.1, "magnesio_mg": 7, "sodio_mg": null, "potasio_mg": 138, "vitamina_c_mg": 70, "folatos_ug": null, "fosforo_mg": 14, "niacina_mg": null, "riboflavina_mg": 0.04, "tiamina_mg": null, "vitamina_a_er": null, "vitamina_d_ug": null, "epa_g": null, "dha_g": null}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;

delete from public.alimento_medidas
where alimento_id = 'garbanzo-cocido-sin-sal' and nombre not in ('taza');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('garbanzo-cocido-sin-sal', 'Garbanzo, cocido, sin sal', '', 'leguminosas', 'cocido', 'verificado', 'tcac', 'T018', '{"kcal": 187, "proteina_g": 8.6, "grasa_g": 2.3, "carbos_g": 12.4, "fibra_g": 13.6, "hierro_mg": 2.6, "calcio_mg": 51, "b12_ug": 0.0, "zinc_mg": 1.4, "magnesio_mg": 49, "sodio_mg": 7, "potasio_mg": 319, "vitamina_c_mg": 1, "folatos_ug": 152, "fosforo_mg": 73, "niacina_mg": 0.6, "riboflavina_mg": 0.06, "tiamina_mg": 0.12, "vitamina_a_er": 2, "vitamina_d_ug": 0.0, "epa_g": 0.0, "dha_g": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('garbanzo-cocido-sin-sal', 'taza', 164.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;

delete from public.alimento_medidas
where alimento_id = 'huevo-de-gallina-entero-cocido-sin-sal' and nombre not in ('taza (picado)', 'cucharada', 'unidad grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('huevo-de-gallina-entero-cocido-sin-sal', 'Huevo de gallina, entero, cocido, sin sal', '', 'proteinas', 'cocido', 'verificado', 'tcac', 'J003', '{"kcal": 145, "proteina_g": 13.0, "grasa_g": 10.4, "carbos_g": 0.0, "fibra_g": 0.0, "hierro_mg": 1.6, "calcio_mg": 49, "b12_ug": 1.15, "zinc_mg": 0.9, "magnesio_mg": 13, "sodio_mg": 143, "potasio_mg": 127, "vitamina_c_mg": 0, "folatos_ug": 51, "fosforo_mg": 184, "niacina_mg": 0.1, "riboflavina_mg": 0.37, "tiamina_mg": 0.07, "vitamina_a_er": 176, "vitamina_d_ug": 2.2, "epa_g": 0.005, "dha_g": 0.038}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('huevo-de-gallina-entero-cocido-sin-sal', 'taza (picado)', 136.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('huevo-de-gallina-entero-cocido-sin-sal', 'cucharada', 8.5, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('huevo-de-gallina-entero-cocido-sin-sal', 'unidad grande', 50.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;

delete from public.alimento_medidas
where alimento_id = 'huevo-de-gallina-entero-crudo' and nombre not in ('unidad grande', 'taza', 'unidad mediana', 'unidad pequena');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('huevo-de-gallina-entero-crudo', 'Huevo de gallina, entero, crudo', '', 'proteinas', 'crudo', 'verificado', 'tcac', 'J004', '{"kcal": 149, "proteina_g": 12.6, "grasa_g": 10.8, "carbos_g": 0.3, "fibra_g": 0.0, "hierro_mg": 1.7, "calcio_mg": 53, "b12_ug": 1.29, "zinc_mg": 1.4, "magnesio_mg": 12, "sodio_mg": 139, "potasio_mg": 136, "vitamina_c_mg": 0, "folatos_ug": 48, "fosforo_mg": 197, "niacina_mg": 0.1, "riboflavina_mg": 0.49, "tiamina_mg": 0.07, "vitamina_a_er": 177, "vitamina_d_ug": 2.0, "epa_g": 0.0, "dha_g": 0.058}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('huevo-de-gallina-entero-crudo', 'unidad grande', 50.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('huevo-de-gallina-entero-crudo', 'taza', 243.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('huevo-de-gallina-entero-crudo', 'unidad mediana', 44.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('huevo-de-gallina-entero-crudo', 'unidad pequena', 38.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;

delete from public.alimento_medidas
where alimento_id = 'leche-de-vaca-descremada-en-polvo' and nombre not in ('taza');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('leche-de-vaca-descremada-en-polvo', 'Leche de vaca, descremada, en polvo', '', 'lacteos', 'seco', 'verificado', 'tcac', 'G006', '{"kcal": 358, "proteina_g": 36.2, "grasa_g": 0.5, "carbos_g": 52.2, "fibra_g": 0.0, "hierro_mg": 0.4, "calcio_mg": 1257, "b12_ug": 4.03, "zinc_mg": 4.1, "magnesio_mg": 111, "sodio_mg": 536, "potasio_mg": 1757, "vitamina_c_mg": 7, "folatos_ug": 50, "fosforo_mg": 968, "niacina_mg": 1.0, "riboflavina_mg": 1.55, "tiamina_mg": 0.42, "vitamina_a_er": 7, "vitamina_d_ug": 11.0, "epa_g": 0.0, "dha_g": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('leche-de-vaca-descremada-en-polvo', 'taza', 120.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;

delete from public.alimento_medidas where alimento_id = 'leche-de-vaca-descremada-liquida-pasteurizada';

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('leche-de-vaca-descremada-liquida-pasteurizada', 'Leche de vaca, descremada, líquida, pasteurizada', '', 'lacteos', 'listo', 'verificado', 'tcac', 'G007', '{"kcal": 34, "proteina_g": 3.3, "grasa_g": 0.1, "carbos_g": 4.9, "fibra_g": 0.0, "hierro_mg": 0.0, "calcio_mg": 127, "b12_ug": 0.51, "zinc_mg": 0.4, "magnesio_mg": 11, "sodio_mg": 43, "potasio_mg": 158, "vitamina_c_mg": 0, "folatos_ug": 5, "fosforo_mg": 95, "niacina_mg": 0.1, "riboflavina_mg": 0.17, "tiamina_mg": 0.04, "vitamina_a_er": 1, "vitamina_d_ug": 1.1, "epa_g": 0.0, "dha_g": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;

delete from public.alimento_medidas
where alimento_id = 'leche-de-vaca-entera-en-polvo' and nombre not in ('taza');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('leche-de-vaca-entera-en-polvo', 'Leche de vaca, entera, en polvo', '', 'lacteos', 'seco', 'verificado', 'tcac', 'G008', '{"kcal": 499, "proteina_g": 26.3, "grasa_g": 26.6, "carbos_g": 38.4, "fibra_g": 0.0, "hierro_mg": 0.5, "calcio_mg": 940, "b12_ug": 3.25, "zinc_mg": 3.3, "magnesio_mg": 85, "sodio_mg": 369, "potasio_mg": 1318, "vitamina_c_mg": 9, "folatos_ug": 37, "fosforo_mg": 776, "niacina_mg": 0.6, "riboflavina_mg": 1.42, "tiamina_mg": 0.26, "vitamina_a_er": 288, "vitamina_d_ug": 10.5, "epa_g": 0.0, "dha_g": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('leche-de-vaca-entera-en-polvo', 'taza', 128.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;

delete from public.alimento_medidas where alimento_id = 'leche-de-vaca-entera-liquida-pasteurizada';

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('leche-de-vaca-entera-liquida-pasteurizada', 'Leche de vaca, entera, líquida, pasteurizada', '', 'lacteos', 'listo', 'verificado', 'tcac', 'G012', '{"kcal": 55, "proteina_g": 3.2, "grasa_g": 3.2, "carbos_g": 3.4, "fibra_g": 0.0, "hierro_mg": 0.0, "calcio_mg": 120, "b12_ug": 0.45, "zinc_mg": 0.4, "magnesio_mg": 10, "sodio_mg": 42, "potasio_mg": 134, "vitamina_c_mg": 0, "folatos_ug": 5, "fosforo_mg": 95, "niacina_mg": 0.1, "riboflavina_mg": 0.18, "tiamina_mg": 0.04, "vitamina_a_er": 39, "vitamina_d_ug": 1.0, "epa_g": 0.001, "dha_g": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;

delete from public.alimento_medidas
where alimento_id = 'lenteja-comun-cocida-sin-sal' and nombre not in ('taza', 'cucharada');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('lenteja-comun-cocida-sin-sal', 'Lenteja común, cocida, sin sal', '', 'leguminosas', 'cocido', 'verificado', 'tcac', 'T025', '{"kcal": 122, "proteina_g": 7.7, "grasa_g": 0.5, "carbos_g": 12.0, "fibra_g": 6.5, "hierro_mg": 1.7, "calcio_mg": 14, "b12_ug": 0.0, "zinc_mg": 1.1, "magnesio_mg": 21, "sodio_mg": 6, "potasio_mg": 204, "vitamina_c_mg": 3, "folatos_ug": 33, "fosforo_mg": 98, "niacina_mg": 1.0, "riboflavina_mg": 0.07, "tiamina_mg": 0.28, "vitamina_a_er": 5, "vitamina_d_ug": 0.0, "epa_g": 0.0, "dha_g": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('lenteja-comun-cocida-sin-sal', 'taza', 198.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('lenteja-comun-cocida-sin-sal', 'cucharada', 12.3, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;

delete from public.alimento_medidas
where alimento_id = 'pasta-alimenticia-sin-enriquecer-cocida-sin-sal' and nombre not in ('taza (spaghetti)', 'taza (elbows)', 'taza (penne)', 'taza (farfalle)', 'taza (rotini)', 'taza (shells)', 'taza (lasagne)');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('pasta-alimenticia-sin-enriquecer-cocida-sin-sal', 'Pasta alimenticia, sin enriquecer, cocida, sin sal', '', 'carbohidratos', 'cocido', 'verificado', 'tcac', 'A073', '{"kcal": 143, "proteina_g": 5.8, "grasa_g": 0.9, "carbos_g": 25.2, "fibra_g": 1.8, "hierro_mg": 0.5, "calcio_mg": 7, "b12_ug": 0.0, "zinc_mg": 0.5, "magnesio_mg": 18, "sodio_mg": 1, "potasio_mg": 44, "vitamina_c_mg": 0, "folatos_ug": 7, "fosforo_mg": 58, "niacina_mg": 0.4, "riboflavina_mg": 0.02, "tiamina_mg": 0.02, "vitamina_a_er": 0, "vitamina_d_ug": 0.0, "epa_g": 0.0, "dha_g": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('pasta-alimenticia-sin-enriquecer-cocida-sin-sal', 'taza (spaghetti)', 124.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('pasta-alimenticia-sin-enriquecer-cocida-sin-sal', 'taza (elbows)', 120.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('pasta-alimenticia-sin-enriquecer-cocida-sin-sal', 'taza (penne)', 107.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('pasta-alimenticia-sin-enriquecer-cocida-sin-sal', 'taza (farfalle)', 107.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('pasta-alimenticia-sin-enriquecer-cocida-sin-sal', 'taza (rotini)', 107.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('pasta-alimenticia-sin-enriquecer-cocida-sin-sal', 'taza (shells)', 105.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('pasta-alimenticia-sin-enriquecer-cocida-sin-sal', 'taza (lasagne)', 116.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;

delete from public.alimento_medidas
where alimento_id = 'pavo-pechuga-sin-piel-cruda' and nombre not in ('pechuga');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('pavo-pechuga-sin-piel-cruda', 'Pavo, pechuga sin piel, cruda', '', 'proteinas', 'crudo', 'verificado', 'tcac', 'F061', '{"kcal": 108, "proteina_g": 24.3, "grasa_g": 1.0, "carbos_g": 0.5, "fibra_g": 0.0, "hierro_mg": 0.9, "calcio_mg": 5, "b12_ug": 0.96, "zinc_mg": 0.8, "magnesio_mg": 20, "sodio_mg": 41, "potasio_mg": 352, "vitamina_c_mg": 0, "folatos_ug": 8, "fosforo_mg": 227, "niacina_mg": 11.2, "riboflavina_mg": 0.12, "tiamina_mg": 0.04, "vitamina_a_er": 2, "vitamina_d_ug": 0.2, "epa_g": 0.001, "dha_g": 0.002}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('pavo-pechuga-sin-piel-cruda', 'pechuga', 1150.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;

delete from public.alimento_medidas
where alimento_id = 'pepino-cohombro-crudo' and nombre not in ('taza (en rodajas)');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('pepino-cohombro-crudo', 'Pepino cohombro, crudo', '', 'vegetales', 'crudo', 'verificado', 'tcac', 'B077', '{"kcal": 14, "proteina_g": 0.5, "grasa_g": 0.1, "carbos_g": 1.6, "fibra_g": 0.7, "hierro_mg": 0.3, "calcio_mg": 18, "b12_ug": 0.0, "zinc_mg": 0.1, "magnesio_mg": 12, "sodio_mg": 2, "potasio_mg": 141, "vitamina_c_mg": 8, "folatos_ug": 14, "fosforo_mg": 22, "niacina_mg": 0.1, "riboflavina_mg": 0.02, "tiamina_mg": 0.02, "vitamina_a_er": 2, "vitamina_d_ug": 0.0, "epa_g": 0.0, "dha_g": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('pepino-cohombro-crudo', 'taza (en rodajas)', 104.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;

delete from public.alimento_medidas
where alimento_id = 'sierra-entera-cruda' and nombre not in ('filete');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('sierra-entera-cruda', 'Sierra, entera, cruda', '', 'proteinas', 'crudo', 'verificado', 'tcac', 'E041', '{"kcal": 129, "proteina_g": 21.8, "grasa_g": 4.6, "carbos_g": 0.0, "fibra_g": 0.0, "hierro_mg": 1.2, "calcio_mg": 54, "b12_ug": 0.91, "zinc_mg": 0.4, "magnesio_mg": 33.0, "sodio_mg": 54, "potasio_mg": 413, "vitamina_c_mg": 1.6, "folatos_ug": 7, "fosforo_mg": 238, "niacina_mg": 4.1, "riboflavina_mg": 0.19, "tiamina_mg": 0.14, "vitamina_a_er": 12, "vitamina_d_ug": 7.3, "epa_g": 0.329, "dha_g": 1.012}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('sierra-entera-cruda', 'filete', 187.0, 'usda')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
