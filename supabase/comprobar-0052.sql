-- Comprobación de 0052. Cuatro señales; las cuatro tienen que decir OK.
--
-- Se corre CONTRA LA BASE después de aplicar la migración. No prueba que la
-- función haga lo suyo —eso lo prueban las baterías del cliente— sino que existe
-- con los permisos correctos, que es lo que no se puede saber leyendo el código.

-- 1 · Existe y no es `security definer` (si lo fuera se saltaría la RLS).
select 'senal 1' as senal,
       case when count(*) = 1 then 'OK' else 'FALLO: ' || count(*) || ' definiciones' end as veredicto
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'fijar_fecha_sesion' and p.prosecdef = false;

-- 2 · `anon` NO la puede ejecutar.
select 'senal 2' as senal,
       case when has_function_privilege('anon', 'public.fijar_fecha_sesion(text,text,text)', 'execute')
            then 'FALLO: anon puede ejecutarla' else 'OK' end as veredicto;

-- 3 · `authenticated` SÍ la puede ejecutar.
select 'senal 3' as senal,
       case when has_function_privilege('authenticated', 'public.fijar_fecha_sesion(text,text,text)', 'execute')
            then 'OK' else 'FALLO: authenticated no puede ejecutarla' end as veredicto;

-- 4 · Cuántas sesiones llevan ya fecha. Nace en 0 y sube solo desde la app; si
--     sube sin que nadie entrene, es que algo la esta escribiendo de mas.
select 'senal 4' as senal,
       'sesiones con fecha: ' || count(*) filter (where s ? 'fecha') || ' de ' || count(*) as veredicto
  from public.microciclos m, jsonb_array_elements(m.datos -> 'sesiones') s;
