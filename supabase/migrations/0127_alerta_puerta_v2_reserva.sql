-- 0127: receptor v2 de alertas de la puerta con reserva de un solo uso.
-- Propuesta, NO APLICADA (I-16). Hijo de 0120 (propuesta de P2b). El DTO no lleva caso, persona ni destinatario:
-- la persona sale de la fila privada de reserva que crea la app para el coach asignado.
-- FALTA (Bryan): calendario de horas habiles, quien es el suplente, plazo de retencion, rol tecnico.
begin;

create table public.reservas_alerta_puerta_v2 (
  id uuid primary key default gen_random_uuid(),               -- id de ENTREGA; no es el caso
  capacidad_hash text not null unique check (capacidad_hash ~ '^[0-9a-f]{64}$'),
  persona_id uuid not null references public.usuarios_app(id) on delete cascade,
  coach_reserva_id uuid not null references public.usuarios_app(id) on delete restrict,
  creada_en timestamptz not null,
  vence_en timestamptz not null,
  consumida_en timestamptz,
  alerta_id uuid references public.alertas_puerta(id) on delete restrict,
  destinatario_id uuid references public.usuarios_app(id) on delete restrict,
  destinatario_tipo text check (destinatario_tipo in ('COACH','SUPLENTE')),
  check (vence_en = creada_en + interval '300 seconds'),
  check ((consumida_en is null) = (alerta_id is null)
     and (consumida_en is null) = (destinatario_id is null)
     and (consumida_en is null) = (destinatario_tipo is null))
);
alter table public.reservas_alerta_puerta_v2 enable row level security;
revoke all on public.reservas_alerta_puerta_v2 from anon, public, authenticated;
grant all on public.reservas_alerta_puerta_v2 to service_role;

-- Crea la app, por el coach asignado. Devuelve la capacidad UNA vez; solo se guarda su hash.
create function public.reservar_alerta_puerta_v2(p_persona_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_cap text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_ahora timestamptz := clock_timestamp();
begin
  if v_actor is null or p_persona_id is null
     or not public.es_coach() or not public.es_coach_asignado(p_persona_id) then
    raise exception 'solo el coach asignado reserva' using errcode = '42501';
  end if;
  insert into public.reservas_alerta_puerta_v2
    (id, capacidad_hash, persona_id, coach_reserva_id, creada_en, vence_en)
  values (
    v_id,
    encode(sha256(convert_to('hermes-alerta-v2:' || v_cap, 'UTF8')), 'hex'),
    p_persona_id, v_actor, v_ahora, v_ahora + interval '300 seconds'
  );
  return jsonb_build_object('id', v_id, 'capacidad', v_cap, 'vence_en', v_ahora + interval '300 seconds');
end;
$$;
revoke all on function public.reservar_alerta_puerta_v2(uuid) from public, anon;
grant execute on function public.reservar_alerta_puerta_v2(uuid) to authenticated;

-- Causas del aviso: ENUM CERRADO y versionado (v1 = 8 valores). La causa es SOLO una palabra de esta lista,
-- nunca un fragmento de texto. Cambiar el conjunto exige una v2 de esta funcion y una migracion nueva.
-- Antes de esta version eran 5 (telefono, correo, documento, arroba, tamano); se anaden nombre, salud y
-- revision_local (acuerdo C3 con Bryan). 0127 es propuesta NO aplicada, por eso se modifica aqui y no en una 0129.
create function public.causa_alerta_puerta_valida_v1(p_causa text)
returns boolean language sql immutable set search_path = public
as $$ select p_causa in ('telefono','correo','documento','arroba','tamano','nombre','salud','revision_local') $$;
alter table public.alertas_puerta drop constraint alertas_puerta_causa_check;
alter table public.alertas_puerta add constraint alertas_puerta_causa_v1_check
  check (public.causa_alerta_puerta_valida_v1(causa));

-- DTO v2: capacidad (fuera del contenido) + id, causa, ocurrida_en, plazo_horas_habiles, suplente.
create function public.recibir_alerta_puerta_v2(
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
begin
  if p_id is null or p_capacidad is null or p_capacidad !~ '^[0-9a-f]{64}$'
     or p_causa is null or not public.causa_alerta_puerta_valida_v1(p_causa)
     or p_ocurrida_en is null or p_plazo_horas_habiles is distinct from 4
     or p_suplente is distinct from 'Manuela' then
    raise exception 'payload fuera del contrato v2' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to('hermes-alerta-v2:' || p_capacidad, 'UTF8')), 'hex');

  -- Busqueda por igualdad sobre el hash unico e indexado; sin comparar secretos en plpgsql.
  select * into r from public.reservas_alerta_puerta_v2 where capacidad_hash = v_hash for update;
  if not found then
    raise exception 'reserva no valida' using errcode = '42501';
  end if;

  if r.consumida_en is not null then
    select * into v_prev from public.alertas_puerta where id = r.alerta_id;
    if r.alerta_id = p_id and v_prev.causa = p_causa and v_prev.ocurrida_en = p_ocurrida_en
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

  insert into public.alertas_puerta
    (id, caso_id, persona_id, destinatario_id, destinatario_tipo, causa, ocurrida_en,
     plazo_horas_habiles, suplente)
  values
    (p_id, 'caso-' || replace(r.id::text, '-', ''), r.persona_id, v_dest, v_tipo, p_causa,
     p_ocurrida_en, p_plazo_horas_habiles, p_suplente);
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

-- Sin v1 y sin respaldo: ni la reserva por caso ni el receptor de 0120 quedan ejecutables.
revoke execute on function public.recibir_alerta_puerta(uuid, text, text, timestamptz, integer, text) from service_role;
revoke execute on function public.reservar_caso_alerta_puerta(uuid) from authenticated;

-- El principal tecnico dedicado NO se crea aqui (requiere orden de Bryan, I-16): si existe, recibe solo esta RPC.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'alerta_puerta_transporte') then
    grant execute on function public.recibir_alerta_puerta_v2(text, uuid, text, timestamptz, integer, text)
      to alerta_puerta_transporte;
  end if;
end
$$;

comment on table public.reservas_alerta_puerta_v2 is
  'Reserva de un solo uso (300 s) de una entrega; guarda solo el hash de la capacidad. Sin contenido ni etiqueta de caso.';
commit;
