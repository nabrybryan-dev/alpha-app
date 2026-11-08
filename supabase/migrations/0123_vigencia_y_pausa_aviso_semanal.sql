-- D-14-14: activo = microciclo vigente en la semana actual o anterior y sin pausa.
-- pago_vigente_hasta queda propuesto, sin escritor confiable; no habilita avisos.
begin;

alter table public.usuarios_app
  add column if not exists pago_vigente_hasta date,
  add column if not exists pausa_activa boolean not null default false;

comment on column public.usuarios_app.pago_vigente_hasta is
  'Campo propuesto para vigencia de pago; pendiente definir escritor confiable. No se usa para decidir avisos.';
comment on column public.usuarios_app.pausa_activa is
  'Exclusion operativa explicita de avisos semanales mientras la cuenta esta en pausa.';

drop function if exists public.generar_alerta_sin_plan_semana_entrante(date);

create or replace function public.generar_alerta_sin_plan_semana_entrante(
  p_semana_inicio date default date_trunc('week', current_date)::date,
  p_fecha_corte date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insertadas integer;
  v_semana_actual_inicio date;
begin
  if p_semana_inicio is null or extract(isodow from p_semana_inicio) <> 1 then
    raise exception 'la semana objetivo debe empezar lunes' using errcode = '22023';
  end if;
  if p_fecha_corte is null then
    raise exception 'la fecha de corte no puede ser nula' using errcode = '22023';
  end if;
  v_semana_actual_inicio := date_trunc('week', p_fecha_corte)::date;

  -- La cuenta es activa si tiene microciclo activo que toca esta semana o la anterior.
  insert into public.alertas_coach(
    usuario_id, semana_inicio, tipo, razon, acciones_permitidas
  )
  select u.id, p_semana_inicio, 'sin_plan_semana_entrante',
         'sin_plan_semana_entrante', array['mantener_y_preguntar']::text[]
    from public.usuarios_app u
   where u.rol = 'asesorado'
     and not u.pausa_activa
     and exists (
         select 1
           from public.microciclos vigente
          where vigente.usuario_id = u.id
            and vigente.estado = 'activo'
            and coalesce(vigente.datos->>'fechaInicio', '') ~ '^\d{4}-\d{2}-\d{2}$'
            and coalesce(vigente.datos->>'cadenciaDias', '') ~ '^[1-9][0-9]{0,2}$'
            and (vigente.datos->>'fechaInicio')::date < v_semana_actual_inicio + 7
            and (vigente.datos->>'fechaInicio')::date + (vigente.datos->>'cadenciaDias')::integer > v_semana_actual_inicio - 7
       )
     and not exists (
       select 1
         from public.microciclos siguiente
        where siguiente.usuario_id = u.id
          and siguiente.estado = 'activo'
          and coalesce(siguiente.datos->>'fechaInicio', '') ~ '^\d{4}-\d{2}-\d{2}$'
          and coalesce(siguiente.datos->>'cadenciaDias', '') ~ '^[1-9][0-9]{0,2}$'
          and (siguiente.datos->>'fechaInicio')::date < p_semana_inicio + 7
          and (siguiente.datos->>'fechaInicio')::date + (siguiente.datos->>'cadenciaDias')::integer > p_semana_inicio
     )
  on conflict (usuario_id, semana_inicio)
    where tipo = 'sin_plan_semana_entrante'
    do nothing;

  get diagnostics v_insertadas = row_count;
  return v_insertadas;
end;
$$;

revoke all on function public.generar_alerta_sin_plan_semana_entrante(date, date) from public, anon, authenticated;
grant execute on function public.generar_alerta_sin_plan_semana_entrante(date, date) to service_role;

comment on function public.generar_alerta_sin_plan_semana_entrante(date, date) is
  'D-14-14: requiere microciclo activo que toque semana actual/anterior al corte, sin pausa y sin plan para la semana objetivo. La vigencia de pago queda pendiente de escritor confiable.';

commit;
