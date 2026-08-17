-- 0035 · Que un veto se pueda quitar sin perder que existió
--
-- QUÉ AÑADE. Una columna `borrado` a `perfil_alimentario_veto`, igual que la
-- que ya llevan `registro_comida` y `registro_item` (0015).
--
-- POR QUÉ HACE FALTA, Y NO ES UNA PREFERENCIA DE ESTILO. La cola de
-- sincronización de la app solo sabe hacer `upsert` y `update` (ver
-- `src/data/nube/cola.ts`): no existe la operación borrar. Sin esta columna,
-- quitar un veto desde el móvil no tendría forma de llegar a la base — la
-- nutricionista lo quitaría, lo vería desaparecer de su pantalla, y en la
-- siguiente hidratación volvería. Un dato que reaparece solo es peor que uno
-- que no se puede borrar: nadie vuelve a confiar en esa pantalla.
--
-- Y ADEMÁS ES EL COMPORTAMIENTO QUE SE QUIERE. Un veto retirado es un hecho
-- clínico: «Manuela le levantó la restricción al marisco el 12 de agosto» es
-- exactamente el tipo de cosa que hay que poder mirar hacia atrás cuando algo
-- salió mal. Borrar la fila lo perdería.
--
-- NO TOCA EL UNIQUE (asesorado_id, alimento_id) a propósito: volver a vetar el
-- mismo alimento reactiva la fila con un upsert en vez de crear una segunda.
-- Un veto es un estado, no un historial de eventos, y dos filas vivas del mismo
-- alimento serían una contradicción que alguien tendría que resolver leyendo
-- fechas.

begin;

alter table public.perfil_alimentario_veto
  add column if not exists borrado boolean not null default false;

-- Los vetos vivos de una persona son la consulta real, y es la que corre en
-- cada hidratación. El unique existente lidera por asesorado_id, así que este
-- índice parcial solo añade el filtro que de verdad se usa.
create index if not exists perfil_alimentario_veto_vivos
  on public.perfil_alimentario_veto (asesorado_id)
  where not borrado;

commit;
