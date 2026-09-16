-- Solo lectura. Ejecutar contra Alpha antes de decidir la activación de 0081.
-- No devuelve nombres, guiones, archivos ni datos personales.
select
  to_regclass('public.videos_semanales') is not null as tabla_existe,
  to_regprocedure('public.decidir_revision_semanal(uuid,date,integer,boolean,text)') is not null as rpc_existe,
  exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'videos_semanales' and column_name = 'version') as version_existe,
  exists (select 1 from pg_trigger where tgname = 'versionar_revision_semanal'
    and tgrelid = to_regclass('public.videos_semanales') and not tgisinternal) as trigger_existe;

select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
  where (schemaname = 'public' and tablename = 'videos_semanales')
     or (schemaname = 'storage' and tablename = 'objects' and policyname like 'medios:%')
  order by schemaname, tablename, policyname;
