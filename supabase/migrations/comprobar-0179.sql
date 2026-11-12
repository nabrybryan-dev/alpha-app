-- Comprobación de la 0179 (organización de la app por persona). Solo lee. Se corre DESPUÉS de aplicar la migración.
-- Todas las filas deben decir 'SI'.
select 'tablas creadas' as senal, case when to_regclass('public.praxis_organizacion') is not null and to_regclass('public.praxis_organizacion_cambios') is not null then 'SI' else 'NO' end as ok
union all
select 'RLS encendida', case when (select bool_and(relrowsecurity) from pg_class where oid in (to_regclass('public.praxis_organizacion'),to_regclass('public.praxis_organizacion_cambios'))) then 'SI' else 'NO' end
union all
select 'nadie escribe directo', case when not exists (select 1 from unnest(array['public.praxis_organizacion','public.praxis_organizacion_cambios']) t
  where has_table_privilege('authenticated',t,'INSERT,UPDATE,DELETE,TRUNCATE') or has_table_privilege('anon',t,'SELECT,INSERT,UPDATE,DELETE')) then 'SI' else 'NO' end
union all
select 'anon no ejecuta', case when not has_function_privilege('anon','public.praxis_organizacion_aplicar(jsonb,integer)','execute')
  and not has_function_privilege('anon','public.praxis_organizacion_deshacer()','execute') then 'SI' else 'NO' end
union all
select 'listas del catalogo', case when public.praxis_organizacion_es_ocultable('progreso.medidas') and not public.praxis_organizacion_es_ocultable('hoy.sesion')
  and public.praxis_organizacion_esconde_peso('progreso.medidas') and not public.praxis_organizacion_es_organizable('pantalla:/') then 'SI' else 'NO' end
union all
select 'tablas vacias al nacer', case when (select count(*) from public.praxis_organizacion) = 0 and (select count(*) from public.praxis_organizacion_cambios) = 0 then 'SI' else 'NO' end;
