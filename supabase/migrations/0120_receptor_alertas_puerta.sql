-- 0120: ingreso acotado de alertas de sistema, sin contenido ni identidad libre.
-- Propuesta, NO APLICADA. No provisiona credenciales ni asigna suplentes reales.
begin;

-- Capacidad explícita para configurar un único suplente. No se otorga a ninguna cuenta aquí.
do $$
declare
  v_nombre text;
  v_def text;
  v_lista text[];
begin
  select conname, pg_get_constraintdef(oid) into v_nombre, v_def
    from pg_constraint
   where conrelid = 'public.capacidades_staff'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%capacidad%'
   limit 1;
  if v_nombre is null then
    raise exception 'no se encontró el check de capacidades_staff';
  end if;
  select array_agg(distinct x order by x) into v_lista
    from (
      select m[1] as x from regexp_matches(v_def, '''([a-z_]+)''', 'g') as t(m)
      union
      select regexp_split_to_table(substring(v_def from '''\{([a-z_,]+)\}'''), ',')
    ) s
   where x is not null;
  v_lista := array(select distinct x from unnest(v_lista || array['recibir_alerta_puerta']) as x order by x);
  execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  execute format(
    'alter table public.capacidades_staff add constraint capacidades_staff_capacidad_check check (capacidad in (%s))',
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(v_lista) as x)
  );
end
$$;

create unique index if not exists capacidades_staff_un_suplente_alerta_puerta
  on public.capacidades_staff(capacidad) where capacidad = 'recibir_alerta_puerta';

create table if not exists public.casos_alerta_puerta (
  caso_id text primary key check (caso_id ~ '^caso-[a-z0-9-]{1,64}$'),
  persona_id uuid not null references public.usuarios_app(id) on delete cascade,
  creado_por uuid not null references public.usuarios_app(id) on delete restrict,
  creado_en timestamptz not null default now()
);
alter table public.casos_alerta_puerta enable row level security;
revoke all on public.casos_alerta_puerta from anon, public, authenticated;
grant all on public.casos_alerta_puerta to service_role;

create or replace function public.reservar_caso_alerta_puerta(p_persona_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_caso text := 'caso-' || replace(gen_random_uuid()::text, '-', '');
begin
  if v_actor is null or p_persona_id is null
     or not public.es_coach_asignado(p_persona_id) then
    raise exception 'solo el coach actual puede reservar el caso' using errcode = '42501';
  end if;
  insert into public.casos_alerta_puerta(caso_id, persona_id, creado_por)
  values (v_caso, p_persona_id, v_actor);
  return v_caso;
end;
$$;
revoke all on function public.reservar_caso_alerta_puerta(uuid) from public, anon;
grant execute on function public.reservar_caso_alerta_puerta(uuid) to authenticated;

create table if not exists public.alertas_puerta (
  id uuid primary key,
  caso_id text not null check (caso_id ~ '^caso-[a-z0-9-]{1,64}$'),
  persona_id uuid not null references public.usuarios_app(id) on delete cascade,
  destinatario_id uuid not null references public.usuarios_app(id) on delete restrict,
  destinatario_tipo text not null check (destinatario_tipo in ('COACH','SUPLENTE')),
  causa text not null check (causa in ('telefono','correo','documento','arroba','tamano')),
  ocurrida_en timestamptz not null,
  plazo_horas_habiles smallint not null check (plazo_horas_habiles = 4),
  suplente text not null check (suplente = 'Manuela'),
  estado text not null default 'REGISTRADA' check (estado = 'REGISTRADA'),
  registrada_en timestamptz not null default now()
);
create index if not exists alertas_puerta_destinatario_recientes
  on public.alertas_puerta(destinatario_id, registrada_en desc);
alter table public.alertas_puerta enable row level security;
revoke all on public.alertas_puerta from anon, public, authenticated;
grant select on public.alertas_puerta to authenticated;
grant all on public.alertas_puerta to service_role;
drop policy if exists alertas_puerta_leer_destinatario on public.alertas_puerta;
create policy alertas_puerta_leer_destinatario on public.alertas_puerta
  for select to authenticated using (
    (select public.es_coach_asignado(persona_id))
    or (destinatario_tipo = 'SUPLENTE' and destinatario_id = (select auth.uid())
        and (select public.tiene_capacidad('recibir_alerta_puerta')))
  );

create or replace function public.recibir_alerta_puerta(
  p_id uuid,
  p_caso_id text,
  p_causa text,
  p_ocurrida_en timestamptz,
  p_plazo_horas_habiles integer,
  p_suplente text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_persona uuid;
  v_coach uuid;
  v_destinatario uuid;
  v_tipo text;
  v_existente public.alertas_puerta;
begin
  if p_id is null or p_caso_id is null or p_caso_id !~ '^caso-[a-z0-9-]{1,64}$'
     or p_causa is null or p_causa not in ('telefono','correo','documento','arroba','tamano')
     or p_ocurrida_en is null or p_plazo_horas_habiles is distinct from 4
     or p_suplente is distinct from 'Manuela' then
    raise exception 'payload fuera del contrato P2a' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into v_existente from public.alertas_puerta where id = p_id;
  if found then
    if v_existente.caso_id is distinct from p_caso_id
       or v_existente.causa is distinct from p_causa
       or v_existente.ocurrida_en is distinct from p_ocurrida_en
       or v_existente.plazo_horas_habiles is distinct from p_plazo_horas_habiles
       or v_existente.suplente is distinct from p_suplente then
      raise exception 'id reutilizado con datos distintos' using errcode = '22023';
    end if;
    return jsonb_build_object('id', p_id, 'estado', 'REGISTRADA');
  end if;

  select persona_id into v_persona from public.casos_alerta_puerta
   where caso_id = p_caso_id for update;
  if not found then
    raise exception 'caso sin mapeo registrado' using errcode = 'P0002';
  end if;
  -- Serializa recepción con cambios de asignación para elegir al coach vigente.
  perform 1 from public.usuarios_app where id = v_persona for update;
  select coach_id into v_coach from public.asignaciones_coach
   where persona_id = v_persona and asignado_hasta is null;
  if found then
    v_destinatario := v_coach;
    v_tipo := 'COACH';
  else
    select usuario_id into v_destinatario from public.capacidades_staff
     where capacidad = 'recibir_alerta_puerta';
    if not found then
      raise exception 'suplente Manuela no configurada' using errcode = 'P0002';
    end if;
    v_tipo := 'SUPLENTE';
  end if;
  insert into public.alertas_puerta
    (id, caso_id, persona_id, destinatario_id, destinatario_tipo, causa, ocurrida_en,
     plazo_horas_habiles, suplente)
  values
    (p_id, p_caso_id, v_persona, v_destinatario, v_tipo, p_causa, p_ocurrida_en,
     p_plazo_horas_habiles, p_suplente);
  return jsonb_build_object('id', p_id, 'estado', 'REGISTRADA');
end;
$$;
revoke all on function public.recibir_alerta_puerta(uuid, text, text, timestamptz, integer, text) from public, anon, authenticated;
grant execute on function public.recibir_alerta_puerta(uuid, text, text, timestamptz, integer, text) to service_role;

comment on table public.alertas_puerta is
  'Registro sin contenido de alertas de ingreso. REGISTRADA confirma persistencia; no afirma notificación o lectura.';
comment on function public.recibir_alerta_puerta(uuid, text, text, timestamptz, integer, text) is
  'RPC interno del receptor con credencial acotada; solo service_role. La Edge Function nunca devuelve datos personales.';

commit;



