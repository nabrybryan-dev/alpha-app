-- 0133: dos cierres del barrido de funciones SECURITY DEFINER (16-oct). Propuesta, NO APLICADA (I-16).
-- CAMBIO DE PERMISOS: aprobada en diseno por Bryan (16-oct).
-- (1) crear_ficha_si_falta(uuid): hasta 0132 cualquier staff (cualquier coach) podia crear la ficha de CUALQUIER persona. Ahora: el coach asignado,
--     quien tiene leer_entrenamiento (Bryan y Manuela). Decision de Bryan (16-oct): no hay excepcion para otro staff con personas SIN coach.
--     Misma firma y cuerpo que 0107 salvo esa condicion.
-- (3) asignar_coach_inicial(persona, coach): RPC SOLO service_role para que el alta (edge function alta-cliente) deje al cliente con coach desde el
--     primer momento; idempotente, no pisa una asignacion vigente.
-- (2) Las funciones de trigger crear_usuario_app, proteger_estado_microciclo, proteger_perfil y proteger_rol dejan de tener EXECUTE para
--     PUBLIC/anon/authenticated: no se pueden invocar directo (devuelven trigger) y un trigger no necesita EXECUTE del usuario que lo dispara.
begin;

create or replace function public.crear_ficha_si_falta(p_usuario uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creada int;
begin
  if auth.uid() is null then
    raise exception 'Falta sesión' using errcode = '28000';
  end if;
  if not public.es_staff() then
    raise exception 'Solo el staff (coach o nutricionista) crea la ficha de otra persona' using errcode = '42501';
  end if;
  if p_usuario is null
     or not exists (select 1 from public.usuarios_app u where u.id = p_usuario) then
    raise exception 'La persona % no existe', p_usuario using errcode = 'P0002';
  end if;
  -- 0133: solo el coach ASIGNADO (o quien tiene leer_entrenamiento: Bryan y Manuela) crea la ficha de una persona que ya tiene coach.
  -- Decision de Bryan (16-oct): una persona SIN coach la da de alta SOLO quien tiene leer_entrenamiento (Bryan y Manuela); no hay excepcion para otro staff.
  if not (public.es_coach_asignado(p_usuario) or public.tiene_capacidad('leer_entrenamiento')) then
    raise exception 'Solo el coach asignado crea la ficha de esta persona' using errcode = '42501';
  end if;

  -- Misma ficha mínima que deja `registrar_medida` (0057): solo `usuarioId` y `medidas`.
  -- No inventa objetivos ni edad: el resto lo pone el coach.
  -- Marca local a la transacción: `proteger_perfil` deja pasar SOLO este INSERT de ficha vacía.
  perform set_config('alpha.crea_ficha_vacia', '1', true);
  insert into public.perfiles (usuario_id, datos)
  values (p_usuario, jsonb_build_object('usuarioId', p_usuario::text, 'medidas', '[]'::jsonb))
  on conflict (usuario_id) do nothing;

  get diagnostics v_creada = row_count;
  return v_creada > 0;
end;
$$;

create function public.asignar_coach_inicial(p_persona uuid, p_coach uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if p_persona is null or p_coach is null
     or not exists (select 1 from public.usuarios_app u where u.id = p_persona and u.rol = 'asesorado') then
    raise exception 'persona inexistente o no asesorada' using errcode = '22023';
  end if;
  if not exists (select 1 from public.usuarios_app u where u.id = p_coach
                  and (u.rol = 'coach' or exists (select 1 from public.capacidades_staff c where c.usuario_id = u.id and c.capacidad = 'puesto_de_coach'))) then
    raise exception 'el destino no ocupa un puesto de coach' using errcode = '22023';
  end if;
  if exists (select 1 from public.asignaciones_coach a where a.persona_id = p_persona and a.asignado_hasta is null) then
    return false;
  end if;
  insert into public.asignaciones_coach (persona_id, coach_id, asignado_desde, cambiado_por) values (p_persona, p_coach, clock_timestamp(), null);
  return true;
end;
$$;
revoke all on function public.asignar_coach_inicial(uuid, uuid) from public, anon, authenticated;
grant execute on function public.asignar_coach_inicial(uuid, uuid) to service_role;

revoke execute on function public.crear_usuario_app() from public, anon, authenticated;
revoke execute on function public.proteger_estado_microciclo() from public, anon, authenticated;
revoke execute on function public.proteger_perfil() from public, anon, authenticated;
revoke execute on function public.proteger_rol() from public, anon, authenticated;

commit;
