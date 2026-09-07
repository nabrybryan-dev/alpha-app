-- Comprobación de la migración 0059 (un solo microciclo activo por persona).
-- Las consultas 1 y 2 tienen que devolver CERO filas. La 3 tiene que devolver UNA.
--
-- ORDEN: la 1 se corre ANTES de aplicar la migración; si devuelve filas, la creación del
-- índice va a fallar y hay que resolver esos casos primero. Las otras dos, después.

-- 1 · ANTES · Nadie puede tener dos microciclos activos, o el índice no se puede crear.
--     Cero filas = se puede aplicar.
select m.usuario_id, u.nombre, count(*) as activos,
       string_agg(m.id, ', ' order by m.id) as cuales
  from public.microciclos m
  join public.usuarios_app u on u.id = m.usuario_id
 where m.estado = 'activo'
 group by m.usuario_id, u.nombre
having count(*) > 1;

-- 2 · DESPUÉS · Nadie los tiene tampoco ahora. Es la misma consulta a propósito: si el
--     índice está puesto, esto no puede devolver filas ni aunque alguien lo intente.
select m.usuario_id, count(*) as activos
  from public.microciclos m
 where m.estado = 'activo'
 group by m.usuario_id
having count(*) > 1;

-- 3 · DESPUÉS · El índice existe y es PARCIAL sobre las filas activas.
--     Una fila = puesto. Cero filas = la migración no se aplicó.
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename = 'microciclos'
   and indexname = 'microciclos_un_activo_por_usuario';

-- 4 · VERLO MORDER · Esto NO se corre en producción. Es para el entorno de prueba, y es
--     la única forma de saber que el índice hace algo: sin esto, «cero filas» arriba se
--     cumple igual si la migración no se aplicó nunca.
--
--     El segundo INSERT tiene que fallar con
--     `duplicate key value violates unique constraint "microciclos_un_activo_por_usuario"`.
--     Si pasa sin quejarse, el índice no está.
--
-- begin;
--   insert into public.microciclos (id, usuario_id, numero, estado, datos)
--   values ('t-0058-a', '<uuid de prueba>', 901, 'activo', '{}'::jsonb);
--   insert into public.microciclos (id, usuario_id, numero, estado, datos)
--   values ('t-0058-b', '<uuid de prueba>', 902, 'activo', '{}'::jsonb);  -- debe fallar
-- rollback;
