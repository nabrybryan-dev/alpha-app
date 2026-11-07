-- 0138 · PROPUESTA (NO APLICADA, I-16): endurece la guarda de 0135. HALLAZGO (prueba 246, TRG-2): el trigger de 0135 confiaba en la variable `alpha.activando`,
-- que cualquier actor fija con set_config() en su propia transaccion; un coach que la fijaba y hacia UPDATE ... estado='activo' saltaba la liberacion.
-- Ahora la autorizacion es una FILA que solo escribe `autorizar_activacion` (SECURITY DEFINER, con las mismas guardas), ligada a la transaccion (txid_current()).
-- Debe aplicarse JUNTO con 0135 (0135 queda tal cual para no invalidar sus recibos). Reversa: restaurar los cuerpos de 0135 y borrar la tabla/funcion.
begin;

create table public.activaciones_autorizadas (
  propuesta_id text not null,
  xid bigint not null default txid_current(),
  autorizada_por uuid not null,
  creada_en timestamptz not null default clock_timestamp(),
  primary key (propuesta_id, xid)
);
alter table public.activaciones_autorizadas enable row level security;
revoke all on public.activaciones_autorizadas from public, anon, authenticated, service_role;
-- El trigger corre con el rol del que escribe y solo necesita LEER su propia transaccion; nadie escribe salvo la funcion definer.
grant select on public.activaciones_autorizadas to authenticated, service_role;  -- H8 (C6): anon no activa nada, no necesita leerla
create policy activaciones_autorizadas_propia on public.activaciones_autorizadas
  for select to authenticated, service_role using (xid = txid_current());

create function public.autorizar_activacion(p_propuesta_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_estado text;
begin
  if auth.uid() is null then
    raise exception 'activar_microciclo: se requiere sesion' using errcode = '42501';
  end if;
  if not public.es_staff() then
    raise exception 'activar_microciclo: el estado del microciclo lo decide el staff' using errcode = '42501';
  end if;
  if not public.tiene_capacidad('liberar_prescripcion') then
    raise exception 'activar_microciclo: falta la capacidad de liberar' using errcode = '42501';
  end if;
  select estado into v_estado from public.microciclos where id = p_propuesta_id;
  if v_estado is null or v_estado = 'cerrado' then
    return;
  end if;
  if v_estado <> 'activo' and not public.microciclo_liberado(p_propuesta_id) then
    raise exception 'activar_microciclo: esta version no tiene liberacion vigente' using errcode = '42501';
  end if;
  delete from public.activaciones_autorizadas where xid <> txid_current() and creada_en < clock_timestamp() - interval '1 day';
  insert into public.activaciones_autorizadas (propuesta_id, autorizada_por) values (p_propuesta_id, auth.uid()) on conflict do nothing;
end;
$$;
revoke all on function public.autorizar_activacion(text) from public, anon;
grant execute on function public.autorizar_activacion(text) to authenticated;

create or replace function public.activar_microciclo(p_propuesta_id text)
returns void
language plpgsql
set search_path = public
as $function$
declare
  v_uid    uuid;
  v_estado text;
  v_activos int;
begin
  -- Guardas de liberacion (0135), en este orden: sesion, staff, capacidad. Antes de mirar si la fila existe.
  if auth.uid() is null then
    raise exception 'activar_microciclo: se requiere sesion' using errcode = '42501';
  end if;
  if not public.es_staff() then
    raise exception 'activar_microciclo: el estado del microciclo lo decide el staff' using errcode = '42501';
  end if;
  if not public.tiene_capacidad('liberar_prescripcion') then
    raise exception 'activar_microciclo: falta la capacidad de liberar' using errcode = '42501';
  end if;

  select usuario_id, estado into v_uid, v_estado
    from public.microciclos
   where id = p_propuesta_id;

  -- Sin fila no hay nada que activar.
  if v_uid is null then
    return;
  end if;

  -- Un bloque cerrado no se reabre.
  if v_estado = 'cerrado' then
    return;
  end if;

  -- Una version se activa solo si esa huella exacta fue liberada por un humano autorizado.
  if v_estado <> 'activo' and not public.microciclo_liberado(p_propuesta_id) then
    raise exception 'activar_microciclo: esta version no tiene liberacion vigente' using errcode = '42501';
  end if;

  -- 0138: la autorizacion NO es una senal que el actor pueda fijar: la escribe una funcion definer en una tabla sin privilegios (ver trigger).
  perform public.autorizar_activacion(p_propuesta_id);

  -- CERRAR PRIMERO Y ABRIR DESPUES, dentro de la misma transaccion.
  update public.microciclos
     set estado = 'cerrado'
   where usuario_id = v_uid
     and id <> p_propuesta_id
     and estado = 'activo';

  update public.microciclos
     set estado = 'activo'
   where id = p_propuesta_id;

  select count(*) into v_activos
    from public.microciclos
   where usuario_id = v_uid
     and estado = 'activo';

  if v_activos <> 1 then
    raise exception 'activar_microciclo: quedaron % activos para el usuario %', v_activos, v_uid;
  end if;
end;
$function$;
revoke all on function public.activar_microciclo(text) from public, anon;
grant execute on function public.activar_microciclo(text) to authenticated, service_role;

create or replace function public.microciclo_activo_solo_liberado()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.estado = 'activo'
     and (tg_op = 'INSERT' or old.estado is distinct from 'activo')
     and current_user in ('authenticated', 'anon', 'service_role')
     and not exists (select 1 from public.activaciones_autorizadas a where a.propuesta_id = new.id and a.xid = txid_current()) then
    raise exception 'un microciclo solo pasa a activo por activar_microciclo con liberacion' using errcode = '42501';
  end if;
  return new;
end;
$$;

commit;
