-- 0042 · Que algo se pueda sacar de la despensa sin perder que estuvo
--
-- QUÉ AÑADE. Una columna `borrado` a `despensa`, igual que la que la 0035 le
-- añadió a `perfil_alimentario_veto` y la 0015 a `registro_comida`.
--
-- POR QUÉ HACE FALTA. La 0024 creó la tabla sin ella, y la cola de
-- sincronización solo sabe `upsert` y `update` (ver `src/data/nube/cola.ts`):
-- no existe la operación borrar. Sin esta columna, sacar el pollo de la
-- despensa desde el móvil no tendría forma de llegar a la base — la persona lo
-- quitaría, lo vería desaparecer, y en la siguiente hidratación volvería.
--
-- Un dato que reaparece solo es peor que uno que no se puede borrar: nadie
-- vuelve a confiar en esa pantalla, y esta pantalla decide qué se le propone
-- de comer.
--
-- SE DESCUBRIÓ AL ENCHUFAR LA DESPENSA, no al escribir la 0024. El módulo del
-- dominio tiene `quitar()` desde el 2026-08-05 y la tabla nunca pudo
-- expresarlo: nadie lo notó porque no había capa de datos que lo intentara.
--
-- NO TOCA EL UNIQUE PARCIAL (asesorado_id, alimento_id) a propósito. Volver a
-- comprar algo reactiva su fila con un upsert en vez de crear una segunda, que
-- es lo que ya hace `agregar()` en el dominio: «volver a comprar algo no es
-- tenerlo dos veces, es tenerlo otra vez».
--
-- CUIDADO CON EL ÍNDICE DE `cliente_id`: sigue SIN ser parcial, y así tiene que
-- quedarse. `ON CONFLICT (cliente_id)` no puede arbitrar sobre un índice con
-- `WHERE` — es lo que dejó el registro de comidas sin subir durante semanas
-- (ver 0023).

begin;

alter table public.despensa
  add column if not exists borrado boolean not null default false;

-- Lo que hay en casa AHORA es la consulta real, y la que corre en cada
-- hidratación. El índice `despensa_por_asesorado` ya lidera por asesorado_id;
-- este añade el filtro que de verdad se usa.
create index if not exists despensa_viva
  on public.despensa (asesorado_id, agregado_en desc)
  where not borrado;

comment on column public.despensa.borrado is
  'Se saco de la despensa. La fila se conserva: la cola de sync no sabe borrar, y '
  'que algo estuvo y se acabo es informacion real. Ver 0042.';

commit;
