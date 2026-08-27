-- Dos funciones de carga se quedaron al alcance de la anon key.
--
-- Detectado el 2026-08-27 auditando seguridad. `tmp_cargar_siguiente` y
-- `tmp_nuevo_micro` seguían vivas en producción, y las dos con `execute`
-- concedido a `anon` y a `authenticated`.
--
-- Es literalmente lo que avisa CLAUDE.md:
--
--   «`create function` concede `EXECUTE` a `PUBLIC` por defecto y todo lo de
--    `public` se expone como RPC a `anon`: sin el `revoke`, una función que
--    ESCRIBE microciclos queda al alcance de la anon key.»
--
-- ── Qué NO era, para no dejarlo dicho a medias ───────────────────────────────
--
-- **No era explotable.** Las dos son SECURITY INVOKER: corren con los permisos
-- de quien llama, así que RLS aplica igual. Para `anon`, el `select` interno
-- sobre `usuarios_app` no devuelve nada -su política pide `auth.uid()`- y la
-- función contesta siempre «NO ENCONTRADO». La escritura la para la política de
-- INSERT de `microciclos`.
--
-- Era una mina, no una puerta abierta: a UNA equivocación de RLS de convertirse
-- en puerta. Se limpia igual.
--
-- ── Y el código estaba bien, que es lo que más importa ───────────────────────
--
-- `plantilla-carga-microciclo.sql` trae su `revoke` debajo de cada función
-- (líneas 241 y 368) y un aviso encima que dice «No quites los revoke». Los
-- ficheros `_app-cargar-*.sql` también: los que crean funciones, las revocan
-- —3 de 3 y 2 de 2—.
--
-- Nadie escribió mal nada. Producción se desvió de lo que dicen los ficheros,
-- que es el riesgo del flujo de pegar SQL a mano y que este repo ya tiene
-- escrito en `comprobar-migraciones.sql`:
--
--   «Un pegado truncado no da ningún error.»
--
-- Por eso esta migración no basta. Va con `comprobar-funciones-expuestas.sql`,
-- que convierte «puede volver a pasar» en «se nota si pasa».

begin;

-- ── 1. Cerrar el acceso ──────────────────────────────────────────────────────
-- Primero revocar y después borrar, y no al revés: si el `drop` fallara por lo
-- que sea, el `revoke` ya habría cerrado el acceso. Al revés se quedaría abierto.

revoke execute on function public.tmp_cargar_siguiente(text, text, text, jsonb) from public;
revoke execute on function public.tmp_nuevo_micro(jsonb, int, text, jsonb) from public;

-- ── 2. Borrarlas, que es lo que manda la regla ───────────────────────────────
-- Borrarlas es inocuo: `plantilla-carga-microciclo.sql` las recrea con
-- `create or replace` en cada carga (líneas 180 y 245). No se pierde nada.

drop function if exists public.tmp_cargar_siguiente(text, text, text, jsonb);
drop function if exists public.tmp_nuevo_micro(jsonb, int, text, jsonb);

-- ── 3. Un descuido propio de la 0049 ─────────────────────────────────────────
-- `marcar_actualizado` se creó sin `set search_path`. Es SECURITY INVOKER y solo
-- hace `now()`, así que el riesgo es bajo, pero la 0045 sí lo lleva y no hay
-- motivo para que ésta no.
--
-- Va aquí y no editando la 0049, porque una migración aplicada no se toca.

alter function public.marcar_actualizado() set search_path = public;

commit;

-- ── Comprobación ─────────────────────────────────────────────────────────────
--
-- Las dos primeras deben devolver 0 filas:
--
--   select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname like 'tmp\_%';
--
--   -- y el barrido general, que es el que hay que correr de aquí en adelante:
--   \i supabase/comprobar-funciones-expuestas.sql
--
-- Y que la tercera quedó puesta:
--
--   select proname, proconfig from pg_proc p
--    join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname='public' and p.proname='marcar_actualizado';
--   -- proconfig debe decir {search_path=public}
