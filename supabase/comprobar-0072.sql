-- Comprobación de la migración 0072 (el primer respaldo que cumplió).
--
-- Aviso honesto sobre la señal 1, y vale igual para la `0051`: en una base recién
-- creada esa tabla no existió nunca, así que la señal dice SI sin que la
-- migración haya hecho nada. Es inherente a un borrado y no tiene arreglo
-- elegante — lo que sí se puede es decir qué la haría decir NO: que la tabla
-- reaparezca, que es exactamente el caso que importa vigilar.

-- 1 · CONTRATO: CERO FILAS · la tabla ya no está.
select c.relname as no_deberia_estar
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname = 'respaldo_perfiles_notas_20260906';

-- 2 · ESTADO · lo que queda, con su rótulo. Contrato el 2026-09-11: **13**, y
--     las 13 con «caduca». Si sale 14, la 0072 no corrió; si sale menos de 13
--     sin una migración que lo explique, alguien volvió a borrar a mano — que es
--     el hábito que toda esta tanda existe para cortar.
select count(*) as tablas_de_respaldo,
       count(*) filter (where obj_description(c.oid) ~ 'caduca [0-9]{4}-[0-9]{2}-[0-9]{2}') as con_rotulo_y_fecha
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'respaldo%';

-- 3 · LAS SIGUIENTES EN CUMPLIR. No dice «bórralas», dice «toca decidir».
--     Contrato tras la 0072: **cero filas hoy**, y dos el 24 y el 26 de
--     septiembre (`tipo_zona2` y `lina_m27`), las dos dejadas vivas por la 0051
--     por motivos que siguen sin resolverse.
select c.relname as tabla,
       substring(obj_description(c.oid) from 'caduca ([0-9]{4}-[0-9]{2}-[0-9]{2})')::date as caduca
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'respaldo%'
   and substring(obj_description(c.oid) from 'caduca ([0-9]{4}-[0-9]{2}-[0-9]{2})')::date <= current_date
 order by 2, 1;

-- 4 · DÓNDE ESTÁ EL PARACAÍDAS, porque una comprobación que no dice dónde
--     buscar el original no sirve el día que haga falta.
--
--     `C:\Users\ASUS\dev\respaldos\perfiles-objetivos-antes-del-7sep-2026-09-11.json`
--     — fuera de la base y fuera de git. 11 filas, 21.248 bytes.
--
--     Cómo se comprobó antes de borrar, y cómo se comprobaría al restaurar:
--       en la base:   select usuario_id, md5(datos->>'objetivos') …
--       en el fichero: md5 del mismo texto, por persona
--     Las once huellas y las once longitudes coincidieron. Control negativo
--     hecho: cambiando una palabra, la huella cambia.
