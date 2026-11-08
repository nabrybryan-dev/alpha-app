-- R7: lista propuesta pendiente de firma; el interruptor de produccion nace apagado.
-- Las alertas usan el bloqueo visible y anulable de 0116; no guardan texto clinico.
begin;

create table public.piso_agudo_r7 (
  singleton boolean primary key default true check (singleton),
  senales_propuestas text[] not null,
  estado_firma text not null default 'pendiente_firma'
    check (estado_firma in ('pendiente_firma','firmada')),
  interruptor_activo boolean not null default false,
  bryan_firmado_por uuid references public.usuarios_app(id),
  bryan_firmado_en timestamptz,
  manuela_firmado_por uuid references public.usuarios_app(id),
  manuela_firmado_en timestamptz,
  constraint piso_agudo_r7_firmas_coherentes check (
    (estado_firma = 'pendiente_firma' and bryan_firmado_por is null and bryan_firmado_en is null
      and manuela_firmado_por is null and manuela_firmado_en is null and not interruptor_activo)
    or (estado_firma = 'firmada' and bryan_firmado_por is not null and bryan_firmado_en is not null
      and manuela_firmado_por is not null and manuela_firmado_en is not null
      and bryan_firmado_por <> manuela_firmado_por)
  ),
  constraint piso_agudo_r7_switch_firmado check (not interruptor_activo or estado_firma = 'firmada')
);

comment on table public.piso_agudo_r7 is
  'R7: catalogo propuesto pendiente de firmas de Bryan y Manuela. El interruptor no se activa antes de ambas firmas.';

insert into public.piso_agudo_r7(singleton, senales_propuestas)
values (true, array[
  'sincope_presincope_nuevo',
  'dolor_toracico_actual_o_esfuerzo_reciente',
  'embarazo_sin_ajuste_del_plan',
  'lesion_aguda_con_perdida_de_funcion',
  'riesgo_vida_o_integridad'
])
on conflict (singleton) do nothing;

alter table public.piso_agudo_r7 enable row level security;
revoke all on public.piso_agudo_r7 from public, anon, authenticated;
grant select, insert, update on public.piso_agudo_r7 to service_role;

create function public.registrar_senal_aguda_r7(
  p_usuario_id uuid,
  p_semana_inicio date,
  p_codigo text,
  p_actual boolean,
  p_evento_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config public.piso_agudo_r7;
  v_alerta_id uuid;
begin
  if p_semana_inicio is null or extract(isodow from p_semana_inicio) <> 1 then
    raise exception 'la semana de la prescripcion debe empezar lunes' using errcode = '22023';
  end if;
  if p_usuario_id is null or p_actual is distinct from true or p_codigo is null then
    return null;
  end if;

  select * into v_config from public.piso_agudo_r7 where singleton for share;
  if not found or not v_config.interruptor_activo or v_config.estado_firma <> 'firmada'
     or not (p_codigo = any(v_config.senales_propuestas)) then
    return null;
  end if;

  -- La alerta identifica solo a la persona y semana de su microciclo; nunca copia el relato.
  if not exists (
    select 1 from public.microciclos m
     where m.usuario_id = p_usuario_id and m.estado = 'activo'
       and coalesce(m.datos->>'fechaInicio', '') ~ '^\d{4}-\d{2}-\d{2}$'
       and coalesce(m.datos->>'cadenciaDias', '') ~ '^[1-9][0-9]{0,2}$'
       and (m.datos->>'fechaInicio')::date < p_semana_inicio + 7
       and (m.datos->>'fechaInicio')::date + (m.datos->>'cadenciaDias')::integer > p_semana_inicio
  ) then
    return null;
  end if;

  insert into public.alertas_coach(
    usuario_id, semana_inicio, evento_id, tipo, nivel, exige_firma, razon, propuesta, acciones_permitidas
  ) values (
    p_usuario_id, p_semana_inicio, p_evento_id, 'piso_agudo', 'agudo', false,
    p_codigo, null, array['mantener_y_preguntar','mantener_y_derivar']::text[]
  )
  on conflict (usuario_id, semana_inicio, tipo,
    (coalesce(evento_id, '00000000-0000-0000-0000-000000000000'::uuid)))
    where atendida_en is null do nothing
  returning id into v_alerta_id;

  if v_alerta_id is null then
    select a.id into v_alerta_id from public.alertas_coach a
     where a.usuario_id = p_usuario_id and a.semana_inicio = p_semana_inicio
       and a.tipo = 'piso_agudo' and a.atendida_en is null
       and a.evento_id is not distinct from p_evento_id;
  end if;
  return v_alerta_id;
end;
$$;

revoke all on function public.registrar_senal_aguda_r7(uuid,date,text,boolean,uuid) from public, anon, authenticated;
grant execute on function public.registrar_senal_aguda_r7(uuid,date,text,boolean,uuid) to service_role;

comment on function public.registrar_senal_aguda_r7(uuid,date,text,boolean,uuid) is
  'R7: con lista firmada y switch activo, crea alerta aguda 0116 para la persona/semana; solo señales actuales y sin relato clínico.';

commit;
