-- Ninguna función de `public` sin `search_path` fijo (0111).
--
-- POR QUÉ ESTA PRUEBA EXISTE. El asesor de seguridad de Supabase lleva desde el 30-sep marcando
-- funciones con «function_search_path_mutable»: sin `set search_path`, la función resuelve los
-- nombres con la ruta de QUIEN LA LLAMA, y alguien que pueda crear objetos en un esquema que vaya
-- antes en esa ruta puede suplantar una tabla o una función. Las `security definer` del repo ya
-- llevaban la ruta fija (regla de `GUIA-BRYAN.md` §10); quedaban siete `security invoker`.
--
-- La prueba no lista nombres: exige que NINGUNA función de `public` (salvo las de extensiones)
-- quede sin ruta, así que también caza la próxima que alguien escriba sin ella.

\set ON_ERROR_STOP on

begin;

select pruebas.afirmar(
  not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind in ('f', 'p')
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  ),
  'hay funciones de public sin search_path fijo: ' || coalesce((
    select string_agg(p.proname, ', ' order by p.proname)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind in ('f', 'p')
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  ), '')
);

\echo 'OK · ninguna función de public sin search_path fijo (0111)'

rollback;
