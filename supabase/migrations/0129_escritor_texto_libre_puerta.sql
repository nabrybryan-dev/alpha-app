-- 0129: escritor del texto libre del canal privado A de la puerta (hijo de 0127 y 0128).
-- Propuesta, NO APLICADA (I-16). Ningun texto libre llega a D2: nombre, salud y mensajes normales o
-- indeterminados se escriben SOLO aqui, en la tabla privada texto_libre_alerta_puerta (0128).
-- SUPUESTOS (a confirmar por Bryan / abogado L3):
--  1. Retencion del texto (decision de Bryan 16-oct, opcion C «dos plazos», PROVISIONAL hasta el abogado L3):
--     a) 30 dias desde que se atiende (politica_alerta_puerta.retencion_dias) y
--     b) un tope absoluto desde que ENTRA (politica_alerta_puerta.tope_texto_dias, 90) por si nadie lo atiende.
--     Sin alerta: retener_hasta = minimo(atencion + 30 d, ingreso + 90 d); sin atender solo corre el tope.
--     Con alerta: manda 0128 (30 d desde la atencion de la alerta) MAS el tope absoluto (tope_hasta).
--     Atender un ingreso sin alerta lo marca SOLO el coach asignado (decision de Bryan 16-oct, opcion A; el suplente no).
--  2. La reserva de la capacidad de texto la crea el coach asignado (como en 0127); la persona sale de la reserva.
--  3. El rol tecnico alerta_puerta_transporte NO se crea aqui (orden de Bryan): si existe, recibe solo esta RPC.
--  4. Alineada con CONTRATO-RPC-ESCRITORA-TEXTO-LIBRE-20261016 de C3 (nombres, parametros, acuse {id, estado}).
--     El marcador de «atendido» de un ingreso sin alerta es minimo: atendido_en/atendido_por y la RPC
--     atender_texto_libre_puerta_v2 (C3 propone estado REVISADO en una revision local que no existe).
--  5. Reintento tras la purga: devuelve el acuse si coincide ingreso_id + sha256 guardado (contrato C3); no reescribe.
begin;

-- Hash de la capacidad de texto: prefijo propio, distinto del de alerta ('hermes-alerta-v2:').
create function public.hash_capacidad_texto_libre_v2(p_capacidad text) returns text
language sql immutable set search_path = public
as $$
  select encode(sha256(convert_to('hermes-texto-v2:' || p_capacidad, 'UTF8')), 'hex');
$$;
revoke all on function public.hash_capacidad_texto_libre_v2(text) from public, anon, authenticated;

create table public.reservas_texto_libre_alerta_puerta_v2 (
  id uuid primary key default gen_random_uuid(),
  capacidad_hash text not null unique check (capacidad_hash ~ '^[0-9a-f]{64}$'),
  persona_id uuid not null references public.usuarios_app(id) on delete cascade,
  coach_reserva_id uuid not null references public.usuarios_app(id) on delete restrict,
  creada_en timestamptz not null,
  vence_en timestamptz not null,
  consumida_en timestamptz,
  ingreso_id uuid,
  check (vence_en = creada_en + interval '300 seconds'),
  check ((consumida_en is null) = (ingreso_id is null))
);
alter table public.reservas_texto_libre_alerta_puerta_v2 enable row level security;
revoke all on public.reservas_texto_libre_alerta_puerta_v2 from anon, public, authenticated;
grant all on public.reservas_texto_libre_alerta_puerta_v2 to service_role;

-- Crea la app, por el coach asignado. Devuelve la capacidad UNA vez; solo se guarda su hash.
create function public.reservar_texto_libre_alerta_puerta_v2(p_persona_id uuid)
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
  insert into public.reservas_texto_libre_alerta_puerta_v2
    (id, capacidad_hash, persona_id, coach_reserva_id, creada_en, vence_en)
  values (v_id, public.hash_capacidad_texto_libre_v2(v_cap), p_persona_id, v_actor,
          v_ahora, v_ahora + interval '300 seconds');
  return jsonb_build_object('id', v_id, 'capacidad', v_cap, 'vence_en', v_ahora + interval '300 seconds');
end;
$$;
revoke all on function public.reservar_texto_libre_alerta_puerta_v2(uuid) from public, anon;
grant execute on function public.reservar_texto_libre_alerta_puerta_v2(uuid) to authenticated;

-- Plazos como PARAMETROS de la politica (no constantes en el codigo). PROVISIONAL hasta el concepto del abogado L3.
alter table public.politica_alerta_puerta
  add column tope_texto_dias integer not null default 90 check (tope_texto_dias between 1 and 3650);

-- Tabla privada (0128): alerta opcional, ingreso propio unico, persona de la reserva, tope absoluto y marca de atencion.
alter table public.texto_libre_alerta_puerta alter column alerta_id drop not null;
alter table public.texto_libre_alerta_puerta
  add column ingreso_id uuid unique,
  add column contenido_sha256 text check (contenido_sha256 ~ '^[0-9a-f]{64}$'),
  add column persona_id uuid references public.usuarios_app(id) on delete cascade,
  add column retener_hasta timestamptz,
  add column tope_hasta timestamptz,
  add column atendido_en timestamptz,
  add column atendido_por uuid references public.usuarios_app(id) on delete restrict,
  add constraint texto_libre_alerta_puerta_atendido check ((atendido_en is null) = (atendido_por is null)),
  add constraint texto_libre_alerta_puerta_sin_alerta check
    (alerta_id is not null or (ingreso_id is not null and persona_id is not null
                               and retener_hasta is not null and tope_hasta is not null));
create unique index texto_libre_alerta_puerta_un_texto_por_alerta
  on public.texto_libre_alerta_puerta(alerta_id) where alerta_id is not null;
revoke all on public.texto_libre_alerta_puerta from anon, public, authenticated;

-- Escritor. Sobre cerrado: capacidad, ingreso_id, texto, alerta_id opcional. Persona y destinatario NO viajan.
create function public.recibir_texto_libre_alerta_puerta_v2(
  p_capacidad text,
  p_ingreso_id uuid,
  p_contenido text,
  p_alerta_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_ack jsonb;
  v_hash text;
  v_rid uuid;
  v_persona uuid;
  v_vence timestamptz;
  v_consumida timestamptz;
  v_ingreso_prev uuid;
  -- Huella salada con la capacidad (secreto que la base solo guarda como hash): un texto corto como un nombre o un
  -- telefono no se puede adivinar por diccionario desde contenido_sha256 despues de la purga.
  v_sha text := encode(sha256(convert_to(p_capacidad || ':' || p_contenido, 'UTF8')), 'hex');
  v_shap text;
  v_a uuid;
  v_tope integer;
  v_tope_hasta timestamptz;
begin
  if p_ingreso_id is null or p_capacidad is null or p_capacidad !~ '^[0-9a-f]{64}$'
     or p_contenido is null or length(p_contenido) not between 1 and 20000 or btrim(p_contenido) = '' then
    raise exception 'payload fuera del contrato' using errcode = '22023';
  end if;
  v_ack := jsonb_build_object('id', p_ingreso_id, 'estado', 'PENDIENTE_REVISION_LOCAL');

  -- Busqueda por igualdad sobre el hash unico e indexado; la fila queda bloqueada hasta el final.
  v_hash := public.hash_capacidad_texto_libre_v2(p_capacidad);
  select id, persona_id, vence_en, consumida_en, ingreso_id
    into v_rid, v_persona, v_vence, v_consumida, v_ingreso_prev
    from public.reservas_texto_libre_alerta_puerta_v2 where capacidad_hash = v_hash for update;
  if not found then
    raise exception 'reserva no valida' using errcode = '42501';
  end if;

  if v_consumida is not null then
    select contenido_sha256, alerta_id into v_shap, v_a
      from public.texto_libre_alerta_puerta where ingreso_id = p_ingreso_id;
    if v_ingreso_prev = p_ingreso_id and found
       and v_shap = v_sha and v_a is not distinct from p_alerta_id then
      return v_ack;
    end if;
    raise exception 'reserva ya consumida con otros datos' using errcode = '22023';
  end if;

  if clock_timestamp() > v_vence then
    raise exception 'reserva vencida' using errcode = '42501';
  end if;
  if p_alerta_id is not null and not exists
     (select 1 from public.alertas_puerta where id = p_alerta_id and persona_id = v_persona)
     or exists (select 1 from public.texto_libre_alerta_puerta where alerta_id = p_alerta_id) then
    raise exception 'alerta de otra persona o con texto ya guardado' using errcode = '22023';
  end if;

  select tope_texto_dias into v_tope from public.politica_alerta_puerta;
  if v_tope is null then
    raise exception 'politica de retencion ausente' using errcode = 'P0002';
  end if;
  v_tope_hasta := clock_timestamp() + make_interval(days => v_tope);
  begin
    insert into public.texto_libre_alerta_puerta
      (alerta_id, contenido, contenido_sha256, ingreso_id, persona_id, tope_hasta, retener_hasta)
    values (p_alerta_id, p_contenido, v_sha, p_ingreso_id, v_persona, v_tope_hasta,
            case when p_alerta_id is null then v_tope_hasta end);
  exception when unique_violation then
    raise exception 'ingreso_id o alerta ya usados con otros datos' using errcode = '22023';
  end;
  update public.reservas_texto_libre_alerta_puerta_v2
     set consumida_en = clock_timestamp(), ingreso_id = p_ingreso_id
   where id = v_rid;
  return v_ack;
end;
$$;
revoke all on function public.recibir_texto_libre_alerta_puerta_v2(text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.recibir_texto_libre_alerta_puerta_v2(text, uuid, text, uuid) to service_role;

-- Purga (reemplaza la de 0128, misma firma). Borra SOLO el contenido. Sin alerta: a su retener_hasta
-- (minimo entre atencion + 30 d e ingreso + 90 d). Con alerta: a los 30 d de atendida la alerta (0128) o al tope.
create or replace function public.purgar_texto_libre_alerta_puerta(p_ahora timestamptz default clock_timestamp())
returns integer language plpgsql security definer set search_path = public
as $$
declare
  v_borrados integer;
begin
  update public.texto_libre_alerta_puerta t
     set contenido = null, borrado_en = p_ahora
   where t.contenido is not null
     and (t.alerta_id in (select c.alerta_id from public.cola_alerta_puerta c
                           where c.estado = 'ATENDIDA' and c.retener_hasta <= p_ahora)
          or (t.alerta_id is not null and t.tope_hasta <= p_ahora)
          or (t.alerta_id is null and t.retener_hasta <= p_ahora));
  get diagnostics v_borrados = row_count;
  return v_borrados;
end;
$$;

-- Atender un ingreso SIN alerta: SOLO el coach asignado de la persona (decision de Bryan 16-oct, opcion A).
-- Fija retener_hasta = minimo(ahora + retencion_dias, tope_hasta): atender NUNCA alarga el tope. Idempotente:
-- atender otra vez no mueve nada. No devuelve ni lee el texto. Los ingresos con alerta se atienden por 0128.
create function public.atender_texto_libre_puerta_v2(p_ingreso_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_ahora timestamptz := clock_timestamp();
  v_dias integer;
  t public.texto_libre_alerta_puerta;
begin
  if v_actor is null or p_ingreso_id is null then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  select * into t from public.texto_libre_alerta_puerta where ingreso_id = p_ingreso_id for update;
  if not found or not public.es_coach_asignado(t.persona_id) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if t.alerta_id is not null then
    raise exception 'el ingreso tiene alerta: se atiende con la alerta' using errcode = '22023';
  end if;
  if t.atendido_en is null then
    select retencion_dias into v_dias from public.politica_alerta_puerta;
    update public.texto_libre_alerta_puerta
       set atendido_en = v_ahora, atendido_por = v_actor,
           retener_hasta = least(v_ahora + make_interval(days => v_dias), t.tope_hasta)
     where id = t.id;
  end if;
  return jsonb_build_object('id', p_ingreso_id, 'estado', 'ATENDIDO');
end;
$$;
revoke all on function public.atender_texto_libre_puerta_v2(uuid) from public, anon;
grant execute on function public.atender_texto_libre_puerta_v2(uuid) to authenticated;

-- El principal tecnico dedicado NO se crea aqui (requiere orden de Bryan, I-16): si existe, recibe solo esta RPC.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'alerta_puerta_transporte') then
    grant execute on function public.recibir_texto_libre_alerta_puerta_v2(text, uuid, text, uuid)
      to alerta_puerta_transporte;
  end if;
end
$$;

comment on table public.reservas_texto_libre_alerta_puerta_v2 is
  'Reserva de un solo uso (300 s) del texto libre; guarda solo el hash de la capacidad (prefijo propio). Sin contenido.';
commit;
