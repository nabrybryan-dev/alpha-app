-- Comprobaciones de la 0116 (puente del laboratorio). SOLO LEE. Pegar en el SQL Editor DESPUES de aplicar.
-- Cada fila de la primera consulta tiene que decir SI. Solo cuenta filas: no muestra contenido de nadie.
select '0116 - esquema lab no abierto a anon/authenticated' as senal,
       case when has_schema_privilege('anon', 'lab', 'usage') or has_schema_privilege('authenticated', 'lab', 'usage') then 'NO' else 'SI' end as ok
union all
select '0116 - lab_lector sin SELECT en tablas base ni en consentimientos',
       case when has_table_privilege('lab_lector', 'public.microciclos', 'select')
              or has_table_privilege('lab_lector', 'public.perfiles', 'select')
              or has_table_privilege('lab_lector', 'public.usuarios_app', 'select')
              or has_table_privilege('lab_lector', 'public.checkins', 'select')
              or has_table_privilege('lab_lector', 'public.mensajes', 'select')
              or has_table_privilege('lab_lector', 'lab.consentimientos', 'select') then 'NO' else 'SI' end
union all
select '0116 - lab_lector con SELECT solo en las tres vistas',
       case when (select count(*) from information_schema.role_table_grants
                   where grantee = 'lab_lector' and privilege_type = 'SELECT' and table_schema = 'lab') = 3
             and not exists (select 1 from information_schema.role_table_grants
                              where grantee = 'lab_lector' and (table_schema <> 'lab' or privilege_type <> 'SELECT'))
            then 'SI' else 'NO' end
union all
select '0116 - lab_lector sin bypassrls ni superusuario',
       case when (select rolbypassrls or rolsuper from pg_roles where rolname = 'lab_lector') then 'NO' else 'SI' end
union all
select '0116 - consentimientos con RLS activada',
       case when (select relrowsecurity from pg_class where oid = 'lab.consentimientos'::regclass) then 'SI' else 'NO' end
union all
-- Informativa: SI = aun no puede entrar (antes del paso de la contrasena); NO = ya puede entrar (esperado despues).
select '0116 - (informativa) lab_lector sin login todavia',
       case when (select rolcanlogin from pg_roles where rolname = 'lab_lector') then 'NO' else 'SI' end;

-- Funciones de public que lab_lector podria ejecutar (deberia salir VACIO; si sale alguna, revocarla de public):
select p.oid::regprocedure as funcion_ejecutable_por_lab_lector
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and has_function_privilege('lab_lector', p.oid, 'execute');

-- Cuantos consentimientos vigentes y revocados (solo cifras):
select count(*) filter (where revocado_en is null) as vigentes, count(*) filter (where revocado_en is not null) as revocados
  from lab.consentimientos;
