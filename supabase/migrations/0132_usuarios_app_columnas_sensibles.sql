-- 0132: usuarios_app deja de exponer pausa_activa y pago_vigente_hasta a todo el staff y deja de dejar que la persona los escriba.
-- Propuesta, NO APLICADA (I-16). CAMBIO DE PERMISOS SOBRE UNA TABLA DE PERSONAS: requiere visto bueno de Bryan.
-- Medido (cadena 0001..0131, base desechable): la politica usuarios_leer deja leer la fila de CUALQUIER persona a todo el staff
-- (coach ajeno, suplente, nutricionista sin capacidad) y los permisos de tabla dejan ver TODAS las columnas; 0123 anadio pago_vigente_hasta
-- y pausa_activa, que quedaron legibles por todo el staff y ESCRIBIBLES por la propia persona (usuarios_editar_propio): una persona podia
-- ponerse en pausa y asi quitarse el aviso semanal. La app en main solo lee id, nombre, rol, avatar_iniciales (hidratar.ts:402, consultasNube.ts:84).
-- Cambio: permisos POR COLUMNA. authenticated lee id, nombre, rol, avatar_iniciales, creado_en, actualizado_en (lo que las pantallas usan) y solo
-- edita nombre y avatar_iniciales; lo sensible se lee por estado_cuenta_persona() con control de quien. Escribir pausa/pago queda reservado
-- a service_role (aun no hay escritor confiable: pendiente). Consecuencia: SELECT * sobre usuarios_app con sesion de usuario ya no funciona.
begin;

revoke select, update on public.usuarios_app from anon, authenticated;
grant select (id, nombre, rol, avatar_iniciales, creado_en, actualizado_en) on public.usuarios_app to authenticated;
grant update (nombre, avatar_iniciales) on public.usuarios_app to authenticated;

-- Lectura controlada de lo sensible: la persona (ambos datos), el coach asignado (solo la pausa) y quien tiene leer_entrenamiento
-- (Bryan y Manuela: ambos). El pago no lo ve el coach asignado.
create function public.estado_cuenta_persona(p_persona_id uuid)
returns table (pausa_activa boolean, pago_vigente_hasta date)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_propia boolean;
  v_capacidad boolean;
  v_asignado boolean;
begin
  if v_actor is null or p_persona_id is null then
    raise exception 'se requiere una sesion y una persona' using errcode = '42501';
  end if;
  v_propia := v_actor = p_persona_id;
  v_capacidad := public.tiene_capacidad('leer_entrenamiento');
  v_asignado := public.es_coach_asignado(p_persona_id);
  if not (v_propia or v_capacidad or v_asignado) then
    raise exception 'sin permiso para ver el estado de cuenta de esta persona' using errcode = '42501';
  end if;
  return query
    select u.pausa_activa,
           case when v_propia or v_capacidad then u.pago_vigente_hasta else null end
      from public.usuarios_app u
     where u.id = p_persona_id;
end;
$$;
revoke all on function public.estado_cuenta_persona(uuid) from public, anon;
grant execute on function public.estado_cuenta_persona(uuid) to authenticated;

commit;
