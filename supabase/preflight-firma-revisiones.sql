-- Solo lectura. Ejecutar contra Alpha antes de decidir la activación de 0081.
-- No devuelve nombres, guiones, archivos ni datos personales.
select
  to_regclass('public.videos_semanales') is not null as tabla_existe,
  to_regprocedure('public.decidir_revision_semanal(uuid,date,integer,boolean,text)') is not null as rpc_existe,
  exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'videos_semanales' and column_name = 'version') as version_existe,
  exists (select 1 from pg_trigger where tgname = 'versionar_revision_semanal'
    and tgrelid = to_regclass('public.videos_semanales') and not tgisinternal) as trigger_existe,
  (select jsonb_agg(jsonb_build_object('nombre', column_name, 'tipo', data_type))
    from information_schema.columns where table_schema = 'public'
      and table_name = 'videos_semanales') as columnas,
  (select count(*) from public.videos_semanales) as revisiones_totales,
  (select count(*) from public.videos_semanales where aprobado_en is not null) as revisiones_firmadas,
  (select count(*) from public.videos_semanales where path !~ '^personas/[^/]+/[0-9-]+/[0-9a-f-]{36}\.[a-z0-9]+$') as rutas_historicas,
  to_regclass('supabase_migrations.schema_migrations') is not null as historial_existe,
  (select jsonb_agg(m) from (select version, name from supabase_migrations.schema_migrations
    order by version desc limit 12) m) as ultimas_migraciones,
  (select jsonb_agg(jsonb_build_object('nombre', tgname, 'definicion', pg_get_triggerdef(oid)))
    from pg_trigger where tgrelid = to_regclass('public.videos_semanales') and not tgisinternal) as triggers,
  (select jsonb_agg(p) from (
    select tablename, policyname, cmd, roles, qual, with_check
      from pg_policies
      where (schemaname = 'public' and tablename = 'videos_semanales')
        or (schemaname = 'storage' and tablename = 'objects' and policyname like 'medios:%')
      order by schemaname, tablename, policyname
  ) p) as politicas;
