-- 0177 · Nadie con sesión (ni anon) puede vaciar una tabla entera, y la tabla vieja
-- `aprobaciones` no se escribe desde el navegador.
--
-- POR QUÉ. La consulta de señales del 9-nov-2026 contra la base real (solo lectura) dio NO en
-- «0083 · aprobaciones solo las escribe el servidor»: `authenticated` conservaba insert, update,
-- delete y truncate sobre `public.aprobaciones`. Mirando el resto, 39 tablas de public le daban
-- TRUNCATE a anon o a authenticated. Es lo que Supabase da por defecto al crear una tabla
-- (`alter default privileges ... grant all`), y ninguna migración lo quitaba.
--
-- QUÉ RIESGO CIERRA. RLS no frena TRUNCATE: quien tenga ese privilegio vacía la tabla entera sin
-- pasar por ninguna política. Hoy la API REST no expone TRUNCATE, así que no se conoce una vía
-- para usarlo desde el navegador; esto es defensa en profundidad, no un hueco explotado. En
-- `aprobaciones` la escritura por la API ya la frenaba RLS (solo hay política de lectura) y la
-- tabla está vacía: se quita igual, porque el privilegio no debe depender de que nadie añada
-- una política.
--
-- QUÉ CAMBIA.
--   1 · `aprobaciones`: anon y authenticated pierden insert, update, delete y truncate.
--       Siguen leyendo lo que su política de lectura deja.
--   2 · TRUNCATE fuera para anon y authenticated en TODAS las tablas, vistas y particiones de
--       public. Ningún otro privilegio cambia (la prueba 273 lo comprueba).
--   3 · Las tablas que cree postgres en public a partir de ahora ya no dan TRUNCATE a anon ni a
--       authenticated (permisos por defecto). Los permisos por defecto de supabase_admin no se
--       tocan desde aquí (no se puede actuar en su nombre).
--
-- QUÉ NO CAMBIA. service_role no se toca. Las funciones security definer que vacían una tabla
-- (hay una en public) corren como su dueño y no dependen de estos privilegios. Ningún código de
-- la app, de las funciones de borde ni de los guiones usa TRUNCATE ni escribe en `aprobaciones`
-- (búsqueda del 9-nov en src, supabase/functions y scripts).
--
-- NO APLICADA. Escrita el 9-nov-2026 (orden de Bryan: «Escribir la migración»); aplicarla en la
-- base real pide otra orden escrita.

do $$
begin
  if to_regclass('public.aprobaciones') is not null then
    revoke insert, update, delete, truncate on table public.aprobaciones from anon, authenticated;
  end if;
end
$$;

do $$
declare
  r record;
begin
  for r in
    select c.oid::regclass as tabla
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    execute format('revoke truncate on table %s from anon, authenticated', r.tabla);
  end loop;
end
$$;

alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;

-- DESHACER (solo si algo legítimo dependiera de TRUNCATE con sesión; no se conoce nada):
--   alter default privileges for role postgres in schema public grant truncate on tables to anon, authenticated;
--   y un grant truncate por tabla. Los privilegios de `aprobaciones` no deberían volver.
