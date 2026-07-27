-- 0012_origen_mensajes.sql
-- Distingue las respuestas automaticas del Centro de Respuestas de los mensajes
-- que escribe el coach de su puno y letra. La FK de mensajes.de_id exige un
-- usuario real, asi que la respuesta viaja desde el id del coach y se distingue
-- por esta columna. Asi el hilo no se rompe y la app puede pintarla distinto.

alter table public.mensajes
  add column if not exists origen text not null default 'humano';

alter table public.mensajes
  drop constraint if exists mensajes_origen_valido;

alter table public.mensajes
  add constraint mensajes_origen_valido check (origen in ('humano', 'alpha'));

-- Comprobacion: todas las filas previas quedan como 'humano'.
-- select origen, count(*) from public.mensajes group by origen;
