-- NNNN · Aviso diario 19:00 Bogotá (00:00 UTC) → Edge Function enviar-aviso-checkin
--
-- Sin tablas nuevas. Reutiliza public.permisos_de_aviso (0063) y public.checkins.
-- La llave de servicio NO se escribe en este archivo: se lee de vault en ejecución.
-- Si falta pg_net o vault, no rompe: avisa y no programa.
--
-- Patrón pg_cron como 0048_ranking_en_cache.sql (preguntar pg_available_extensions, execute).

-- pg_net para http desde cron
do $pgnet$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net';
  else
    raise notice 'pg_net no disponible: el aviso diario no se programará.';
  end if;
end
$pgnet$;

-- Cron 00:00 UTC diario → llama a /functions/v1/enviar-aviso-checkin con service key desde vault
-- Vault key sugerida: supabase_vault secret `service_role_key` con el JWT de service_role.
do $cron_aviso$
declare
  supa_url text;
  tiene_vault boolean;
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron no disponible: sin aviso diario programado.';
    return;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'pg_net no está: sin aviso diario programado.';
    return;
  end if;

  execute 'create extension if not exists pg_cron';

  -- URL del proyecto (vault o app.settings); si no hay, no programar
  select decrypted_secret into supa_url from vault.decrypted_secrets where name = 'supabase_url' limit 1;
  if supa_url is null then
    begin
      supa_url := current_setting('app.settings.supabase_url', true);
    exception when others then supa_url := null;
    end;
  end if;
  if supa_url is null or supa_url = '' then
    raise notice 'Sin supabase_url en vault ni app.settings: sin aviso diario. Guarda el secreto supabase_url en vault.';
    return;
  end if;

  -- ¿hay service key en vault?
  select exists (select 1 from vault.decrypted_secrets where name = 'service_role_key') into tiene_vault;
  if not tiene_vault then
    raise notice 'Sin service_role_key en vault: sin aviso diario. Guarda el secreto service_role_key en vault.';
    return;
  end if;

  perform cron.unschedule('aviso-checkin-diario') where exists (select 1 from cron.job where jobname = 'aviso-checkin-diario');

  execute format($q$
    select cron.schedule(
      'aviso-checkin-diario',
      '0 0 * * *',
      %L
    )
  $q$, format(
    $$select net.http_post(
        url:=%L || '/functions/v1/enviar-aviso-checkin',
        headers:=jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key' limit 1)
        ),
        body:='{}'::jsonb
      )$$,
    supa_url
  ));

  raise notice 'Aviso diario programado 00:00 UTC (19:00 Bogotá).';
end
$cron_aviso$;
