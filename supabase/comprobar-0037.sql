-- Comprobación de la migración 0037 (escrituras quirúrgicas de microciclo).
-- Las tres consultas tienen que devolver CERO filas.

-- 1 · Las tres funciones existen.
select '1 · falta una función' as señal, f.nombre
from (values ('fijar_series_ejercicio'), ('fijar_test_post'), ('fijar_preparacion_sesion')) as f(nombre)
where not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = f.nombre
);

-- 2 · Ninguna es `security definer`. Si lo fuera se saltaría la RLS y cualquier
--     asesorado podría escribir en el microciclo de otro llamando a la función.
select '2 · función con security definer' as señal, p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('fijar_series_ejercicio', 'fijar_test_post', 'fijar_preparacion_sesion')
  and p.prosecdef;

-- 3 · `anon` no puede ejecutarlas. `create function` concede EXECUTE a PUBLIC, y
--     todo lo de `public` se expone como RPC: sin el revoke, una función que
--     ESCRIBE microciclos queda al alcance de la anon key.
select '3 · anon puede ejecutarla' as señal, p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('fijar_series_ejercicio', 'fijar_test_post', 'fijar_preparacion_sesion')
  and has_function_privilege('anon', p.oid, 'EXECUTE');
