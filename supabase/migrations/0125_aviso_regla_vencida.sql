-- R9: vencerse la fecha de revisión genera aviso, pero no modifica ni relaja la regla firmada.
begin;

alter table public.alertas_coach drop constraint if exists alertas_coach_tipo_check;
alter table public.alertas_coach add constraint alertas_coach_tipo_check
  check (tipo in ('no_programar', 'parada_cardiaca', 'parada_paso3', 'bloqueado_paso4',
                  'tachado', 'agotado', 'pausada', 'orden_detener', 'propuesta_zona',
                  'registro_faltante', 'piso_agudo', 'sin_plan_semana_entrante', 'regla_vencida'));

create unique index alertas_coach_regla_vencida_semana_unica
  on public.alertas_coach(usuario_id, semana_inicio)
  where tipo = 'regla_vencida';

create function public.generar_alertas_reglas_vencidas(p_fecha_corte date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insertadas integer;
  v_semana_inicio date;
begin
  if p_fecha_corte is null then
    raise exception 'la fecha de corte no puede ser nula' using errcode = '22023';
  end if;
  v_semana_inicio := date_trunc('week', p_fecha_corte)::date;

  insert into public.alertas_coach(
    usuario_id, semana_inicio, tipo, exige_firma, razon, propuesta, acciones_permitidas
  )
  select c.usuario_id, v_semana_inicio, 'regla_vencida', true,
         'Regla vencida: ¿sigue vigente?',
         'La regla continúa aplicándose hasta que el coach la revise y la actualice con firma.',
         array['mantener_y_preguntar']::text[]
    from public.contexto_clinico_firmado c
   where c.revisar_antes_de < p_fecha_corte
  on conflict (usuario_id, semana_inicio)
    where tipo = 'regla_vencida'
    do nothing;

  get diagnostics v_insertadas = row_count;
  return v_insertadas;
end;
$$;

revoke all on function public.generar_alertas_reglas_vencidas(date) from public, anon, authenticated;
grant execute on function public.generar_alertas_reglas_vencidas(date) to service_role;

comment on function public.generar_alertas_reglas_vencidas(date) is
  'R9: crea un aviso semanal para fechas de revisión pasadas. No modifica revisar_antes_de ni el contexto firmado.';

commit;
