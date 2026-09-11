-- Comprobación de la migración 0069 (un solo microciclo activo por persona).
--
-- Las consultas 1 y 2 son de estado. La 3 es la única que prueba algo: **sin ella,
-- «cero filas» en la 2 se cumple igual si la migración no se aplicó nunca**. Es la
-- diferencia entre comprobar y suponer. Y la 4 es la que la mayoría se olvida: que
-- la vía BUENA siga pasando. Un candado que también cierra la puerta a quien tiene
-- llave no es un candado, es una avería.

-- 1 · El índice existe, es ÚNICO y es PARCIAL. UNA fila, y su definición tiene que
--     llevar `UNIQUE` y `WHERE (estado = 'activo'::text)`.
--     Si saliera único pero sin el `where`, estaría prohibiendo dos CERRADOS, que es
--     lo normal en una persona con historial: el candado equivocado, en verde.
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename  = 'microciclos'
   and indexname  = 'microciclos_un_activo_por_usuario';

-- 2 · Nadie con dos activos. CERO filas.
select m.usuario_id, count(*) as activos
  from public.microciclos m
 where m.estado = 'activo'
 group by m.usuario_id
having count(*) > 1;

-- 3 · VERLO MORDER, contra la base real, sin dejar rastro.
--     Abre un SEGUNDO activo para alguien que ya tiene uno. Tiene que FALLAR con
--     `23505 duplicate key value violates unique constraint`. Todo va dentro de una
--     transacción que se deshace: si el `rollback` no llegara —porque la sentencia
--     revienta antes—, tampoco pasa nada, porque lo que revienta es justo lo que
--     queremos que reviente.
--
--     Corrido el 2026-09-10, antes y después de aplicar la migración, sobre la MISMA
--     persona y con la MISMA sentencia:
--       antes   -> activos_ahora = 2   (la base lo aceptaba)
--       después -> ERROR 23505 ... Key (usuario_id)=(9637b4ce-…) already exists
--
-- begin;
--   create temporary table _victima on commit drop as
--   select a.usuario_id,
--          (select c.id from public.microciclos c
--            where c.usuario_id = a.usuario_id and c.estado = 'cerrado'
--            order by c.numero desc limit 1) as un_cerrado
--     from public.microciclos a
--    where a.estado = 'activo'
--      and exists (select 1 from public.microciclos c
--                   where c.usuario_id = a.usuario_id and c.estado = 'cerrado')
--    limit 1;
--
--   update public.microciclos m
--      set estado = 'activo'
--     from _victima v
--    where m.id = v.un_cerrado;      -- <- aquí tiene que saltar el 23505
--
--   select 'si ves esta fila, el candado NO muerde' as veredicto;
-- rollback;

-- 4 · Y VERLO DEJAR PASAR LA VÍA BUENA. Esto es la otra mitad, y es la que
--     bloqueó esta migración durante tres días: con las dos escrituras sueltas de
--     antes, el índice habría roto la carga semanal de las 23 personas con activo.
--
--     OJO A UNA TRAMPA que ya me comí una vez: si se le pasa a `activar_microciclo`
--     un microciclo **cerrado**, la función SALE SIN HACER NADA —«un bloque cerrado
--     no se reabre»— y devuelve sin error. El ensayo sale «verde» sin haber probado
--     nada. Hay que ponerlo en `propuesto` primero, que es el estado real desde el
--     que se activa. Por eso el `update` de abajo no es decoración.
--
--     Corrido el 2026-09-10 con el índice ya puesto:
--       activos = 1 · el_viejo = cerrado · el_nuevo = activo
--
-- begin;
--   create temporary table _ensayo on commit drop as
--   select a.usuario_id, a.id as el_activo,
--          (select c.id from public.microciclos c
--            where c.usuario_id = a.usuario_id and c.estado = 'cerrado'
--            order by c.numero desc limit 1) as el_que_se_abre
--     from public.microciclos a
--    where a.estado = 'activo'
--      and exists (select 1 from public.microciclos c
--                   where c.usuario_id = a.usuario_id and c.estado = 'cerrado')
--    limit 1;
--
--   update public.microciclos m set estado = 'propuesto'
--     from _ensayo e where m.id = e.el_que_se_abre;
--
--   select public.activar_microciclo((select el_que_se_abre from _ensayo));
--
--   select (select count(*) from public.microciclos m
--            where m.usuario_id = e.usuario_id and m.estado = 'activo') as activos,
--          (select estado from public.microciclos m where m.id = e.el_activo)      as el_viejo,
--          (select estado from public.microciclos m where m.id = e.el_que_se_abre) as el_nuevo
--     from _ensayo e;
--   -- esperado: activos = 1 · el_viejo = cerrado · el_nuevo = activo
-- rollback;

-- 5 · LO QUE ESTA MIGRACIÓN LE PIDE AL DISPOSITIVO DESDE EL QUE SE ACTIVA.
--     La app es una PWA con trabajador de servicio. Un navegador con la versión
--     cacheada de antes del 2026-09-10 seguiría mandando abrir y cerrar como dos
--     escrituras sueltas, y contra este índice la primera falla: la cola reintenta
--     ocho veces, se aparta, y SOLO ENTONCES corre el cerrar — dejando a esa persona
--     con CERO activos. Solo afecta al staff: la `0021` y la propia
--     `activar_microciclo` impiden que un asesorado toque el estado.
--     Se cierra cerrando y abriendo la app en ese dispositivo.
