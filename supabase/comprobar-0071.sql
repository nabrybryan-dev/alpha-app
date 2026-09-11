-- Comprobación de la migración 0071 (las tablas de respaldo dicen para qué existen).
--
-- La 1 es de estado. La 2 es el contrato. La 3 es la única que prueba algo: sin
-- ella, «cero filas» en la 2 se cumple igual si la migración no se aplicó nunca
-- y no hay ninguna tabla de respaldo que mirar. Y la 4 es la mitad que casi
-- nadie comprueba: que la señal DEJE de dar rojo cuando el problema se arregla,
-- y que la de caducidad sepa distinguir una fecha pasada de una futura.

-- 1 · ESTADO · las 14 con su rótulo. Se lee. Cada una tiene que decir de qué
--     cambio es copia y hasta cuándo hace falta.
select c.relname as tabla,
       obj_description(c.oid) as rotulo
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'respaldo%'
 order by 1;

-- 2 · CONTRATO: CERO FILAS · ninguna tabla de respaldo sin rótulo con fecha.
--     Antes de la 0071 esto devolvía las 14.
select c.relname as tabla,
       case when obj_description(c.oid) is null then 'sin rotulo'
            else 'el rotulo no trae «caduca AAAA-MM-DD»' end as que_le_falta
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'respaldo%'
   and (obj_description(c.oid) is null
        or obj_description(c.oid) !~ 'caduca [0-9]{4}-[0-9]{2}-[0-9]{2}')
 order by 1;

-- 3 · EL CONTROL POSITIVO, y es imprescindible. Contrato: **14**.
--     Si esto devolviera 0, la consulta 2 saldría en verde por no haber mirado
--     nada, que es exactamente como nace ciego un guardián.
select count(*) as tablas_de_respaldo_inspeccionadas
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'respaldo%';

-- 4 · LAS QUE YA CUMPLIERON · no dice «bórralas», dice «toca decidir».
--     Contrato el 2026-09-11: **una sola**, `respaldo_perfiles_notas_20260906`,
--     porque Bryan confirmó ese día que los objetivos reescritos son los buenos.
--     Las dos siguientes vencen el 24 y el 26 de septiembre.
select c.relname as tabla,
       substring(obj_description(c.oid) from 'caduca ([0-9]{4}-[0-9]{2}-[0-9]{2})')::date as caduco_el,
       current_date - substring(obj_description(c.oid) from 'caduca ([0-9]{4}-[0-9]{2}-[0-9]{2})')::date as dias_vencida
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'respaldo%'
   and obj_description(c.oid) ~ 'caduca [0-9]{4}-[0-9]{2}-[0-9]{2}'
   and substring(obj_description(c.oid) from 'caduca ([0-9]{4}-[0-9]{2}-[0-9]{2})')::date <= current_date
 order by 2, 1;

-- 5 · LO QUE ESTA MIGRACIÓN NO HACE, dicho para que nadie lo dé por hecho.
--     No borra ni una fila, y no engancha nada a la cascada del borrado. Esa
--     decisión está tomada al revés a propósito: con rótulo y caducidad el
--     respaldo es corto y con fecha, y el paracaídas de verdad es el volcado en
--     JSON que se guarda FUERA de la base antes de borrar a alguien. Engancharlas
--     a la cascada compraría limpieza al precio de volver irreversible un borrado
--     equivocado, que de los dos errores es el caro.
--
--     Lo que sí sigue vivo es R-08: un borrado puede dejar filas aquí. Quien lo
--     detecta son las señales 2, 3 y 4 de
--     `cerebro-alpha-agentes/tuberia/sql/comprobar-respaldos.sql`, y el pie de
--     `borrado-todos.sql` ya manda correrlas.
