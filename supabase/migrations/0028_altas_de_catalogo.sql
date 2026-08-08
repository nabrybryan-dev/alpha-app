-- 0028 · Altas de catalogo posteriores a la carga inicial
--
-- 1 alimento(s) que no existian cuando se cargo el catalogo. Se emiten
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
where alimento_id = 'jugo-de-guayaba-en-leche' and nombre not in ('vaso pequeno', 'vaso mediano', 'vaso grande');

insert into public.alimentos (id, nombre, sinonimos, grupo, estado, confianza, origen, origen_id, por_100g, creado_por) values ('jugo-de-guayaba-en-leche', 'Jugo de guayaba en leche', 'jugo de guayaba en leche, guayaba en leche', 'lacteos', 'preparado', 'estimado', 'receta', null, '{"proteina_g": 2.84, "fibra_g": 1.74, "epa_g": 0.0, "kcal": 74.89, "hierro_mg": 0.1, "carbos_g": 11.26, "calcio_mg": 78.46, "zinc_mg": 0.31, "sodio_mg": 28.32, "b12_ug": 0.29, "grasa_g": 2.39, "dha_g": 0.0, "vitamina_d_ug": 0.84, "magnesio_mg": 13.5, "potasio_mg": 218.96428571428572, "vitamina_a_er": 39.53571428571428, "riboflavina_mg": 0.12217857142857146, "fosforo_mg": 66.85714285714285, "niacina_mg": 0.4056428571428572, "tiamina_mg": 0.05110714285714286, "folatos_ug": 18.964285714285715, "vitamina_c_mg": 73.38214285714285}'::jsonb, null)
on conflict (id) do update set
  nombre = excluded.nombre, sinonimos = excluded.sinonimos,
  grupo = excluded.grupo, estado = excluded.estado,
  confianza = excluded.confianza, origen = excluded.origen,
  origen_id = excluded.origen_id, por_100g = excluded.por_100g;
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente) values ('jugo-de-guayaba-en-leche', 'vaso pequeno', 200.0, 'coach')
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
