-- 0033 · Los cuatro ultimos duplicados, decididos uno a uno
--
-- Cierra la cola de candidatos a duplicado: de 42, quedaban 4 sin decidir y
-- Bryan los resolvio el 2026-08-09. Toca 3 filas.
--
--   · POSTA DE RES: se une con "Res, carne magra" PROMEDIANDO las dos fuentes,
--     que es lo que Bryan pidio expresamente. Cambian 19 nutrientes. El zinc
--     baja de 6,90 a 5,25 -consecuencia avisada antes de aplicarla, no un
--     descuido: parte del 6,90 que la 0031 habia tomado de la TCAC-.
--   · BAGRE: el de USDA se une al magro de la TCAC, que recibe la vitamina D
--     (12,5 ug), el EPA y el DHA. La TCAC no publica ninguno de los tres en
--     ninguna fila, asi que sin este traspaso se perderian al esconder la fila.
--   · FRESA: la de USDA se une a la madura. Solo viajan EPA y DHA.
--
-- LAS FILAS MARCADAS COMO DUPLICADO NO SE BORRAN (4 en total), y hoy
-- TAMPOCO SE ESCONDEN EN LA APP. Conviene no confundir las dos cosas:
--
--   · Lo que `es_duplicado` apaga hoy son la tabla de bioequivalencias y el
--     filtro por persona, las dos del lado de las herramientas.
--   · El buscador de la app NO lo consulta -no hay una sola referencia a
--     `es_duplicado` en `app/src`-, asi que "Fresa" y "Fresa, madura, cruda"
--     siguen apareciendo las dos al escribir fresa.
--
-- Esconderlas del buscador es un cambio de la app pendiente, y no es tan simple
-- como quitarlas del indice: las comidas ya registradas resuelven su alimento
-- con `porId(id)` contra ese mismo indice, asi que sacarlas de ahi le vaciaria
-- el historico a quien las hubiera registrado. Hay que marcarlas y filtrarlas
-- en `buscar()`, no eliminarlas.
--
-- FUSIONA, NO SUSTITUYE: `por_100g` se actualiza con `||`, asi que un nutriente
-- que no venga aqui se queda como esta. Reejecutable.

update public.alimentos as a
set por_100g = a.por_100g || v.datos
from (values
  ('carne-de-res-magra-posta-o-bola-de-pierna-cruda', '{"b12_ug": 2.99, "calcio_mg": 9.5, "carbos_g": 0.0, "dha_g": 0.002, "epa_g": 0.002, "fibra_g": 0.0, "folatos_ug": 7.5, "fosforo_mg": 217.5, "grasa_g": 4.055, "hierro_mg": 2.52, "kcal": 131.0, "magnesio_mg": 14.95, "niacina_mg": 5.63, "potasio_mg": 326.5, "proteina_g": 22.75, "riboflavina_mg": 0.24, "sodio_mg": 53.0, "tiamina_mg": 0.072, "vitamina_a_er": 0.0, "vitamina_c_mg": 0.0, "vitamina_d_ug": 0.0, "zinc_mg": 5.25}'::jsonb),
  ('bagre-magro-sin-cabeza-crudo', '{"b12_ug": 2.09, "calcio_mg": 19, "carbos_g": 0.2, "dha_g": 0.234, "epa_g": 0.13, "fibra_g": 0.0, "folatos_ug": 5, "fosforo_mg": 201, "grasa_g": 2.4, "hierro_mg": 1.9, "kcal": 93, "magnesio_mg": 27, "niacina_mg": 2.0, "potasio_mg": 279, "proteina_g": 17.5, "riboflavina_mg": 0.08, "sodio_mg": 83, "tiamina_mg": 0.19, "vitamina_a_er": 15, "vitamina_c_mg": 0, "vitamina_d_ug": 12.5, "zinc_mg": 0.6}'::jsonb),
  ('fresa-madura-cruda', '{"b12_ug": 0.0, "calcio_mg": 21, "carbos_g": 6.3, "dha_g": 0.0, "epa_g": 0.0, "fibra_g": 2.0, "folatos_ug": 22, "fosforo_mg": 26, "grasa_g": 0.5, "hierro_mg": 0.5, "kcal": 45, "magnesio_mg": 13, "niacina_mg": 0.4, "potasio_mg": 157, "proteina_g": 0.8, "riboflavina_mg": 0.03, "sodio_mg": 2, "tiamina_mg": 0.03, "vitamina_a_er": 4, "vitamina_c_mg": 67, "vitamina_d_ug": null, "zinc_mg": 0.2}'::jsonb)
) as v(id, datos)
where a.id = v.id;

-- Las medidas caseras de las filas que mandan. `on conflict` para que
-- correrla dos veces no duplique la fila ni cambie unos gramos ya buenos.
insert into public.alimento_medidas (alimento_id, nombre, gramos, fuente)
values
  ('bagre-magro-sin-cabeza-crudo', 'filete', 159.0, 'usda')
on conflict (alimento_id, nombre) do update
  set gramos = excluded.gramos, fuente = excluded.fuente;
