-- ============================================================================
-- 0171 · Latidos de la cadena: la nube se entera cuando el ASUS deja de dar señales
-- ============================================================================
--
-- Va después de la 0168 (cadena_agentes_sin_cli). NO se aplica sola.
--
-- POR QUÉ. Si el ASUS se apaga, se duerme o pierde la red, el n8n deja de correr y nadie lo
-- nota hasta que falta un plan. El ASUS no puede avisar de su propia caída; la nube sí, si el
-- ASUS le manda un latido y la nube vigila que siga llegando.
--
-- CÓMO.
--   · El n8n del ASUS llama cada 5 min a la función `cadena-agentes` con
--     { accion: "latido", origen: "asus-n8n" } -> cadena_latido() guarda la hora.
--   · pg_cron, cada 10 min, llama a `cadena-agentes` con { accion: "vigilar_latidos" }
--     (cadena_pedir_vigilancia(), con la clave guardada en Vault como `cadena_agentes_clave`).
--     La función pregunta cadena_latidos_por_avisar(30): orígenes con más de 30 min sin latido
--     que aún no se avisaron como caídos, y los que volvieron. Por cada uno manda UN Telegram
--     (los secretos TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID de las funciones, los mismos que usa
--     `responder-chat`) y, solo si salió, lo marca con cadena_latido_avisado(). Si Telegram
--     falla, no se marca y se reintenta a los 10 min: un aviso por caída y otro al volver.
--   · Un origen que nunca latió no avisa: hasta que se instale el nodo, nada suena.
--
-- SIN DATOS DE NADIE. La tabla guarda el nombre del origen, la hora y un `detalle` pequeño que
-- manda el propio n8n (versión, nombre del flujo). Nada de asesorados.
--
-- PERMISOS. Tabla con RLS y sin políticas: solo service_role. Las funciones, SECURITY DEFINER
-- con search_path fijo, solo service_role (la función cadena-agentes y el cron).
--
-- ANTES DEL CRON (Bryan, una vez): guardar en Vault la misma clave que ALPHA_CADENA_SECRET:
--   select vault.create_secret('<ALPHA_CADENA_SECRET>', 'cadena_agentes_clave');
-- Sin ella, cadena_pedir_vigilancia() no llama a nada y lo dice con un NOTICE.
--
-- Reversa: select cron.unschedule('vigilar-latidos-cadena'); drop function de las cinco;
-- drop table public.latidos_cadena.

begin;

create table if not exists public.latidos_cadena (
  origen text primary key check (origen ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  visto_en timestamptz not null default clock_timestamp(),
  detalle jsonb not null default '{}'::jsonb check (jsonb_typeof(detalle) = 'object' and pg_column_size(detalle) <= 4096),
  -- Lo último que se avisó por Telegram: 'vivo' (nada pendiente) o 'caido'.
  estado_avisado text not null default 'vivo' check (estado_avisado in ('vivo', 'caido')),
  avisado_en timestamptz
);

alter table public.latidos_cadena enable row level security;
revoke all on public.latidos_cadena from public, anon, authenticated;
grant select on public.latidos_cadena to service_role;

comment on table public.latidos_cadena is
  'Último latido de cada pieza de la cadena (asus-n8n). Lo escribe cadena_latido(); lo vigila el cron vigilar-latidos-cadena (0171).';

-- El latido. Un origen nuevo entra solo; uno conocido actualiza la hora y el detalle.
create or replace function public.cadena_latido(p_origen text, p_detalle jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visto timestamptz := clock_timestamp();
begin
  if p_origen is null or p_origen !~ '^[a-z0-9][a-z0-9-]{1,39}$' then
    raise exception 'cadena_latido: origen inválido' using errcode = '22023';
  end if;
  insert into public.latidos_cadena (origen, visto_en, detalle)
  values (p_origen, v_visto, coalesce(p_detalle, '{}'::jsonb))
  on conflict (origen) do update set visto_en = excluded.visto_en, detalle = excluded.detalle;
  return jsonb_build_object('origen', p_origen, 'visto_en', v_visto);
end;
$$;

-- Lo que hay que avisar AHORA: caídos sin avisar y vueltos tras un aviso de caída.
create or replace function public.cadena_latidos_por_avisar(p_minutos integer default 30)
returns table (origen text, cambio text, visto_en timestamptz, minutos integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.origen,
         case when l.estado_avisado = 'vivo' then 'caido' else 'volvio' end,
         l.visto_en,
         floor(extract(epoch from (clock_timestamp() - l.visto_en)) / 60)::integer
    from public.latidos_cadena l
   where (l.estado_avisado = 'vivo'  and l.visto_en <  clock_timestamp() - make_interval(mins => greatest(p_minutos, 1)))
      or (l.estado_avisado = 'caido' and l.visto_en >= clock_timestamp() - make_interval(mins => greatest(p_minutos, 1)))
   order by l.origen;
$$;

-- Se llama SOLO después de que el Telegram salió.
create or replace function public.cadena_latido_avisado(p_origen text, p_estado text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_estado not in ('vivo', 'caido') then
    raise exception 'cadena_latido_avisado: estado inválido' using errcode = '22023';
  end if;
  update public.latidos_cadena set estado_avisado = p_estado, avisado_en = clock_timestamp() where origen = p_origen;
  if not found then
    raise exception 'cadena_latido_avisado: origen desconocido' using errcode = 'P0002';
  end if;
  return jsonb_build_object('origen', p_origen, 'estado_avisado', p_estado);
end;
$$;

-- Lo que corre el cron: pide a cadena-agentes que vigile. La clave sale de Vault; sin ella, nada.
create or replace function public.cadena_pedir_vigilancia()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clave text;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    raise notice 'cadena_pedir_vigilancia: falta Vault o pg_net; no se vigila';
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_clave using 'cadena_agentes_clave';
  if v_clave is null or v_clave = '' then
    raise notice 'cadena_pedir_vigilancia: falta el secreto cadena_agentes_clave en Vault; no se vigila';
    return null;
  end if;
  return net.http_post(
    url := 'https://sbzmbiwrnvegrticatza.supabase.co/functions/v1/cadena-agentes',
    headers := jsonb_build_object('content-type', 'application/json', 'x-alpha-clave', v_clave),
    body := jsonb_build_object('accion', 'vigilar_latidos'),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.cadena_latido(text, jsonb) from public, anon, authenticated;
revoke all on function public.cadena_latidos_por_avisar(integer) from public, anon, authenticated;
revoke all on function public.cadena_latido_avisado(text, text) from public, anon, authenticated;
revoke all on function public.cadena_pedir_vigilancia() from public, anon, authenticated;
grant execute on function public.cadena_latido(text, jsonb) to service_role;
grant execute on function public.cadena_latidos_por_avisar(integer) to service_role;
grant execute on function public.cadena_latido_avisado(text, text) to service_role;
grant execute on function public.cadena_pedir_vigilancia() to service_role;

-- ── El cron, con la misma cautela que la 0166: sin pg_cron no se programa nada ──────────
do $cron_setup$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    if exists (select 1 from cron.job where jobname = 'vigilar-latidos-cadena') then
      perform cron.unschedule('vigilar-latidos-cadena');
    end if;
    perform cron.schedule('vigilar-latidos-cadena', '*/10 * * * *', 'select public.cadena_pedir_vigilancia();');
    raise notice 'Vigilancia de latidos programada cada 10 min.';
  else
    raise notice 'pg_cron no esta disponible aqui: los latidos no se vigilan solos.';
  end if;
end
$cron_setup$;

commit;
