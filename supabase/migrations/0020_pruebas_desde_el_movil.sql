-- 0020 · Que las pruebas de calibracion puedan subir desde el movil
--
-- Mismo problema y misma solucion que la 0017 para el registro de comidas:
-- `prueba_calibracion.id` es `bigint generated always as identity`, asi que el
-- dispositivo no lo conoce. Sin una llave puesta por el movil, cada reintento
-- de la cola insertaria una prueba nueva.
--
-- Y AQUI DUPLICAR NO ES INOCUO. El sesgo es la MEDIANA de las ultimas quince
-- pruebas. Una prueba duplicada pesa el doble en esa mediana, y si el duplicado
-- cae en un extremo, mueve el veredicto: alguien que estima bien podria quedarse
-- pesando, o -peor- alguien con sesgo real podria pasar el corte y registrar
-- todo con un margen que no le corresponde.
--
-- Las pruebas no se editan nunca: se crean y ya. Pero el `on conflict` sigue
-- haciendo falta, no para actualizar, sino para que reintentar sea inofensivo.

begin;

alter table public.prueba_calibracion
  add column if not exists cliente_id text;

-- Parcial, como en la 0017: las filas que entren por SQL no tienen id de
-- cliente y no deben chocar entre si.
create unique index if not exists prueba_calibracion_cliente_id_unico
  on public.prueba_calibracion (cliente_id)
  where cliente_id is not null;

comment on column public.prueba_calibracion.cliente_id is
  'Id que pone el dispositivo. Sirve para que reintentar la subida no duplique la prueba.';

commit;
