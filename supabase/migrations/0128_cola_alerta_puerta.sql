-- 0128: cola durable, outbox y supervisor de las alertas de la puerta (pieza 2 de P2b v2).
-- Propuesta, NO APLICADA (I-16). Hijo de 0127. Nada de contenido libre: solo referencias y estados.
-- Decisiones de Bryan 16-oct (via 20261016-0030-claude-a-c3-decisiones-16oct): suplente = Manuela;
-- horas habiles = lunes a viernes 8 a 18 hora de Colombia, sin festivos; retencion = 30 dias desde que
-- se atiende. PROVISIONAL: la retencion de 30 dias no es juridica; si el abogado (L3) fija otro plazo, manda el suyo.
-- Decisiones de Bryan 16-oct (20261016-0400-claude-a-c3-borrado-plazo-festivos): a los 30 dias se borra SOLO el
-- texto libre (la alerta y su traza quedan); el plazo de 4 h habiles corre desde que OCURRIO (ocurrida_en).
-- Festivos: 2026 VERIFICADO contra Hacienda (19 fechas, con Ley 2578/2026; el Diario Oficial no se leyo);
-- 2027 CALCULADO por regla (Ley 51/1983) y NO VERIFICADO: queda PROVISIONAL (Chiquinquira 2027 es ambiguo).
-- Fuente: detector-investigacion-20261016/06-festivos-colombia-2026-2027.md. Fuera de 2026-2027 no se inventa:
-- la alerta queda SIN_CALENDARIO y se cuenta.
-- FALTA: usuario de Manuela con la capacidad 'recibir_alerta_puerta' (no se otorga aqui); el escritor del
-- texto libre (el canal privado del carril A, de C2) no existe aun: aqui solo vive su tabla y su borrado.
begin;

-- Calendario habil como DATOS (no constante en el codigo). Zona fija UTC-5 (Colombia).
create table public.calendario_habil_alerta_puerta (
  dia_semana smallint primary key check (dia_semana between 1 and 7),  -- isodow: 1 lunes ... 7 domingo
  hora_desde time not null,
  hora_hasta time not null,
  check (hora_desde < hora_hasta)
);
insert into public.calendario_habil_alerta_puerta (dia_semana, hora_desde, hora_hasta)
select d, time '08:00', time '18:00' from generate_series(1, 5) as d;

create table public.festivos_alerta_puerta (
  fecha date primary key,
  nombre text not null,
  estado text not null check (estado in ('VERIFICADO','PROVISIONAL'))
);

insert into public.festivos_alerta_puerta (fecha, nombre, estado) values
  ('2026-01-01','Ano Nuevo','VERIFICADO'),
  ('2026-01-12','Reyes Magos','VERIFICADO'),
  ('2026-03-23','San Jose','VERIFICADO'),
  ('2026-04-02','Jueves Santo','VERIFICADO'),
  ('2026-04-03','Viernes Santo','VERIFICADO'),
  ('2026-05-01','Dia del Trabajo','VERIFICADO'),
  ('2026-05-18','Ascension','VERIFICADO'),
  ('2026-06-08','Corpus Christi','VERIFICADO'),
  ('2026-06-15','Sagrado Corazon','VERIFICADO'),
  ('2026-06-29','San Pedro y San Pablo','VERIFICADO'),
  ('2026-07-13','Nuestra Senora del Rosario de Chiquinquira (Ley 2578/2026)','VERIFICADO'),
  ('2026-07-20','Independencia','VERIFICADO'),
  ('2026-08-07','Batalla de Boyaca','VERIFICADO'),
  ('2026-08-17','Asuncion','VERIFICADO'),
  ('2026-10-12','Dia de la Raza','VERIFICADO'),
  ('2026-11-02','Todos los Santos','VERIFICADO'),
  ('2026-11-16','Independencia de Cartagena','VERIFICADO'),
  ('2026-12-08','Inmaculada Concepcion','VERIFICADO'),
  ('2026-12-25','Navidad','VERIFICADO'),
  ('2027-01-01','Ano Nuevo','PROVISIONAL'),
  ('2027-01-11','Reyes Magos','PROVISIONAL'),
  ('2027-03-22','San Jose','PROVISIONAL'),
  ('2027-03-25','Jueves Santo','PROVISIONAL'),
  ('2027-03-26','Viernes Santo','PROVISIONAL'),
  ('2027-05-01','Dia del Trabajo','PROVISIONAL'),
  ('2027-05-10','Ascension','PROVISIONAL'),
  ('2027-05-31','Corpus Christi','PROVISIONAL'),
  ('2027-06-07','Sagrado Corazon','PROVISIONAL'),
  ('2027-07-05','San Pedro y San Pablo','PROVISIONAL'),
  ('2027-07-12','Nuestra Senora del Rosario de Chiquinquira (traslado ambiguo)','PROVISIONAL'),
  ('2027-07-20','Independencia','PROVISIONAL'),
  ('2027-08-07','Batalla de Boyaca','PROVISIONAL'),
  ('2027-08-16','Asuncion','PROVISIONAL'),
  ('2027-10-18','Dia de la Raza','PROVISIONAL'),
  ('2027-11-01','Todos los Santos','PROVISIONAL'),
  ('2027-11-15','Independencia de Cartagena','PROVISIONAL'),
  ('2027-12-08','Inmaculada Concepcion','PROVISIONAL'),
  ('2027-12-25','Navidad','PROVISIONAL');

-- Un anio sin fila aqui NO tiene calendario confiable: el plazo no se calcula.
create table public.festivos_cobertura_alerta_puerta (
  anio integer primary key check (anio between 2000 and 2100),
  estado text not null check (estado in ('VERIFICADO','PROVISIONAL')),
  cargado_en timestamptz not null default now()
);

create table public.politica_alerta_puerta (
  id boolean primary key default true check (id),
  retencion_dias integer not null check (retencion_dias between 1 and 3650),
  plazo_horas_habiles integer not null check (plazo_horas_habiles = 4),
  provisional boolean not null default true,
  fuente text not null
);
insert into public.politica_alerta_puerta (retencion_dias, plazo_horas_habiles, provisional, fuente)
values (30, 4, true, 'Bryan 16-oct-2026 (A: 30 dias tras atendido); concepto del abogado L3 pendiente');

insert into public.festivos_cobertura_alerta_puerta (anio, estado) values (2026, 'VERIFICADO'), (2027, 'PROVISIONAL');

alter table public.calendario_habil_alerta_puerta enable row level security;
alter table public.festivos_alerta_puerta enable row level security;
alter table public.festivos_cobertura_alerta_puerta enable row level security;
alter table public.politica_alerta_puerta enable row level security;
revoke all on public.calendario_habil_alerta_puerta, public.festivos_alerta_puerta,
  public.festivos_cobertura_alerta_puerta, public.politica_alerta_puerta from anon, public, authenticated;
grant all on public.calendario_habil_alerta_puerta, public.festivos_alerta_puerta,
  public.festivos_cobertura_alerta_puerta, public.politica_alerta_puerta to service_role;

-- Suma horas habiles desde un instante. Recorre dias locales; salta dias fuera del calendario y festivos.
create function public.sumar_horas_habiles_alerta_puerta(p_desde timestamptz, p_horas integer)
returns timestamptz language plpgsql stable set search_path = public
as $$
declare
  v_zona constant interval := interval '-05:00';  -- Colombia: UTC-5 fijo, sin horario de verano ni tzdata
  v_t timestamp;
  v_min integer;
  v_dia date;
  v_ini timestamp;
  v_fin timestamp;
  v_disp integer;
  v_cal public.calendario_habil_alerta_puerta;
  v_vueltas integer := 0;
begin
  if p_desde is null or p_horas is null or p_horas < 0 then
    raise exception 'argumentos invalidos' using errcode = '22023';
  end if;
  v_t := p_desde at time zone v_zona;
  v_min := p_horas * 60;
  loop
    v_vueltas := v_vueltas + 1;
    if v_vueltas > 60 then
      raise exception 'sin dias habiles en 60 dias' using errcode = 'P0002';
    end if;
    v_dia := v_t::date;
    select * into v_cal from public.calendario_habil_alerta_puerta
     where dia_semana = extract(isodow from v_dia)::smallint;
    if found
       and not exists (select 1 from public.festivos_alerta_puerta where fecha = v_dia) then
      v_ini := greatest(v_t, v_dia + v_cal.hora_desde);
      v_fin := v_dia + v_cal.hora_hasta;
      v_disp := floor(extract(epoch from (v_fin - v_ini)) / 60)::integer;
      if v_disp > 0 then
        if v_min <= v_disp then
          return (v_ini + make_interval(mins => v_min)) at time zone v_zona;
        end if;
        v_min := v_min - v_disp;
      end if;
    end if;
    v_t := (v_dia + 1)::timestamp;
  end loop;
end;
$$;

-- Verdadero si el anio usado (o el siguiente, en diciembre) tiene festivos solo PROVISIONALES.
create function public.calendario_provisional_alerta_puerta(p_desde timestamptz)
returns boolean language sql stable set search_path = public
as $$
  select exists (
    select 1 from public.festivos_cobertura_alerta_puerta c
     where c.estado = 'PROVISIONAL'
       and (c.anio = extract(year from (p_desde at time zone interval '-05:00'))::integer
            or (extract(month from (p_desde at time zone interval '-05:00')) = 12
                and c.anio = extract(year from (p_desde at time zone interval '-05:00'))::integer + 1))
  );
$$;

-- Vencimiento del plazo, o NULL si el calendario no cubre el anio (nunca inventa ni falla).
create function public.plazo_vence_alerta_puerta(p_desde timestamptz)
returns timestamptz language plpgsql stable set search_path = public
as $$
declare
  v_local timestamp := p_desde at time zone interval '-05:00';
  v_anio integer := extract(year from v_local)::integer;
  v_horas integer;
begin
  select plazo_horas_habiles into v_horas from public.politica_alerta_puerta;
  if v_horas is null
     or not exists (select 1 from public.festivos_cobertura_alerta_puerta where anio = v_anio)
     or (extract(month from v_local) = 12
         and not exists (select 1 from public.festivos_cobertura_alerta_puerta where anio = v_anio + 1)) then
    return null;
  end if;
  return public.sumar_horas_habiles_alerta_puerta(p_desde, v_horas);
exception when others then
  return null;
end;
$$;

-- Cola privada: una fila por alerta; conserva origen y plazo original. Reautorizar NO reinicia el plazo.
create table public.cola_alerta_puerta (
  alerta_id uuid primary key references public.alertas_puerta(id) on delete cascade,
  estado text not null check (estado in ('PENDIENTE_COACH','ESCALADA_SUPLENTE','ATENDIDA','SIN_CALENDARIO','PENDIENTE_REVISION_LOCAL')),
  vence_habil_en timestamptz,
  calendario_provisional boolean not null default false,
  suplente_id uuid references public.usuarios_app(id) on delete restrict,
  escalada_en timestamptz,
  atendida_en timestamptz,
  atendida_por uuid references public.usuarios_app(id) on delete restrict,
  retener_hasta timestamptz,
  creada_en timestamptz not null default clock_timestamp(),
  check ((estado = 'ATENDIDA') = (atendida_en is not null)),
  check ((atendida_en is null) = (retener_hasta is null)),
  check (estado <> 'PENDIENTE_COACH' or (vence_habil_en is not null and escalada_en is null)),
  check (estado <> 'SIN_CALENDARIO' or vence_habil_en is null),
  check (estado <> 'PENDIENTE_REVISION_LOCAL' or (vence_habil_en is null and escalada_en is null))
);
create index cola_alerta_puerta_vencimiento on public.cola_alerta_puerta(vence_habil_en)
  where estado = 'PENDIENTE_COACH';

-- Outbox durable de avisos: referencia y estado, sin contenido.
create table public.outbox_alerta_puerta (
  id uuid primary key default gen_random_uuid(),
  alerta_id uuid not null references public.alertas_puerta(id) on delete cascade,
  destinatario_id uuid not null references public.usuarios_app(id) on delete restrict,
  tipo text not null check (tipo in ('AVISO_COACH','AVISO_SUPLENTE')),
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','ENVIADO','FALLIDO')),
  intentos smallint not null default 0,
  creada_en timestamptz not null default clock_timestamp(),
  enviada_en timestamptz,
  unique (alerta_id, tipo)
);
alter table public.cola_alerta_puerta enable row level security;
alter table public.outbox_alerta_puerta enable row level security;
revoke all on public.cola_alerta_puerta, public.outbox_alerta_puerta from anon, public, authenticated;
grant all on public.cola_alerta_puerta, public.outbox_alerta_puerta to service_role;

-- Al registrarse una alerta entra a la cola y al outbox. No puede fallar: sin calendario queda SIN_CALENDARIO.
create function public.encolar_alerta_puerta() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_vence timestamptz;
begin
  if new.causa = 'revision_local' then
    -- Causa 8: misma cola, sin plazo habil ni escalada automatica; la revisa el equipo local.
    insert into public.cola_alerta_puerta (alerta_id, estado)
    values (new.id, 'PENDIENTE_REVISION_LOCAL');
    insert into public.outbox_alerta_puerta (alerta_id, destinatario_id, tipo)
    values (new.id, new.destinatario_id,
            case when new.destinatario_tipo = 'SUPLENTE' then 'AVISO_SUPLENTE' else 'AVISO_COACH' end);
  elsif new.destinatario_tipo = 'SUPLENTE' then
    insert into public.cola_alerta_puerta (alerta_id, estado, suplente_id, escalada_en)
    values (new.id, 'ESCALADA_SUPLENTE', new.destinatario_id, clock_timestamp());
    insert into public.outbox_alerta_puerta (alerta_id, destinatario_id, tipo)
    values (new.id, new.destinatario_id, 'AVISO_SUPLENTE');
  else
    v_vence := public.plazo_vence_alerta_puerta(new.ocurrida_en);
    insert into public.cola_alerta_puerta (alerta_id, estado, vence_habil_en, calendario_provisional)
    values (new.id, case when v_vence is null then 'SIN_CALENDARIO' else 'PENDIENTE_COACH' end, v_vence,
            v_vence is not null and public.calendario_provisional_alerta_puerta(new.ocurrida_en));
    insert into public.outbox_alerta_puerta (alerta_id, destinatario_id, tipo)
    values (new.id, new.destinatario_id, 'AVISO_COACH');
  end if;
  return new;
end;
$$;
revoke all on function public.encolar_alerta_puerta() from public, anon, authenticated;
create trigger alertas_puerta_encolar after insert on public.alertas_puerta
  for each row execute function public.encolar_alerta_puerta();

-- El suplente lee SOLO alertas escaladas a el (ademas de lo que ya permite 0120).
create function public.alerta_puerta_escalada_a_mi(p_alerta uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.cola_alerta_puerta c
     where c.alerta_id = p_alerta
       and c.estado = 'ESCALADA_SUPLENTE'
       and c.suplente_id = (select auth.uid())
  ) and public.tiene_capacidad('recibir_alerta_puerta');
$$;
revoke all on function public.alerta_puerta_escalada_a_mi(uuid) from public, anon;
grant execute on function public.alerta_puerta_escalada_a_mi(uuid) to authenticated;
create policy alertas_puerta_leer_suplente_escalada on public.alertas_puerta
  for select to authenticated using ((select public.alerta_puerta_escalada_a_mi(id)));

-- El coach asignado, o el suplente al que se escalo, marca la alerta atendida; arranca la retencion.
create function public.atender_alerta_puerta_v2(p_alerta_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_ahora timestamptz := clock_timestamp();
  v_dias integer;
  c public.cola_alerta_puerta;
  v_persona uuid;
begin
  if v_actor is null or p_alerta_id is null then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  select * into c from public.cola_alerta_puerta where alerta_id = p_alerta_id for update;
  if not found then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  select persona_id into v_persona from public.alertas_puerta where id = p_alerta_id;
  if not (public.es_coach_asignado(v_persona)
          or (c.estado = 'ESCALADA_SUPLENTE' and c.suplente_id = v_actor
              and public.tiene_capacidad('recibir_alerta_puerta'))) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if c.estado = 'ATENDIDA' then
    return jsonb_build_object('id', p_alerta_id, 'estado', 'ATENDIDA');
  end if;
  select retencion_dias into v_dias from public.politica_alerta_puerta;
  update public.cola_alerta_puerta
     set estado = 'ATENDIDA', atendida_en = v_ahora, atendida_por = v_actor,
         retener_hasta = v_ahora + make_interval(days => v_dias)
   where alerta_id = p_alerta_id;
  return jsonb_build_object('id', p_alerta_id, 'estado', 'ATENDIDA');
end;
$$;
revoke all on function public.atender_alerta_puerta_v2(uuid) from public, anon;
grant execute on function public.atender_alerta_puerta_v2(uuid) to authenticated;

-- Supervisor: lo invoca el planificador de la app (service_role). No depende del token ni del coach.
create function public.supervisar_alertas_puerta(p_ahora timestamptz default clock_timestamp())
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_suplente uuid;
  v_escaladas integer := 0;
begin
  -- Reintenta las que quedaron sin calendario (puede haberse cargado despues).
  update public.cola_alerta_puerta c
     set vence_habil_en = p.vence, estado = 'PENDIENTE_COACH', calendario_provisional = p.prov
    from (select q.alerta_id, public.plazo_vence_alerta_puerta(a.ocurrida_en) as vence,
                 public.calendario_provisional_alerta_puerta(a.ocurrida_en) as prov
            from public.cola_alerta_puerta q
            join public.alertas_puerta a on a.id = q.alerta_id
           where q.estado = 'SIN_CALENDARIO') p
   where c.alerta_id = p.alerta_id and p.vence is not null;

  select usuario_id into v_suplente from public.capacidades_staff
   where capacidad = 'recibir_alerta_puerta';

  if v_suplente is not null then
    with e as (
      update public.cola_alerta_puerta
         set estado = 'ESCALADA_SUPLENTE', suplente_id = v_suplente, escalada_en = p_ahora
       where estado = 'PENDIENTE_COACH' and vence_habil_en <= p_ahora
       returning alerta_id
    )
    insert into public.outbox_alerta_puerta (alerta_id, destinatario_id, tipo)
    select alerta_id, v_suplente, 'AVISO_SUPLENTE' from e;
    get diagnostics v_escaladas = row_count;
  end if;

  return jsonb_build_object(
    'escaladas', v_escaladas,
    'vencidas_sin_suplente', (select count(*) from public.cola_alerta_puerta
       where estado = 'PENDIENTE_COACH' and vence_habil_en <= p_ahora),
    'sin_calendario', (select count(*) from public.cola_alerta_puerta where estado = 'SIN_CALENDARIO'),
    'con_calendario_provisional', (select count(*) from public.cola_alerta_puerta
       where estado = 'PENDIENTE_COACH' and calendario_provisional),
    'avisos_pendientes', (select count(*) from public.outbox_alerta_puerta where estado = 'PENDIENTE'),
    'avisos_fallidos', (select count(*) from public.outbox_alerta_puerta where estado = 'FALLIDO')
  );
end;
$$;
revoke all on function public.supervisar_alertas_puerta(timestamptz) from public, anon, authenticated;
grant execute on function public.supervisar_alertas_puerta(timestamptz) to service_role;

-- El emisor de avisos confirma entrega o fallo; tras 5 intentos queda FALLIDO y el supervisor lo cuenta.
create function public.marcar_aviso_alerta_puerta(p_outbox_id uuid, p_enviado boolean) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  o public.outbox_alerta_puerta;
begin
  select * into o from public.outbox_alerta_puerta where id = p_outbox_id for update;
  if not found then
    raise exception 'aviso inexistente' using errcode = 'P0002';
  end if;
  if o.estado = 'ENVIADO' then
    return jsonb_build_object('id', o.id, 'estado', o.estado);
  end if;
  if p_enviado then
    update public.outbox_alerta_puerta set estado = 'ENVIADO', enviada_en = clock_timestamp(),
           intentos = intentos + 1 where id = o.id returning * into o;
  else
    update public.outbox_alerta_puerta
       set intentos = intentos + 1,
           estado = case when intentos + 1 >= 5 then 'FALLIDO' else 'PENDIENTE' end
     where id = o.id returning * into o;
  end if;
  return jsonb_build_object('id', o.id, 'estado', o.estado);
end;
$$;
revoke all on function public.marcar_aviso_alerta_puerta(uuid, boolean) from public, anon, authenticated;
grant execute on function public.marcar_aviso_alerta_puerta(uuid, boolean) to service_role;

-- Texto libre del canal privado del carril A (C2). Tabla privada: sin acceso de authenticated; el escritor
-- (RPC del canal privado) y la lectura FALTAN. La alerta y su traza NO se borran nunca por retencion.
create table public.texto_libre_alerta_puerta (
  id uuid primary key default gen_random_uuid(),
  alerta_id uuid not null references public.alertas_puerta(id) on delete cascade,
  contenido text check (contenido is null or length(contenido) between 1 and 20000),
  creado_en timestamptz not null default clock_timestamp(),
  borrado_en timestamptz,
  check ((contenido is null) = (borrado_en is not null))
);
create index texto_libre_alerta_puerta_alerta on public.texto_libre_alerta_puerta(alerta_id)
  where contenido is not null;
alter table public.texto_libre_alerta_puerta enable row level security;
revoke all on public.texto_libre_alerta_puerta from anon, public, authenticated;
grant all on public.texto_libre_alerta_puerta to service_role;

-- Borrado programado (decision de Bryan 16-oct, opcion B): al vencer retener_hasta de una alerta ATENDIDA se
-- borra SOLO el contenido del texto libre; la fila queda con borrado_en. PROVISIONAL (30 dias).
create function public.purgar_texto_libre_alerta_puerta(p_ahora timestamptz default clock_timestamp())
returns integer language plpgsql security definer set search_path = public
as $$
declare
  v_borrados integer;
begin
  update public.texto_libre_alerta_puerta t
     set contenido = null, borrado_en = p_ahora
   where t.contenido is not null
     and t.alerta_id in (select c.alerta_id from public.cola_alerta_puerta c
                          where c.estado = 'ATENDIDA' and c.retener_hasta <= p_ahora);
  get diagnostics v_borrados = row_count;
  return v_borrados;
end;
$$;
revoke all on function public.purgar_texto_libre_alerta_puerta(timestamptz) from public, anon, authenticated;
grant execute on function public.purgar_texto_libre_alerta_puerta(timestamptz) to service_role;

comment on table public.cola_alerta_puerta is
  'Cola privada de alertas de la puerta: estado, plazo habil original y retencion. Sin contenido libre (vive en texto_libre_alerta_puerta). Retencion PROVISIONAL.';
commit;
