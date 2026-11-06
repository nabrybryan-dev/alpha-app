-- 0119: historial persona-coach, aislamiento y autorizacion de reasignaciones.
-- Propuesta, no aplicada. Solo usa identidades sinteticas en test/219.
begin;

create table if not exists public.asignaciones_coach (
  persona_id uuid not null references public.usuarios_app(id) on delete cascade,
  coach_id uuid not null references public.usuarios_app(id) on delete restrict,
  asignado_desde timestamptz not null default transaction_timestamp(),
  asignado_hasta timestamptz,
  cambiado_por uuid references public.usuarios_app(id) on delete set null,
  primary key (persona_id, asignado_desde),
  check (asignado_hasta is null or asignado_hasta > asignado_desde)
);

-- Bryan registra aqui, por via administrativa de confianza, cada autorizacion escrita.
create table if not exists public.autorizaciones_reasignacion_coach (
  usuario_id uuid primary key references public.usuarios_app(id) on delete cascade,
  autorizado_por uuid not null references public.usuarios_app(id) on delete restrict,
  autorizacion_ref text not null check (length(btrim(autorizacion_ref)) between 1 and 200),
  autorizada_en timestamptz not null default transaction_timestamp(),
  revocada_por uuid references public.usuarios_app(id) on delete set null,
  revocada_en timestamptz,
  check ((revocada_en is null) = (revocada_por is null))
);
alter table public.autorizaciones_reasignacion_coach enable row level security;
revoke all on public.autorizaciones_reasignacion_coach from anon, public, authenticated;
grant all on public.autorizaciones_reasignacion_coach to service_role;

create unique index if not exists asignaciones_coach_actual_unica
  on public.asignaciones_coach(persona_id) where asignado_hasta is null;
create index if not exists asignaciones_coach_por_coach
  on public.asignaciones_coach(coach_id, asignado_desde desc);

alter table public.asignaciones_coach enable row level security;
revoke all on public.asignaciones_coach from anon, public, authenticated;
grant select on public.asignaciones_coach to authenticated;
grant all on public.asignaciones_coach to service_role;

create policy asignaciones_coach_leer on public.asignaciones_coach
  for select to authenticated
  using (
    persona_id = (select auth.uid())
    or coach_id = (select auth.uid())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

create or replace function public.es_coach_asignado(p_persona_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_persona_id is not null
    and auth.uid() is not null
    and exists (
      select 1 from public.asignaciones_coach a
       where a.persona_id = p_persona_id
         and a.coach_id = auth.uid()
         and a.asignado_hasta is null
    );
$$;
revoke all on function public.es_coach_asignado(uuid) from public, anon;
grant execute on function public.es_coach_asignado(uuid) to authenticated, service_role;

create or replace function public.cambiar_coach_asignado(p_persona_id uuid, p_coach_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_ahora timestamptz;
begin
  if v_actor is null or not (
    public.tiene_capacidad('autorizar_excepcion')
    or exists (
      select 1 from public.autorizaciones_reasignacion_coach a
       where a.usuario_id = v_actor and a.revocada_en is null
    )
  ) then
    raise exception 'se requiere autoridad de Bryan o autorizacion escrita vigente' using errcode = '42501';
  end if;
  if p_persona_id is null then
    raise exception 'falta la persona' using errcode = '22023';
  end if;

  perform 1 from public.usuarios_app where id = p_persona_id for update;
  if not found then
    raise exception 'la persona no existe' using errcode = 'P0002';
  end if;
  v_ahora := clock_timestamp();
  if p_coach_id is not null and not exists (
    select 1 from public.usuarios_app u
     where u.id = p_coach_id
       and (u.rol = 'coach' or exists (
         select 1 from public.capacidades_staff c
          where c.usuario_id = u.id and c.capacidad = 'puesto_de_coach'
       ))
  ) then
    raise exception 'el destino no ocupa un puesto de coach' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.asignaciones_coach
     where persona_id = p_persona_id and asignado_hasta is null and coach_id = p_coach_id
  ) then
    return;
  end if;

  update public.asignaciones_coach
     set asignado_hasta = v_ahora
   where persona_id = p_persona_id and asignado_hasta is null;

  if p_coach_id is not null then
    insert into public.asignaciones_coach(persona_id, coach_id, asignado_desde, cambiado_por)
    values (p_persona_id, p_coach_id, v_ahora, v_actor);
  end if;
end;
$$;
revoke all on function public.cambiar_coach_asignado(uuid, uuid) from public, anon;
grant execute on function public.cambiar_coach_asignado(uuid, uuid) to authenticated, service_role;

-- Las tablas con usuario_id quedan limitadas al coach asignado; capacidades staff se conservan.
drop policy if exists alertas_coach_leer on public.alertas_coach;
create policy alertas_coach_leer on public.alertas_coach for select to authenticated
  using (
    (select public.es_coach_asignado(usuario_id))
    or (select public.tiene_capacidad('leer_entrenamiento'))
    or (select public.tiene_capacidad('detener_publicacion'))
  );

drop policy if exists contexto_clinico_leer on public.contexto_clinico_firmado;
create policy contexto_clinico_leer on public.contexto_clinico_firmado for select to authenticated
  using (
    (select public.es_coach_asignado(usuario_id))
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

drop policy if exists registro_entreno_leer on public.registro_entreno;
create policy registro_entreno_leer on public.registro_entreno for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.es_coach_asignado(usuario_id))
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

drop policy if exists expediente_mensajes_privados_leer on public.expediente_mensajes_privados;
create policy expediente_mensajes_privados_leer on public.expediente_mensajes_privados
  for select to authenticated
  using (
    (select auth.uid()) = persona_id
    or (select public.es_coach_asignado(persona_id))
  );

-- 0117 registra candidatos tecnicos sin persona_id: su lectura por coach sigue siendo global y tecnica.

-- Los RPC con acceso a datos de una persona verifican su asignacion actual.
create or replace function public.anular_bloqueo(
  p_alerta_id uuid,
  p_accion    text,
  p_nota      text default null
)
returns public.alertas_coach
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_nota  text := nullif(btrim(p_nota), '');
  v_fila  public.alertas_coach;
  v_alto  boolean;
begin
  -- S3 · la puerta general.
  if v_actor is null
     or not ((public.es_coach() and exists (select 1 from public.alertas_coach a where a.id = p_alerta_id and public.es_coach_asignado(a.usuario_id))) or public.tiene_capacidad('detener_publicacion')) then
    raise exception 'solo quien tiene permiso de detener o reanudar la publicación anula un bloqueo'
      using errcode = '42501';
  end if;
  if p_accion is null
     or p_accion not in ('continuar_ultima_carga', 'continuar_con_ajuste', 'mantener_y_preguntar', 'mantener_y_derivar') then
    raise exception 'la acción es una de: continuar_ultima_carga, continuar_con_ajuste, mantener_y_preguntar, mantener_y_derivar'
      using errcode = '22023';
  end if;
  if v_nota is not null and length(v_nota) > 500 then
    raise exception 'la nota va de 1 a 500 caracteres' using errcode = '22023';
  end if;

  -- `for update`: si dos personas atienden a la vez, la segunda espera y luego ve que ya está atendida.
  select * into v_fila from public.alertas_coach where id = p_alerta_id for update;
  if not found then
    raise exception 'la alerta no existe' using errcode = 'P0002';
  end if;
  if v_fila.atendida_en is not null then
    raise exception 'la alerta ya fue atendida' using errcode = '22023';
  end if;

  -- S3 · riesgo alto: además, la capacidad de excepción (la tiene Bryan).
  v_alto := v_fila.nivel = 'agudo' or v_fila.tipo in ('parada_cardiaca', 'piso_agudo');
  if v_alto and not public.tiene_capacidad('autorizar_excepcion') then
    raise exception 'una alerta de riesgo alto la atiende quien tiene autorizar_excepcion'
      using errcode = '42501';
  end if;

  -- La acción debe ser una de las que la alerta ofrece.
  if not (p_accion = any (v_fila.acciones_permitidas)) then
    raise exception 'esa acción no está permitida para esta alerta' using errcode = '22023';
  end if;

  -- S1 · anular no salta la firma exigida.
  if v_fila.exige_firma and p_accion like 'continuar\_%' then
    raise exception 'este bloqueo exige firma: hace falta la firma antes de continuar' using errcode = 'P0001';
  end if;
  -- S2 · el piso agudo (R7) no se apaga con un toque.
  if v_fila.nivel = 'agudo' and p_accion like 'continuar\_%' then
    raise exception 'señal aguda: no se continúa desde aquí; decide una persona por reportar riesgo o consulta'
      using errcode = 'P0001';
  end if;

  -- La orden (registro de quién, cuándo y qué) y la marca de atendida, en la misma transacción.
  insert into public.ordenes (actor_id, tipo, objetivo, idempotency_key)
  values (
    v_actor,
    'anular_bloqueo',
    jsonb_build_object(
      'alerta_id', v_fila.id,
      'usuario_id', v_fila.usuario_id,
      'semana_inicio', v_fila.semana_inicio,
      'accion', p_accion,
      'nota', v_nota
    ),
    'anular|' || v_fila.usuario_id || '|' || v_fila.semana_inicio || '|' || v_fila.id || '|' || v_actor
  );

  update public.alertas_coach
     set atendida_en  = now(),
         atendida_por = v_actor,
         accion       = p_accion,
         nota         = v_nota
   where id = p_alerta_id
   returning * into v_fila;

  return v_fila;
end;
$$;
create or replace function public.firmar_contexto_clinico(
  p_usuario_id                uuid,
  p_zona                      text,
  p_zona_nota                 text default null,
  p_profesionales_a_cargo     boolean default false,
  p_profesionales_nota        text default null,
  p_dolor_base                jsonb default '[]'::jsonb,
  p_sustancias_autodeclaradas jsonb default '[]'::jsonb,
  p_revisar_antes_de          date default null
)
returns public.contexto_clinico_firmado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_fila  public.contexto_clinico_firmado;
begin
  -- La zona es criterio clínico: no basta con leer la consola.
  if v_actor is null
     or not ((public.es_coach() and public.es_coach_asignado(p_usuario_id)) or public.tiene_capacidad('autorizar_excepcion')) then
    raise exception 'solo el coach o quien tiene autorizar_excepcion firma el contexto clínico'
      using errcode = '42501';
  end if;
  if p_usuario_id is null or not exists (select 1 from public.usuarios_app where id = p_usuario_id) then
    raise exception 'la persona no existe' using errcode = 'P0002';
  end if;
  if p_zona is null or p_zona not in ('verde', 'amarillo', 'rojo', 'no_determinada') then
    raise exception 'la zona es verde, amarillo, rojo o no_determinada' using errcode = '22023';
  end if;
  if p_dolor_base is null or jsonb_typeof(p_dolor_base) <> 'array'
     or p_sustancias_autodeclaradas is null or jsonb_typeof(p_sustancias_autodeclaradas) <> 'array' then
    raise exception 'dolor base y sustancias van como lista' using errcode = '22023';
  end if;

  -- Los CHECK de la tabla rechazan dosis/vía/fuente; aquí se avisa con un mensaje que se entienda.
  if jsonb_path_exists(p_sustancias_autodeclaradas,
       '$[*] ? (@.type() != "object" || !exists(@.nombre) || exists(@.dosis) || exists(@.via) || exists(@."vía") || exists(@.fuente))') then
    raise exception 'cada sustancia lleva su nombre y nunca dosis, vía ni fuente' using errcode = '22023';
  end if;

  insert into public.contexto_clinico_firmado as c (
    usuario_id, zona, zona_firmada_por, zona_firmada_en, zona_nota,
    profesionales_a_cargo, profesionales_nota, dolor_base, sustancias_autodeclaradas,
    revisar_antes_de, actualizado_en
  ) values (
    p_usuario_id, p_zona, v_actor, now(), nullif(btrim(p_zona_nota), ''),
    coalesce(p_profesionales_a_cargo, false), nullif(btrim(p_profesionales_nota), ''),
    p_dolor_base, p_sustancias_autodeclaradas,
    p_revisar_antes_de, now()
  )
  on conflict (usuario_id) do update set
    zona                      = excluded.zona,
    zona_firmada_por          = excluded.zona_firmada_por,
    zona_firmada_en           = excluded.zona_firmada_en,
    zona_nota                 = excluded.zona_nota,
    profesionales_a_cargo     = excluded.profesionales_a_cargo,
    profesionales_nota        = excluded.profesionales_nota,
    dolor_base                = excluded.dolor_base,
    sustancias_autodeclaradas = excluded.sustancias_autodeclaradas,
    revisar_antes_de          = excluded.revisar_antes_de,
    actualizado_en            = excluded.actualizado_en
  returning * into v_fila;

  return v_fila;
end;
$$;

commit;
