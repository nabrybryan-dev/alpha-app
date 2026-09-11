-- Comprobación de la migración 0060 (activar un microciclo es una sola operación).
--
-- Las consultas 1 y 2 son de estado y tienen que devolver lo que dicen. La 3 es la
-- única que prueba algo: **sin ella, «cero filas» arriba se cumple igual si la
-- migración no se aplicó nunca**. Es la diferencia entre comprobar y suponer.

-- 1 · La función existe, es `invoker` y no la puede llamar la clave anónima.
--     UNA fila, con `invoker = true` y `anon_puede = false`.
select p.proname                                    as funcion,
       not p.prosecdef                              as invoker,
       has_function_privilege('anon',          p.oid, 'execute') as anon_puede,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_puede
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'activar_microciclo';

-- 2 · Nadie con dos activos. CERO filas.
--     Es el estado que el índice de la `0059` va a exigir; esta función es lo que
--     hace que se pueda exigir sin romper a nadie.
select m.usuario_id, count(*) as activos
  from public.microciclos m
 where m.estado = 'activo'
 group by m.usuario_id
having count(*) > 1;

-- 3 · VERLO MORDER, y verlo funcionar. **Esto NO se corre en producción.**
--     Va en una rama de Supabase o en local, con un usuario de prueba, y prueba
--     las tres cosas que importan. Se deja escrito para que la próxima sesión no
--     tenga que inventarlo.
--
-- begin;
--   -- Punto de partida: una persona con su activo y su propuesta.
--   insert into public.microciclos (id, usuario_id, numero, estado, datos) values
--     ('t-0060-viejo', '<uuid de prueba>', 1, 'activo',
--      '{"estado":"activo"}'::jsonb),
--     ('t-0060-nuevo', '<uuid de prueba>', 2, 'propuesto',
--      '{"estado":"propuesto"}'::jsonb);
--
--   -- (a) Activar deja EXACTAMENTE uno activo, y es el nuevo.
--   select public.activar_microciclo('t-0060-nuevo');
--   select id, estado, datos->>'estado' as estado_json
--     from public.microciclos where id like 't-0060-%' order by id;
--   -- esperado: t-0060-nuevo activo/activo · t-0060-viejo cerrado/cerrado
--
--   -- (b) Llamarla otra vez NO falla: la cola reintenta y esto tiene que ser
--   --     inofensivo. Sin idempotencia, un reintento tumbaría la cola entera.
--   select public.activar_microciclo('t-0060-nuevo');
--
--   -- (c) Un cerrado no se reabre.
--   select public.activar_microciclo('t-0060-viejo');
--   select id, estado from public.microciclos where id = 't-0060-viejo';
--   -- esperado: sigue cerrado
-- rollback;
--
-- Y la prueba de que esto era necesario, contra una base CON el índice de la
-- `0059` puesto: las dos escrituras sueltas de antes —primero abrir, después
-- cerrar— fallan en la primera con
-- `duplicate key value violates unique constraint "microciclos_un_activo_por_usuario"`,
-- mientras que `activar_microciclo` pasa. Ese par de corridas es lo que justifica
-- el orden de las obras: primero esta función, después el candado.
