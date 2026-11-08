-- R2: una alerta sintetica y repetible por persona sin plan para la semana objetivo.
-- Propuesta; no aplicada. La tabla base alertas_coach viene de 0116.
begin;

alter table public.alertas_coach drop constraint if exists alertas_coach_tipo_check;
alter table public.alertas_coach add constraint alertas_coach_tipo_check
  check (tipo in ('no_programar', 'parada_cardiaca', 'parada_paso3', 'bloqueado_paso4',
                  'tachado', 'agotado', 'pausada', 'orden_detener', 'propuesta_zona',
                  'registro_faltante', 'piso_agudo', 'sin_plan_semana_entrante'));

create unique index if not exists alertas_coach_sin_plan_semana_unica
  on public.alertas_coach(usuario_id, semana_inicio)
  where tipo = 'sin_plan_semana_entrante';

create or replace function public.generar_alerta_sin_plan_semana_entrante(
  p_semana_inicio date default date_trunc('week', current_date)::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insertadas integer;
begin
  if p_semana_inicio is null or extract(isodow from p_semana_inicio) <> 1 then
    raise exception 'la semana objetivo debe empezar lunes' using errcode = '22023';
  end if;

  -- Decision propia y provisional: usuarios_app no tiene bandera de baja, asi que las filas asesorado existentes son activas;
  -- microciclos.datos.fechaInicio/cadenciaDias define la vigencia (la app la cierra al vencer).
  insert into public.alertas_coach(
    usuario_id, semana_inicio, tipo, razon, acciones_permitidas
  )
  select u.id, p_semana_inicio, 'sin_plan_semana_entrante',
         'sin_plan_semana_entrante', array['mantener_y_preguntar']::text[]
    from public.usuarios_app u
   where u.rol = 'asesorado'
     and not exists (
       select 1
         from public.microciclos m
        where m.usuario_id = u.id
          and m.estado = 'activo'
          and coalesce(m.datos->>'fechaInicio', '') ~ '^\d{4}-\d{2}-\d{2}$'
          and coalesce(m.datos->>'cadenciaDias', '') ~ '^[1-9][0-9]{0,2}$'
          and (m.datos->>'fechaInicio')::date < p_semana_inicio + 7
          and (m.datos->>'fechaInicio')::date + (m.datos->>'cadenciaDias')::integer > p_semana_inicio
     )
  on conflict (usuario_id, semana_inicio)
    where tipo = 'sin_plan_semana_entrante'
    do nothing;

  get diagnostics v_insertadas = row_count;
  return v_insertadas;
end;
$$;

revoke all on function public.generar_alerta_sin_plan_semana_entrante(date) from public, anon, authenticated;
grant execute on function public.generar_alerta_sin_plan_semana_entrante(date) to service_role;

comment on function public.generar_alerta_sin_plan_semana_entrante(date) is
  'R2: alerta sin contenido personal para cada asesorado sin microciclo activo que cubra el lunes objetivo. Idempotente por persona y semana; ejecutar los lunes desde cron/cola.';

do $cron_r2$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $q$
      select cron.schedule(
        'alerta-sin-plan-semana-entrante',
        '0 8 * * 1',
        'select public.generar_alerta_sin_plan_semana_entrante();'
      )
    $q$;
  else
    raise notice 'pg_cron no esta disponible: llamar generar_alerta_sin_plan_semana_entrante() desde la cola cada lunes.';
  end if;
end;
$cron_r2$;

commit;
