-- 0029 · Altas de catalogo posteriores a la carga inicial
--
-- 30 alimento(s) que no existian cuando se cargo el catalogo. Se emiten
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
where alimento_id = 'agua-de-panela' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('agua-de-panela', 'Agua de panela', 'agua de panela, aguapanela, agua de panela con limon', 'carbohidratos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 0.01, "fibra_g": 0.0, "epa_g": 0.0, "kcal": 42.22, "hierro_mg": 0.08, "carbos_g": 10.9, "calcio_mg": 11.89, "zinc_mg": 0.01, "sodio_mg": 6.67, "b12_ug": 0.0, "grasa_g": 0.0, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 1.89, "potasio_mg": 14.777777777777779, "vitamina_a_er": 0.0, "riboflavina_mg": 0.0, "fosforo_mg": 0.4444444444444444, "niacina_mg": 0.012222222222222221, "tiamina_mg": 0.0, "folatos_ug": 0.1111111111111111, "vitamina_c_mg": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('agua-de-panela', 'vaso pequeno', 170.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('agua-de-panela', 'vaso mediano', 220.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('agua-de-panela', 'vaso grande', 280.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('agua-de-panela', 'azucar-morena', 'Panela (proxy: azucar morena)', 25.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('agua-de-panela', null, 'Agua de la bebida', 200.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'agua-de-panela-con-limon' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('agua-de-panela-con-limon', 'Agua de panela con limon', 'aguapanela con limon, agua de panela con limon, panela con limon', 'carbohidratos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 0.03, "fibra_g": 0.02, "epa_g": 0.0, "kcal": 28.86, "hierro_mg": 0.06, "carbos_g": 7.57, "calcio_mg": 15.5, "zinc_mg": 0.01, "sodio_mg": 3.87, "b12_ug": 0.0, "grasa_g": 0.0, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 2.86, "potasio_mg": 16.596, "vitamina_a_er": 0.12, "riboflavina_mg": 0.0008999999999999999, "fosforo_mg": 1.1280000000000001, "niacina_mg": 0.01644, "tiamina_mg": 0.0014999999999999998, "folatos_ug": 0.6719999999999999, "vitamina_c_mg": 1.7999999999999998}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('agua-de-panela-con-limon', 'vaso pequeno', 190.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('agua-de-panela-con-limon', 'vaso mediano', 250.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('agua-de-panela-con-limon', 'vaso grande', 310.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('agua-de-panela-con-limon', 'azucar-morena', 'Panela (modelada como azucar morena)', 18.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('agua-de-panela-con-limon', null, 'Jugo de limon', 15.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('agua-de-panela-con-limon', 'agua', 'Agua', 217.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'agua-de-panela-con-queso' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('agua-de-panela-con-queso', 'Agua de panela con queso', 'agua de panela con queso, aguapanela con queso, panela con queso', 'otro', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 2.86, "fibra_g": 0.0, "epa_g": 0.0, "kcal": 80.74, "hierro_mg": 0.07, "carbos_g": 9.7, "calcio_mg": 100.93, "zinc_mg": 0.45, "sodio_mg": 100.23, "b12_ug": 0.0, "grasa_g": 3.53, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 5.78, "potasio_mg": 31.62641509433962, "vitamina_a_er": 0.0, "riboflavina_mg": 0.0, "fosforo_mg": 59.21509433962263, "niacina_mg": 0.010377358490566037, "tiamina_mg": 0.0, "folatos_ug": 0.09433962264150944, "vitamina_c_mg": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('agua-de-panela-con-queso', 'vaso pequeno', 200.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('agua-de-panela-con-queso', 'vaso mediano', 260.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('agua-de-panela-con-queso', 'vaso grande', 330.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('agua-de-panela-con-queso', 'azucar-morena', 'Panela (proxy: azucar morena)', 25.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('agua-de-panela-con-queso', 'queso-campesino-tajada-de-queso', 'Queso campesino', 40.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('agua-de-panela-con-queso', null, 'Agua de la bebida', 200.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'avena-en-caja' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('avena-en-caja', 'Avena en caja', 'avena, avena alpina, avena en caja, bebida de avena', 'lacteos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 3.65, "fibra_g": 0.59, "epa_g": 0.0, "kcal": 92.07, "hierro_mg": 0.27, "carbos_g": 14.93, "calcio_mg": 107.95, "zinc_mg": 0.63, "sodio_mg": 41.49, "b12_ug": 0.46, "grasa_g": 2.11, "dha_g": 0.0, "vitamina_d_ug": 1.05, "magnesio_mg": 17.65, "potasio_mg": 143.5533980582524, "vitamina_a_er": 48.05825242718447, "riboflavina_mg": 0.17197087378640774, "fosforo_mg": 104.27184466019419, "niacina_mg": 0.14592233009708735, "tiamina_mg": 0.06087378640776699, "folatos_ug": 6.233009708737864, "vitamina_c_mg": 0.17475728155339806}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('avena-en-caja', 'vaso pequeno', 150.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('avena-en-caja', 'vaso mediano', 210.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('avena-en-caja', 'vaso grande', 260.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('avena-en-caja', null, 'Leche semidescremada 2%', 180.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('avena-en-caja', 'avena-en-hojuelas-peso-en-seco', 'Avena en hojuelas (peso en seco)', 12.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('avena-en-caja', null, 'Azucar blanca', 14.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'avena-en-leche' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('avena-en-leche', 'Avena en leche', 'avena, avena en leche, avena caliente, colada de avena', 'carbohidratos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 4.41, "fibra_g": 1.27, "epa_g": 0.0, "kcal": 111.2, "hierro_mg": 0.54, "carbos_g": 15.82, "calcio_mg": 109.95, "zinc_mg": 0.8, "sodio_mg": 32.72, "b12_ug": 0.45, "grasa_g": 3.51, "dha_g": 0.0, "vitamina_d_ug": 0.84, "magnesio_mg": 27.39, "potasio_mg": 171.7478991596639, "vitamina_a_er": 26.89075630252101, "riboflavina_mg": 0.13614285714285715, "fosforo_mg": 136.5546218487395, "niacina_mg": 0.23004201680672268, "tiamina_mg": 0.10504201680672269, "folatos_ug": 4.033613445378151, "vitamina_c_mg": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('avena-en-leche', 'vaso pequeno', 180.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('avena-en-leche', 'vaso mediano', 240.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('avena-en-leche', 'vaso grande', 300.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('avena-en-leche', 'avena-en-hojuelas-peso-en-seco', 'Hojuelas de avena en seco', 30.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('avena-en-leche', 'leche-entera', 'Leche entera', 200.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('avena-en-leche', null, 'Azucar', 8.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'avena-preparada-con-leche' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('avena-preparada-con-leche', 'Avena preparada con leche', 'avena con leche; avena cocida; porridge de avena', 'carbohidratos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 4.59, "fibra_g": 1.6, "epa_g": 0.0, "kcal": 113.4, "hierro_mg": 3.96, "carbos_g": 19.05, "calcio_mg": 157.0, "zinc_mg": 0.75, "sodio_mg": 66.44, "b12_ug": 0.44, "grasa_g": 2.62, "dha_g": 0.0, "vitamina_d_ug": 0.88, "magnesio_mg": 30.08, "potasio_mg": 185.83999999999997, "vitamina_a_er": 189.92, "riboflavina_mg": 0.11836000000000002, "fosforo_mg": 150.07999999999998, "niacina_mg": 0.2552, "tiamina_mg": 0.11840000000000002, "folatos_ug": 6.720000000000001, "vitamina_c_mg": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('avena-preparada-con-leche', 'vaso pequeno', 190.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('avena-preparada-con-leche', 'vaso mediano', 250.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('avena-preparada-con-leche', 'vaso grande', 310.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('avena-preparada-con-leche', 'avena-instantanea-peso-en-seco', 'avena instantánea, pesada en seco (la leche es el líquido de cocción)', 40.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('avena-preparada-con-leche', 'leche-semidescremada-2', 'leche semidescremada 2%', 200.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('avena-preparada-con-leche', null, 'azúcar granulada (2 cucharaditas)', 10.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'batido-de-banano-en-leche' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('batido-de-banano-en-leche', 'Batido de banano en leche', 'batido de banano, malteada de banano, jugo de banano en leche', 'lacteos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 2.4, "fibra_g": 0.84, "epa_g": 0.0, "kcal": 78.56, "hierro_mg": 0.11, "carbos_g": 13.13, "calcio_mg": 75.03, "zinc_mg": 0.29, "sodio_mg": 28.27, "b12_ug": 0.29, "grasa_g": 2.22, "dha_g": 0.0, "vitamina_d_ug": 0.84, "magnesio_mg": 15.26, "potasio_mg": 202.0, "vitamina_a_er": 30.844155844155846, "riboflavina_mg": 0.13393506493506493, "fosforo_mg": 61.68831168831169, "niacina_mg": 0.2737012987012987, "tiamina_mg": 0.039935064935064934, "folatos_ug": 9.740259740259742, "vitamina_c_mg": 2.8246753246753245}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('batido-de-banano-en-leche', 'vaso pequeno', 230.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('batido-de-banano-en-leche', 'vaso mediano', 310.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('batido-de-banano-en-leche', 'vaso grande', 380.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('batido-de-banano-en-leche', 'banano', 'Banano', 100.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('batido-de-banano-en-leche', null, 'Leche entera', 200.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('batido-de-banano-en-leche', null, 'Azucar blanca', 8.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'batido-de-proteina-con-leche' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('batido-de-proteina-con-leche', 'Batido de proteína con leche', 'batido de whey; shake de proteína; batido post entreno', 'proteinas', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 11.66, "fibra_g": 0.34, "epa_g": 0.0, "kcal": 83.56, "hierro_mg": 0.13, "carbos_g": 5.06, "calcio_mg": 164.11, "zinc_mg": 1.07, "sodio_mg": 52.0, "b12_ug": 0.76, "grasa_g": 1.86, "dha_g": 0.0, "vitamina_d_ug": 0.98, "magnesio_mg": 32.33, "potasio_mg": 196.88888888888889, "vitamina_a_er": 73.77777777777777, "riboflavina_mg": 0.34588888888888886, "fosforo_mg": 238.33333333333334, "niacina_mg": 0.22577777777777774, "tiamina_mg": 0.12011111111111111, "folatos_ug": 5.444444444444444, "vitamina_c_mg": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('batido-de-proteina-con-leche', 'vaso pequeno', 200.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('batido-de-proteina-con-leche', 'vaso mediano', 270.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('batido-de-proteina-con-leche', 'vaso grande', 340.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('batido-de-proteina-con-leche', 'proteina-en-polvo-whey', 'proteína whey en polvo (1 scoop)', 30.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('batido-de-proteina-con-leche', 'leche-semidescremada-2', 'leche semidescremada 2% (1 vaso)', 240.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'batido-ganador-de-peso-casero' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('batido-ganador-de-peso-casero', 'Batido ganador de peso casero', 'batido hipercalórico casero; shake para subir de peso; batido ganador', 'carbohidratos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 9.75, "fibra_g": 2.35, "epa_g": 0.0, "kcal": 142.32, "hierro_mg": 3.44, "carbos_g": 18.1, "calcio_mg": 148.1, "zinc_mg": 1.13, "sodio_mg": 69.88, "b12_ug": 0.46, "grasa_g": 4.26, "dha_g": 0.0, "vitamina_d_ug": 0.6, "magnesio_mg": 50.18, "potasio_mg": 273.02173913043475, "vitamina_a_er": 146.45652173913044, "riboflavina_mg": 0.22839130434782606, "fosforo_mg": 219.1826086956522, "niacina_mg": 1.1623478260869564, "tiamina_mg": 0.1418086956521739, "folatos_ug": 15.990869565217391, "vitamina_c_mg": 1.891304347826087}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('batido-ganador-de-peso-casero', 'vaso pequeno', 340.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('batido-ganador-de-peso-casero', 'vaso mediano', 460.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('batido-ganador-de-peso-casero', 'vaso grande', 580.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('batido-ganador-de-peso-casero', 'leche-semidescremada-2', 'leche semidescremada 2%', 250.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('batido-ganador-de-peso-casero', 'avena-instantanea-peso-en-seco', 'avena instantánea, pesada en seco y licuada', 60.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('batido-ganador-de-peso-casero', 'proteina-en-polvo-whey', 'proteína whey en polvo (1 scoop)', 30.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('batido-ganador-de-peso-casero', 'banano', 'banano crudo, pelado', 100.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('batido-ganador-de-peso-casero', 'mantequilla-de-mani', 'mantequilla de maní', 20.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'jugo-de-guanabana-en-agua' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('jugo-de-guanabana-en-agua', 'Jugo de guanabana en agua', 'jugo de guanabana, guanabana en agua', 'frutas', 'preparado', 'estimado', 'receta', null, '{"carbos_g": 13.81, "dha_g": 0.0, "proteina_g": 0.47, "tiamina_mg": 0.03, "grasa_g": 0.14, "magnesio_mg": 10.82, "hierro_mg": 0.29, "niacina_mg": 0.42, "vitamina_d_ug": 0.0, "folatos_ug": 6.59, "calcio_mg": 11.35, "riboflavina_mg": 0.02, "epa_g": 0.0, "fosforo_mg": 12.71, "b12_ug": 0.0, "potasio_mg": 130.94, "kcal": 53.82, "zinc_mg": 0.05, "sodio_mg": 7.59, "fibra_g": 1.55, "vitamina_c_mg": 9.69, "vitamina_a_er": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-guanabana-en-agua', 'vaso pequeno', 190.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-guanabana-en-agua', 'vaso mediano', 260.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-guanabana-en-agua', 'vaso grande', 320.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-guanabana-en-agua', 'guanabana', 'Guanabana', 120.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-guanabana-en-agua', null, 'Azucar blanca', 15.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-guanabana-en-agua', 'agua', 'Agua', 120.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'jugo-de-guanabana-en-leche' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('jugo-de-guanabana-en-leche', 'Jugo de guanabana en leche', 'jugo de guanabana en leche, guanabana en leche', 'lacteos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 2.35, "fibra_g": 1.06, "epa_g": 0.0, "kcal": 74.25, "hierro_mg": 0.21, "carbos_g": 12.07, "calcio_mg": 77.18, "zinc_mg": 0.27, "sodio_mg": 32.18, "b12_ug": 0.29, "grasa_g": 2.19, "dha_g": 0.0, "vitamina_d_ug": 0.84, "magnesio_mg": 13.18, "potasio_mg": 174.28571428571428, "vitamina_a_er": 29.57142857142857, "riboflavina_mg": 0.12539285714285714, "fosforo_mg": 62.67857142857143, "niacina_mg": 0.34650000000000003, "tiamina_mg": 0.05207142857142857, "folatos_ug": 7.714285714285715, "vitamina_c_mg": 6.621428571428573}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-guanabana-en-leche', 'vaso pequeno', 210.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-guanabana-en-leche', 'vaso mediano', 280.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-guanabana-en-leche', 'vaso grande', 350.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-guanabana-en-leche', 'guanabana', 'Guanabana', 90.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-guanabana-en-leche', null, 'Leche entera', 180.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-guanabana-en-leche', null, 'Azucar blanca', 10.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'jugo-de-guayaba-en-agua' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('jugo-de-guayaba-en-agua', 'Jugo de guayaba en agua', 'jugo de guayaba, guayaba en agua, jugo de guayaba natural', 'frutas', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 1.2, "vitamina_a_er": 14.59, "magnesio_mg": 11.29, "riboflavina_mg": 0.02, "b12_ug": 0.0, "vitamina_d_ug": 0.0, "grasa_g": 0.45, "zinc_mg": 0.11, "carbos_g": 12.62, "fosforo_mg": 18.82, "sodio_mg": 1.94, "folatos_ug": 23.06, "hierro_mg": 0.13, "potasio_mg": 196.35, "fibra_g": 2.54, "vitamina_c_mg": 107.44, "tiamina_mg": 0.03, "niacina_mg": 0.51, "kcal": 54.76, "epa_g": 0.0, "calcio_mg": 13.24, "dha_g": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-guayaba-en-agua', 'vaso pequeno', 190.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-guayaba-en-agua', 'vaso mediano', 260.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-guayaba-en-agua', 'vaso grande', 320.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-guayaba-en-agua', 'guayaba', 'Guayaba', 120.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-guayaba-en-agua', null, 'Azucar blanca', 15.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-guayaba-en-agua', 'agua', 'Agua', 120.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'jugo-de-guayaba-en-leche' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('jugo-de-guayaba-en-leche', 'Jugo de guayaba en leche', 'jugo de guayaba en leche, guayaba en leche', 'lacteos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 2.84, "fibra_g": 1.74, "epa_g": 0.0, "kcal": 74.89, "hierro_mg": 0.1, "carbos_g": 11.26, "calcio_mg": 78.46, "zinc_mg": 0.31, "sodio_mg": 28.32, "b12_ug": 0.29, "grasa_g": 2.39, "dha_g": 0.0, "vitamina_d_ug": 0.84, "magnesio_mg": 13.5, "potasio_mg": 218.96428571428572, "vitamina_a_er": 39.53571428571428, "riboflavina_mg": 0.12217857142857146, "fosforo_mg": 66.85714285714285, "niacina_mg": 0.4056428571428572, "tiamina_mg": 0.05110714285714286, "folatos_ug": 18.964285714285715, "vitamina_c_mg": 73.38214285714285}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-guayaba-en-leche', 'vaso pequeno', 210.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-guayaba-en-leche', 'vaso mediano', 280.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-guayaba-en-leche', 'vaso grande', 350.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-guayaba-en-leche', 'guayaba', 'Guayaba', 90.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-guayaba-en-leche', null, 'Leche entera', 180.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-guayaba-en-leche', null, 'Azucar blanca', 10.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'jugo-de-lulo-en-agua' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('jugo-de-lulo-en-agua', 'Jugo de lulo en agua', 'jugo de lulo, lulo en agua, jugo de naranjilla', 'frutas', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 0.17, "fibra_g": 0.43, "epa_g": 0.0, "kcal": 36.69, "hierro_mg": 0.14, "carbos_g": 9.26, "calcio_mg": 8.6, "zinc_mg": 0.04, "sodio_mg": 2.71, "b12_ug": 0.0, "grasa_g": 0.09, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 5.35, "potasio_mg": 77.65891472868218, "vitamina_a_er": 10.852713178294573, "riboflavina_mg": 0.0013255813953488372, "fosforo_mg": 4.651162790697675, "niacina_mg": 0.562015503875969, "tiamina_mg": 0.01744186046511628, "folatos_ug": 1.1627906976744187, "vitamina_c_mg": 1.2403100775193798}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-lulo-en-agua', 'vaso pequeno', 190.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-lulo-en-agua', 'vaso mediano', 260.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-lulo-en-agua', 'vaso grande', 320.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-lulo-en-agua', 'lulo-pulpa-congelada-sin-azucar', 'Pulpa de lulo', 100.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-lulo-en-agua', null, 'Azucar blanca', 18.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-lulo-en-agua', 'agua', 'Agua', 140.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'jugo-de-mango-en-agua' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('jugo-de-mango-en-agua', 'Jugo de mango en agua', 'jugo de mango, mango en agua, jugo de mango natural', 'frutas', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 0.43, "fibra_g": 0.83, "epa_g": 0.0, "kcal": 46.68, "hierro_mg": 0.09, "carbos_g": 11.79, "calcio_mg": 10.16, "zinc_mg": 0.05, "sodio_mg": 1.44, "b12_ug": 0.0, "grasa_g": 0.2, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 6.08, "potasio_mg": 87.44, "vitamina_a_er": 28.08, "riboflavina_mg": 0.020519999999999997, "fosforo_mg": 7.28, "niacina_mg": 0.34788, "tiamina_mg": 0.014560000000000002, "folatos_ug": 22.36, "vitamina_c_mg": 18.928}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-mango-en-agua', 'vaso pequeno', 190.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-mango-en-agua', 'vaso mediano', 250.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-mango-en-agua', 'vaso grande', 310.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-mango-en-agua', 'mango', 'Mango', 130.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-mango-en-agua', null, 'Azucar blanca', 10.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-mango-en-agua', 'agua', 'Agua', 110.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'jugo-de-maracuya-en-agua' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('jugo-de-maracuya-en-agua', 'Jugo de maracuya en agua', 'jugo de maracuya, maracuya en agua, jugo de parchita', 'frutas', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 0.12, "fibra_g": 0.06, "epa_g": 0.0, "kcal": 47.28, "hierro_mg": 0.08, "carbos_g": 12.35, "calcio_mg": 7.36, "zinc_mg": 0.02, "sodio_mg": 3.2, "b12_ug": 0.0, "grasa_g": 0.02, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 6.64, "potasio_mg": 89.12, "vitamina_a_er": 11.52, "riboflavina_mg": 0.04344, "fosforo_mg": 4.16, "niacina_mg": 0.4672, "tiamina_mg": 0.0, "folatos_ug": 2.2399999999999998, "vitamina_c_mg": 9.536}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-maracuya-en-agua', 'vaso pequeno', 190.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-maracuya-en-agua', 'vaso mediano', 250.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-maracuya-en-agua', 'vaso grande', 310.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-maracuya-en-agua', null, 'Pulpa o jugo de maracuya', 80.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-maracuya-en-agua', null, 'Azucar blanca', 20.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-maracuya-en-agua', 'agua', 'Agua', 150.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'jugo-de-mora-en-agua' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('jugo-de-mora-en-agua', 'Jugo de mora en agua', 'jugo de mora, mora en agua, jugo de mora natural', 'frutas', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 0.65, "fibra_g": 2.49, "epa_g": 0.0, "kcal": 43.0, "hierro_mg": 0.29, "carbos_g": 10.4, "calcio_mg": 18.41, "zinc_mg": 0.25, "sodio_mg": 1.47, "b12_ug": 0.0, "grasa_g": 0.23, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 10.35, "potasio_mg": 76.3529411764706, "vitamina_a_er": 5.176470588235294, "riboflavina_mg": 0.013352941176470587, "fosforo_mg": 10.352941176470589, "niacina_mg": 0.304, "tiamina_mg": 0.009411764705882354, "folatos_ug": 11.76470588235294, "vitamina_c_mg": 9.88235294117647}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-mora-en-agua', 'vaso pequeno', 190.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-mora-en-agua', 'vaso mediano', 260.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-mora-en-agua', 'vaso grande', 320.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-mora-en-agua', 'mora', 'Mora', 120.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-mora-en-agua', null, 'Azucar blanca', 15.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-mora-en-agua', 'agua', 'Agua', 120.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'jugo-de-mora-en-leche' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('jugo-de-mora-en-leche', 'Jugo de mora en leche', 'jugo de mora en leche, mora en leche', 'lacteos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 2.45, "fibra_g": 1.69, "epa_g": 0.0, "kcal": 69.13, "hierro_mg": 0.22, "carbos_g": 10.39, "calcio_mg": 81.43, "zinc_mg": 0.41, "sodio_mg": 27.81, "b12_ug": 0.29, "grasa_g": 2.23, "dha_g": 0.0, "vitamina_d_ug": 0.83, "magnesio_mg": 12.77, "potasio_mg": 136.04255319148933, "vitamina_a_er": 32.87234042553192, "riboflavina_mg": 0.11697872340425532, "fosforo_mg": 60.63829787234043, "niacina_mg": 0.2629787234042553, "tiamina_mg": 0.03574468085106383, "folatos_ug": 11.170212765957446, "vitamina_c_mg": 6.702127659574468}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-mora-en-leche', 'vaso pequeno', 210.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-mora-en-leche', 'vaso mediano', 280.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-mora-en-leche', 'vaso grande', 350.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-mora-en-leche', 'mora', 'Mora', 90.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-mora-en-leche', null, 'Leche entera', 180.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-mora-en-leche', null, 'Azucar blanca', 12.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'jugo-de-papaya-en-agua' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('jugo-de-papaya-en-agua', 'Jugo de papaya en agua', 'jugo de papaya, papaya en agua', 'frutas', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 0.27, "fibra_g": 0.98, "epa_g": 0.0, "kcal": 39.69, "hierro_mg": 0.15, "carbos_g": 10.09, "calcio_mg": 15.42, "zinc_mg": 0.05, "sodio_mg": 5.42, "b12_ug": 0.0, "grasa_g": 0.15, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 12.88, "potasio_mg": 105.07692307692307, "vitamina_a_er": 27.115384615384613, "riboflavina_mg": 0.016307692307692308, "fosforo_mg": 5.769230769230769, "niacina_mg": 0.20596153846153845, "tiamina_mg": 0.013269230769230768, "folatos_ug": 21.346153846153847, "vitamina_c_mg": 35.13461538461538}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-papaya-en-agua', 'vaso pequeno', 200.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-papaya-en-agua', 'vaso mediano', 260.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-papaya-en-agua', 'vaso grande', 320.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-papaya-en-agua', 'papaya', 'Papaya', 150.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-papaya-en-agua', null, 'Azucar blanca', 10.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('jugo-de-papaya-en-agua', 'agua', 'Agua', 100.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'limonada' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('limonada', 'Limonada', 'limonada, limonada natural, jugo de limon', 'carbohidratos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 0.05, "fibra_g": 0.05, "epa_g": 0.0, "kcal": 33.96, "hierro_mg": 0.01, "carbos_g": 9.01, "calcio_mg": 9.76, "zinc_mg": 0.01, "sodio_mg": 1.92, "b12_ug": 0.0, "grasa_g": 0.01, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 2.56, "potasio_mg": 14.2, "vitamina_a_er": 0.24, "riboflavina_mg": 0.00332, "fosforo_mg": 1.6800000000000002, "niacina_mg": 0.01704, "tiamina_mg": 0.0029999999999999996, "folatos_ug": 1.2, "vitamina_c_mg": 3.5999999999999996}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('limonada', 'vaso pequeno', 190.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('limonada', 'vaso mediano', 250.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('limonada', 'vaso grande', 310.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('limonada', null, 'Jugo de limon', 30.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('limonada', null, 'Azucar blanca', 20.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('limonada', 'agua', 'Agua', 200.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'limonada-de-coco' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('limonada-de-coco', 'Limonada de coco', 'limonada de coco, limonada cocosette', 'carbohidratos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 0.61, "fibra_g": 0.05, "epa_g": 0.0, "kcal": 91.48, "hierro_mg": 0.93, "carbos_g": 10.51, "calcio_mg": 11.91, "zinc_mg": 0.17, "sodio_mg": 4.97, "b12_ug": 0.0, "grasa_g": 5.93, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 14.76, "potasio_mg": 75.21428571428571, "vitamina_a_er": 0.23809523809523808, "riboflavina_mg": 0.003444444444444445, "fosforo_mg": 28.33333333333334, "niacina_mg": 0.19384920634920635, "tiamina_mg": 0.009087301587301585, "folatos_ug": 5.079365079365079, "vitamina_c_mg": 3.849206349206349}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('limonada-de-coco', 'vaso pequeno', 190.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('limonada-de-coco', 'vaso mediano', 250.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('limonada-de-coco', 'vaso grande', 320.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('limonada-de-coco', null, 'Jugo de limon', 30.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('limonada-de-coco', null, 'Leche de coco', 70.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('limonada-de-coco', null, 'Azucar blanca', 22.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('limonada-de-coco', 'agua', 'Agua o hielo', 130.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'sustituto-de-comida-preparado-con-leche' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('sustituto-de-comida-preparado-con-leche', 'Sustituto de comida preparado con leche', 'batido sustituto de comida; meal replacement preparado; Ensure preparado', 'carbohidratos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 5.43, "fibra_g": 0.05, "epa_g": 0.0, "kcal": 88.14, "hierro_mg": 1.61, "carbos_g": 12.62, "calcio_mg": 146.01, "zinc_mg": 1.45, "sodio_mg": 82.55, "b12_ug": 0.7, "grasa_g": 1.84, "dha_g": 0.0, "vitamina_d_ug": 0.96, "magnesio_mg": 39.19, "potasio_mg": 258.1888111888112, "vitamina_a_er": 151.22377622377624, "riboflavina_mg": 0.14493006993006993, "fosforo_mg": 143.7832167832168, "niacina_mg": 1.8903496503496504, "tiamina_mg": 0.15856643356643357, "folatos_ug": 37.62237762237762, "vitamina_c_mg": 9.67972027972028}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('sustituto-de-comida-preparado-con-leche', 'vaso pequeno', 210.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('sustituto-de-comida-preparado-con-leche', 'vaso mediano', 290.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('sustituto-de-comida-preparado-con-leche', 'vaso grande', 360.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('sustituto-de-comida-preparado-con-leche', 'batido-sustituto-de-comida-en-polvo', 'batido sustituto de comida en polvo (1 sobre)', 36.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('sustituto-de-comida-preparado-con-leche', 'leche-semidescremada-2', 'leche semidescremada 2%', 250.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'te-frio-en-botella' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('te-frio-en-botella', 'Te frio en botella', 'te frio, fuze tea, lipton te, mr tea, te helado en botella', 'carbohidratos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 0.0, "fibra_g": 0.0, "epa_g": 0.0, "kcal": 26.93, "hierro_mg": 0.02, "carbos_g": 6.99, "calcio_mg": 0.07, "zinc_mg": 0.02, "sodio_mg": 2.87, "b12_ug": 0.0, "grasa_g": 0.0, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 2.8, "potasio_mg": 34.64925373134328, "vitamina_a_er": 0.0, "riboflavina_mg": 0.01433582089552239, "fosforo_mg": 0.9328358208955223, "niacina_mg": 0.0, "tiamina_mg": 0.0, "folatos_ug": 4.664179104477612, "vitamina_c_mg": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('te-frio-en-botella', 'vaso pequeno', 200.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('te-frio-en-botella', 'vaso mediano', 270.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('te-frio-en-botella', 'vaso grande', 340.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('te-frio-en-botella', 'te-negro-caliente', 'Te negro colado', 250.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('te-frio-en-botella', null, 'Azucar blanca', 18.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'cafe-con-leche' and nombre not in ('pocillo pequeno', 'pocillo mediano', 'pocillo grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('cafe-con-leche', 'Cafe con leche', 'cafe con leche, perico, pintadito, cafe en leche', 'lacteos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 1.65, "fibra_g": 0.0, "epa_g": 0.0, "kcal": 42.0, "hierro_mg": 0.01, "carbos_g": 5.48, "calcio_mg": 60.52, "zinc_mg": 0.21, "sodio_mg": 19.39, "b12_ug": 0.26, "grasa_g": 1.56, "dha_g": 0.0, "vitamina_d_ug": 0.48, "magnesio_mg": 7.21, "potasio_mg": 96.35483870967742, "vitamina_a_er": 15.483870967741936, "riboflavina_mg": 0.10416129032258066, "fosforo_mg": 50.32258064516129, "niacina_mg": 0.1432258064516129, "tiamina_mg": 0.03387096774193548, "folatos_ug": 0.967741935483871, "vitamina_c_mg": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('cafe-con-leche', 'pocillo pequeno', 190.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('cafe-con-leche', 'pocillo mediano', 250.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('cafe-con-leche', 'pocillo grande', 310.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('cafe-con-leche', 'tinto-cafe-negro-sin-azucar', 'Cafe negro colado', 120.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('cafe-con-leche', 'leche-entera', 'Leche entera', 120.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('cafe-con-leche', null, 'Azucar', 8.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'chocolate-caliente-en-leche' and nombre not in ('pocillo pequeno', 'pocillo mediano', 'pocillo grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('chocolate-caliente-en-leche', 'Chocolate caliente en leche', 'chocolate en leche, chocolate caliente, chocolate santafereno', 'lacteos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 3.19, "fibra_g": 0.36, "epa_g": 0.0, "kcal": 94.18, "hierro_mg": 0.23, "carbos_g": 11.4, "calcio_mg": 105.82, "zinc_mg": 0.45, "sodio_mg": 39.36, "b12_ug": 0.41, "grasa_g": 4.37, "dha_g": 0.0, "vitamina_d_ug": 1.18, "magnesio_mg": 17.73, "potasio_mg": 156.0909090909091, "vitamina_a_er": 41.81818181818181, "riboflavina_mg": 0.1631818181818182, "fosforo_mg": 89.27272727272727, "niacina_mg": 0.24718181818181817, "tiamina_mg": 0.047, "folatos_ug": 5.0, "vitamina_c_mg": 0.009090909090909092}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('chocolate-caliente-en-leche', 'pocillo pequeno', 160.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('chocolate-caliente-en-leche', 'pocillo mediano', 220.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('chocolate-caliente-en-leche', 'pocillo grande', 280.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('chocolate-caliente-en-leche', null, 'Leche entera', 200.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('chocolate-caliente-en-leche', 'chocolate-de-mesa-pastilla-sin-preparar', 'Chocolate de mesa (pastilla)', 20.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'chocolate-con-leche' and nombre not in ('pocillo pequeno', 'pocillo mediano', 'pocillo grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('chocolate-con-leche', 'Chocolate con leche', 'chocolate, chocolate caliente, chocolate en leche, pocillo de chocolate', 'lacteos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 3.31, "fibra_g": 0.36, "epa_g": 0.0, "kcal": 93.27, "hierro_mg": 0.2, "carbos_g": 11.28, "calcio_mg": 114.91, "zinc_mg": 0.49, "sodio_mg": 34.82, "b12_ug": 0.49, "grasa_g": 4.33, "dha_g": 0.0, "vitamina_d_ug": 0.91, "magnesio_mg": 19.45, "potasio_mg": 172.45454545454544, "vitamina_a_er": 29.09090909090909, "riboflavina_mg": 0.13500000000000004, "fosforo_mg": 104.72727272727273, "niacina_mg": 0.2617272727272727, "tiamina_mg": 0.056090909090909094, "folatos_ug": 0.45454545454545453, "vitamina_c_mg": 0.009090909090909092}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('chocolate-con-leche', 'pocillo pequeno', 160.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('chocolate-con-leche', 'pocillo mediano', 220.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('chocolate-con-leche', 'pocillo grande', 280.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('chocolate-con-leche', 'leche-entera', 'Leche entera', 200.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('chocolate-con-leche', 'chocolate-de-mesa-pastilla-sin-preparar', 'Chocolate de mesa (pastilla) - proxy tablilla mexicana', 20.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'chocolate-con-queso' and nombre not in ('pocillo pequeno', 'pocillo mediano', 'pocillo grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('chocolate-con-queso', 'Chocolate con queso', 'chocolate con queso, chocolate santafereno', 'otro', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 5.18, "fibra_g": 0.32, "epa_g": 0.0, "kcal": 117.77, "hierro_mg": 0.17, "carbos_g": 10.28, "calcio_mg": 173.34, "zinc_mg": 0.78, "sodio_mg": 105.82, "b12_ug": 0.43, "grasa_g": 6.61, "dha_g": 0.0, "vitamina_d_ug": 0.8, "magnesio_mg": 20.44, "potasio_mg": 166.928, "vitamina_a_er": 25.6, "riboflavina_mg": 0.11880000000000003, "fosforo_mg": 138.936, "niacina_mg": 0.23032, "tiamina_mg": 0.04936000000000001, "folatos_ug": 0.4, "vitamina_c_mg": 0.008}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('chocolate-con-queso', 'pocillo pequeno', 190.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('chocolate-con-queso', 'pocillo mediano', 250.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('chocolate-con-queso', 'pocillo grande', 310.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('chocolate-con-queso', 'leche-entera', 'Leche entera', 200.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('chocolate-con-queso', 'chocolate-de-mesa-pastilla-sin-preparar', 'Chocolate de mesa (pastilla) - proxy tablilla mexicana', 20.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('chocolate-con-queso', 'queso-campesino-tajada-de-queso', 'Queso campesino', 30.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'chocolate-en-agua' and nombre not in ('pocillo pequeno', 'pocillo mediano', 'pocillo grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('chocolate-en-agua', 'Chocolate en agua', 'chocolate en agua, chocolate de agua, pocillo de chocolate', 'carbohidratos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 0.33, "fibra_g": 0.36, "epa_g": 0.0, "kcal": 38.73, "hierro_mg": 0.2, "carbos_g": 7.04, "calcio_mg": 12.18, "zinc_mg": 0.11, "sodio_mg": 2.09, "b12_ug": 0.0, "grasa_g": 1.42, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 10.45, "potasio_mg": 36.09090909090909, "vitamina_a_er": 0.0, "riboflavina_mg": 0.009545454545454546, "fosforo_mg": 12.909090909090908, "niacina_mg": 0.16627272727272727, "tiamina_mg": 0.0051818181818181815, "folatos_ug": 0.45454545454545453, "vitamina_c_mg": 0.009090909090909092}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('chocolate-en-agua', 'pocillo pequeno', 160.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('chocolate-en-agua', 'pocillo mediano', 220.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('chocolate-en-agua', 'pocillo grande', 280.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('chocolate-en-agua', 'chocolate-de-mesa-pastilla-sin-preparar', 'Chocolate de mesa (pastilla)', 20.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('chocolate-en-agua', 'agua', 'Agua', 200.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'tinto-con-azucar' and nombre not in ('pocillo pequeno', 'pocillo mediano', 'pocillo grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('tinto-con-azucar', 'Tinto con azucar', 'tinto con azucar, cafe con azucar, tinto dulce', 'carbohidratos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 0.11, "fibra_g": 0.0, "epa_g": 0.0, "kcal": 20.54, "hierro_mg": 0.01, "carbos_g": 5.06, "calcio_mg": 1.95, "zinc_mg": 0.02, "sodio_mg": 1.95, "b12_ug": 0.0, "grasa_g": 0.02, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 2.85, "potasio_mg": 46.62025316455696, "vitamina_a_er": 0.0, "riboflavina_mg": 0.07311392405063291, "fosforo_mg": 2.848101265822785, "niacina_mg": 0.18132911392405066, "tiamina_mg": 0.013291139240506329, "folatos_ug": 1.89873417721519, "vitamina_c_mg": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('tinto-con-azucar', 'pocillo pequeno', 120.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('tinto-con-azucar', 'pocillo mediano', 160.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('tinto-con-azucar', 'pocillo grande', 200.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('tinto-con-azucar', 'tinto-cafe-negro-sin-azucar', 'Cafe negro colado', 150.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('tinto-con-azucar', null, 'Azucar blanca', 8.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;

delete from public.alimento_medidas
where alimento_id = 'aguardiente-un-trago' and nombre not in ('trago');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('aguardiente-un-trago', 'Aguardiente (un trago)', 'aguardiente, guaro, trago de aguardiente, antioqueno, nectar', 'otro', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 0.0, "fibra_g": 0.0, "epa_g": 0.0, "kcal": 169.4, "hierro_mg": 0.03, "carbos_g": 0.0, "calcio_mg": 2.67, "zinc_mg": 0.03, "sodio_mg": 1.27, "b12_ug": 0.0, "grasa_g": 0.0, "dha_g": 0.0, "vitamina_d_ug": 0.0, "magnesio_mg": 0.53, "potasio_mg": 1.4666666666666666, "vitamina_a_er": 0.0, "riboflavina_mg": 0.002933333333333333, "fosforo_mg": 2.933333333333333, "niacina_mg": 0.009533333333333333, "tiamina_mg": 0.0044, "folatos_ug": 0.0, "vitamina_c_mg": 0.0}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('aguardiente-un-trago', 'trago', 30.0, 'coach')
on conflict (alimento_id, nombre) do update set gramos = excluded.gramos, fuente = excluded.fuente;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('aguardiente-un-trago', null, 'Destilado de 40 grados', 22.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
insert into public.alimento_recetas (alimento_id, ingrediente_id, que_es, gramos) values ('aguardiente-un-trago', 'agua', 'Agua (para bajarlo a ~29 grados del aguardiente)', 8.0)
on conflict (alimento_id, que_es) do update set ingrediente_id = excluded.ingrediente_id, gramos = excluded.gramos;
