-- 0130: cotas de ocurrida_en en el receptor v2 de alertas de la puerta.
-- Propuesta, NO APLICADA (I-16). Hijo de 0127/0128. Decision de coordinacion tecnica del 16-oct:
--   FUTURO: se rechaza (22023) si ocurrida_en > ahora + ocurrida_max_futuro_min (5): una fecha futura alargaria el plazo de 4 h.
--   ANTIGUEDAD: NUNCA se rechaza (una alerta de seguridad vieja que llega tarde no se puede perder). Si ocurrida_en < ahora - N dias
--   (ocurrida_max_antiguedad_dias = 90) el ancla del plazo se AJUSTA a ahora - N y queda constancia en ocurrida_en_original
--   (no nula solo si se ajusto). Un ancla antigua solo acelera el plazo; el ajuste acota la aritmetica del calendario.
-- El reintento identico (mismo DTO original) sigue devolviendo el acuse: se compara contra el valor ORIGINAL.
-- El contrato con C2 NO cambia (mismo DTO y mismo acuse); solo hay un caso nuevo de rechazo 22023 (fecha futura).
begin;

alter table public.politica_alerta_puerta
  add column ocurrida_max_futuro_min integer not null default 5 check (ocurrida_max_futuro_min between 0 and 1440),
  add column ocurrida_max_antiguedad_dias integer not null default 90 check (ocurrida_max_antiguedad_dias between 1 and 3650);

alter table public.alertas_puerta
  add column ocurrida_en_original timestamptz,
  add constraint alertas_puerta_ocurrida_original_check check (ocurrida_en_original is null or ocurrida_en_original < ocurrida_en);

create or replace function public.recibir_alerta_puerta_v2(
  p_capacidad text,
  p_id uuid,
  p_causa text,
  p_ocurrida_en timestamptz,
  p_plazo_horas_habiles integer,
  p_suplente text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_hash text;
  r public.reservas_alerta_puerta_v2;
  v_coach uuid;
  v_dest uuid;
  v_tipo text;
  v_prev public.alertas_puerta;
  v_ahora timestamptz := clock_timestamp();
  v_fut integer;
  v_ant integer;
  v_ancla timestamptz;
  v_orig timestamptz;
begin
  if p_id is null or p_capacidad is null or p_capacidad !~ '^[0-9a-f]{64}$'
     or p_causa is null or not public.causa_alerta_puerta_valida_v1(p_causa)
     or p_ocurrida_en is null or p_plazo_horas_habiles is distinct from 4
     or p_suplente is distinct from 'Manuela' then
    raise exception 'payload fuera del contrato v2' using errcode = '22023';
  end if;
  -- Cotas de ocurrida_en (decision 16-oct): el FUTURO se rechaza (alargaria el plazo); la ANTIGUEDAD nunca se rechaza
  -- (una alerta de seguridad que llega tarde no se pierde): se AJUSTA el ancla a ahora - N dias y se deja constancia.
  select ocurrida_max_futuro_min, ocurrida_max_antiguedad_dias into strict v_fut, v_ant from public.politica_alerta_puerta;
  if p_ocurrida_en > v_ahora + make_interval(mins => v_fut) then
    raise exception 'ocurrida_en esta en el futuro' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to('hermes-alerta-v2:' || p_capacidad, 'UTF8')), 'hex');

  -- Busqueda por igualdad sobre el hash unico e indexado; sin comparar secretos en plpgsql.
  select * into r from public.reservas_alerta_puerta_v2 where capacidad_hash = v_hash for update;
  if not found then
    raise exception 'reserva no valida' using errcode = '42501';
  end if;

  if r.consumida_en is not null then
    select * into v_prev from public.alertas_puerta where id = r.alerta_id;
    if r.alerta_id = p_id and v_prev.causa = p_causa and coalesce(v_prev.ocurrida_en_original, v_prev.ocurrida_en) = p_ocurrida_en
       and v_prev.plazo_horas_habiles = p_plazo_horas_habiles and v_prev.suplente = p_suplente then
      return jsonb_build_object('id', p_id, 'estado', 'REGISTRADA');
    end if;
    raise exception 'reserva ya consumida con otros datos' using errcode = '22023';
  end if;

  if clock_timestamp() > r.vence_en then
    raise exception 'reserva vencida' using errcode = '42501';
  end if;
  if exists (select 1 from public.alertas_puerta where id = p_id) then
    raise exception 'id reutilizado con datos distintos' using errcode = '22023';
  end if;

  -- Destinatario vigente AL CONSUMIR; coach_reserva_id conserva la traza.
  perform 1 from public.usuarios_app where id = r.persona_id for update;
  select coach_id into v_coach from public.asignaciones_coach
   where persona_id = r.persona_id and asignado_hasta is null;
  if found then
    v_dest := v_coach;
    v_tipo := 'COACH';
  else
    select usuario_id into v_dest from public.capacidades_staff
     where capacidad = 'recibir_alerta_puerta';
    if not found then
      raise exception 'suplente no configurado' using errcode = 'P0002';
    end if;
    v_tipo := 'SUPLENTE';
  end if;

  v_ancla := p_ocurrida_en;
  if p_ocurrida_en < v_ahora - make_interval(days => v_ant) then
    v_ancla := v_ahora - make_interval(days => v_ant);
    v_orig := p_ocurrida_en;
  end if;
  insert into public.alertas_puerta
    (id, caso_id, persona_id, destinatario_id, destinatario_tipo, causa, ocurrida_en,
     plazo_horas_habiles, suplente, ocurrida_en_original)
  values
    (p_id, 'caso-' || replace(r.id::text, '-', ''), r.persona_id, v_dest, v_tipo, p_causa,
     v_ancla, p_plazo_horas_habiles, p_suplente, v_orig);
  update public.reservas_alerta_puerta_v2
     set consumida_en = clock_timestamp(), alerta_id = p_id,
         destinatario_id = v_dest, destinatario_tipo = v_tipo
   where id = r.id;
  return jsonb_build_object('id', p_id, 'estado', 'REGISTRADA');
end;
$$;
revoke all on function public.recibir_alerta_puerta_v2(text, uuid, text, timestamptz, integer, text)
  from public, anon, authenticated;
grant execute on function public.recibir_alerta_puerta_v2(text, uuid, text, timestamptz, integer, text)
  to service_role;

commit;
