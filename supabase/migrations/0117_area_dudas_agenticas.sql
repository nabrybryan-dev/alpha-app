-- Área de dudas agénticas · contrato propuesto v1.
-- ESCRITA, NO APLICADA. No contiene filas ni asigna capacidades a cuentas reales.
-- El contenido vive fuera de esta tabla: aquí solo hay códigos, UUID opacos y hashes.

begin;

create extension if not exists pgcrypto with schema extensions;
set local search_path = public, extensions;

create or replace function public.duda_agentica_objeto_claves(p_obj jsonb, p_claves text[])
returns boolean language sql immutable set search_path = pg_catalog
as $$
  select jsonb_typeof(p_obj) = 'object'
     and (select array_agg(k order by k) from jsonb_object_keys(p_obj) k) = p_claves;
$$;

create or replace function public.duda_agentica_motivos_validos(p_motivos text[], p_estado text)
returns boolean language sql immutable set search_path = pg_catalog
as $$
  select cardinality(p_motivos) <= 8
    and p_motivos <@ array['DUDA','FUENTE_FALTANTE','DESACUERDO','MUESTRA_INSUFICIENTE','ACUERDO_INSUFICIENTE',
                           'FRONTERA_SELLADA','AUDITORIA','ERROR_EVALUADOR']::text[]
    and cardinality(p_motivos) = (select count(distinct m)::integer from unnest(p_motivos) m)
    and (p_estado not in ('PENDIENTE_HUMANO','RECHAZADA') or cardinality(p_motivos) > 0);
$$;

-- Quien reciba esta capacidad tendrá permiso explícito para decidir; la migración no se la concede a nadie.
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
    raise exception 'no se encontró el check de capacidades_staff: no se reescribe a ciegas';
  end if;
  select array_agg(distinct x order by x) into v_lista
    from (
      select m[1] as x from regexp_matches(v_def, '''([a-z_]+)''', 'g') as t(m)
      union
      select regexp_split_to_table(substring(v_def from '''\{([a-z_,]+)\}'''), ',')
    ) s
   where x is not null;
  v_lista := array(select distinct x from unnest(v_lista || array['decidir_duda_agentica', 'decidir_duda_agentica_delegada']) as x order by x);
  execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  execute format(
    'alter table public.capacidades_staff add constraint capacidades_staff_capacidad_check check (capacidad in (%s))',
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(v_lista) as x)
  );
end
$$;

create or replace function public.duda_agentica_refs_validas(p_refs jsonb, p_motivos text[])
returns boolean language sql immutable set search_path = pg_catalog
as $$
  select jsonb_typeof(p_refs) = 'array'
     and jsonb_array_length(p_refs) between 0 and 16
     and (jsonb_array_length(p_refs) > 0 or 'FUENTE_FALTANTE' = any(p_motivos))
     and not exists (
       select 1 from jsonb_array_elements(p_refs) r
        where jsonb_typeof(r) <> 'object'
           or (select array_agg(k order by k) from jsonb_object_keys(r) k) <> array['corpus_id','sha256','version']::text[]
           or coalesce(r->>'corpus_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           or coalesce(r->>'sha256','') !~ '^[0-9a-f]{64}$'
           or coalesce(r->>'version','') !~ '^[1-9][0-9]*$'
     );
$$;

create or replace function public.duda_agentica_medicion_valida(p_medicion jsonb)
returns boolean language sql immutable set search_path = pg_catalog
as $$
  select p_medicion is null or (
    jsonb_typeof(p_medicion) = 'object'
    and public.duda_agentica_objeto_claves(p_medicion,
      array['abstenciones','banco_sha256','evaluador_id','evaluador_version','falsos_permisos','inferior_wilson','k','n']::text[])
    and coalesce(p_medicion->>'banco_sha256','') ~ '^[0-9a-f]{64}$'
    and coalesce(p_medicion->>'evaluador_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and coalesce(p_medicion->>'evaluador_version','') ~ '^[1-9][0-9]*$'
    and coalesce(p_medicion->>'n','') ~ '^(0|[1-9][0-9]*)$'
    and coalesce(p_medicion->>'k','') ~ '^(0|[1-9][0-9]*)$'
    and coalesce(p_medicion->>'abstenciones','') ~ '^(0|[1-9][0-9]*)$'
    and coalesce(p_medicion->>'falsos_permisos','') ~ '^(0|[1-9][0-9]*)$'
    and (p_medicion->>'k')::integer <= (p_medicion->>'n')::integer
    and (p_medicion->>'abstenciones')::integer <= (p_medicion->>'n')::integer
    and (p_medicion->>'falsos_permisos')::integer <= (p_medicion->>'n')::integer
    and ((p_medicion->>'n')::integer = 0 and p_medicion->'inferior_wilson' = 'null'::jsonb
      or (p_medicion->>'n')::integer > 0 and jsonb_typeof(p_medicion->'inferior_wilson') in ('number','null')
        and (p_medicion->'inferior_wilson' = 'null'::jsonb or (p_medicion->>'inferior_wilson')::numeric between 0 and 1))
  );
$$;

create or replace function public.duda_agentica_medicion_categoria_valida(p_lista jsonb)
returns boolean language sql immutable set search_path = pg_catalog
as $$
  select jsonb_typeof(p_lista) = 'array'
    and jsonb_array_length(p_lista) <= 6
    and not exists (
      select 1 from jsonb_array_elements(p_lista) m
       where not public.duda_agentica_objeto_claves(m, array['categoria','inferior_wilson','k','n']::text[])
          or coalesce(m->>'categoria','') not in ('ORTOGRAFIA','FORMATO','INDICE','EJEMPLO_SINTETICO','DUPLICADO_LITERAL','FUERA_LISTA')
          or coalesce(m->>'n','') !~ '^(0|[1-9][0-9]*)$'
          or coalesce(m->>'k','') !~ '^(0|[1-9][0-9]*)$'
          or (m->>'k')::integer > (m->>'n')::integer
          or ((m->>'n')::integer = 0 and m->'inferior_wilson' <> 'null'::jsonb)
          or ((m->>'n')::integer > 0 and jsonb_typeof(m->'inferior_wilson') not in ('number','null'))
          or (m->'inferior_wilson' <> 'null'::jsonb and (m->>'inferior_wilson')::numeric not between 0 and 1)
    )
    and (select count(*) from jsonb_array_elements(p_lista)) =
        (select count(distinct m->>'categoria') from jsonb_array_elements(p_lista) m);
$$;

create table if not exists public.dudas_agenticas (
  duda_id uuid primary key default gen_random_uuid(),
  contrato_version smallint not null default 1 check (contrato_version = 1),
  candidato_id uuid not null,
  candidato_version integer not null check (candidato_version >= 1),
  revision integer not null default 1 check (revision >= 1),
  candidato_sha256 text not null check (candidato_sha256 ~ '^[0-9a-f]{64}$'),
  anterior_sha256 text check (anterior_sha256 is null or anterior_sha256 ~ '^[0-9a-f]{64}$'),
  artefacto_ref uuid not null,
  categoria text not null check (categoria in ('ORTOGRAFIA','FORMATO','INDICE','EJEMPLO_SINTETICO','DUPLICADO_LITERAL','FUERA_LISTA')),
  resumen_codigo text not null check (resumen_codigo in ('CORRECCION_DOCUMENTAL','NUEVO_EJEMPLO','NUEVO_INDICE','POSIBLE_DUPLICADO','CAMBIO_NO_CLASIFICADO')),
  motivos text[] not null default '{}',
  referencias jsonb not null default '[]'::jsonb,
  medicion jsonb,
  medicion_categoria jsonb not null default '[]'::jsonb check (public.duda_agentica_medicion_categoria_valida(medicion_categoria)),
  auditoria_ref uuid,
  evaluacion_ref uuid,
  estado text not null check (estado in ('NUEVA','EN_REVISION','VALIDADA_AGENTE','PENDIENTE_HUMANO','APROBADA_HUMANO','RECHAZADA','INVALIDADA')),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  responsable_rol text not null check (responsable_rol in ('BRYAN','MANUELA')),
  decision jsonb,
  idempotencia text not null,
  constraint dudas_agenticas_motivos check (public.duda_agentica_motivos_validos(motivos, estado)),
  constraint dudas_agenticas_version_anterior check (
    (candidato_version = 1 and anterior_sha256 is null)
    or (candidato_version > 1 and anterior_sha256 is not null)
  ),
  constraint dudas_agenticas_referencias check (public.duda_agentica_refs_validas(referencias, motivos)),
  constraint dudas_agenticas_medicion check (public.duda_agentica_medicion_valida(medicion)),
  constraint dudas_agenticas_idempotencia unique (idempotencia),
  constraint dudas_agenticas_version_hash unique (candidato_id, candidato_version, candidato_sha256),
  constraint dudas_agenticas_decision check (
    decision is null or (
      public.duda_agentica_objeto_claves(decision, array['at','candidato_sha256','codigo','decisor_rol','razon_codigo']::text[])
      and decision->>'codigo' in ('APROBAR_VERSION','RECHAZAR_VERSION','PEDIR_FUENTE')
      and ((decision->>'codigo' = 'APROBAR_VERSION' and decision->>'razon_codigo' = 'DOCUMENTAL_CONFORME')
        or (decision->>'codigo' <> 'APROBAR_VERSION' and decision->>'razon_codigo' <> 'DOCUMENTAL_CONFORME'))
      and decision->>'decisor_rol' in ('BRYAN','MANUELA')
      and decision->>'candidato_sha256' = candidato_sha256
      and decision->>'at' ~ '^\d{4}-\d{2}-\d{2}T.*Z$'
      and decision->>'razon_codigo' in ('DUDA','FUENTE_FALTANTE','DESACUERDO','MUESTRA_INSUFICIENTE','ACUERDO_INSUFICIENTE',
        'FRONTERA_SELLADA','AUDITORIA','ERROR_EVALUADOR','DOCUMENTAL_CONFORME')
    )
  ),
  constraint dudas_agenticas_decision_estado check (
    (estado = 'APROBADA_HUMANO' and decision->>'codigo' = 'APROBAR_VERSION')
    or (estado = 'RECHAZADA' and decision->>'codigo' = 'RECHAZAR_VERSION')
    or estado = 'INVALIDADA'
    or (estado = 'PENDIENTE_HUMANO' and (decision is null or decision->>'codigo' = 'PEDIR_FUENTE'))
    or (estado in ('NUEVA','EN_REVISION','VALIDADA_AGENTE') and decision is null)
  )
);

-- Serialize fixed fields; jsonb_build_object is STABLE and cannot feed a generated column.
-- UUID, integers, and the hexadecimal hash cannot contain the separator.
create or replace function public.duda_agentica_idempotencia_set()
returns trigger language plpgsql set search_path = pg_catalog
as $$
begin
  new.idempotencia := encode(extensions.digest(
    convert_to(new.candidato_id::text || '|' || new.candidato_version::text || '|' ||
               new.candidato_sha256 || '|' || new.contrato_version::text, 'UTF8'),
    'sha256'
  ), 'hex');
  return new;
end;
$$;

create trigger dudas_agenticas_idempotencia_set
before insert or update on public.dudas_agenticas
for each row execute function public.duda_agentica_idempotencia_set();

-- Registro append-only de decisiones e invalidaciones. La tarjeta conserva la última decisión como proyección;
-- cada recibo se inserta en la misma transacción y no hay privilegio de edición/borrado para sesiones.
create table if not exists public.dudas_agenticas_recibos (
  recibo_id uuid primary key default gen_random_uuid(),
  duda_id uuid not null references public.dudas_agenticas(duda_id),
  revision integer not null check (revision >= 1),
  tipo text not null check (tipo in ('DECISION','INVALIDACION_HASH')),
  codigo text check (codigo is null or codigo in ('APROBAR_VERSION','RECHAZAR_VERSION','PEDIR_FUENTE')),
  decisor_rol text not null check (decisor_rol in ('BRYAN','MANUELA')),
  sha256_esperado text not null check (sha256_esperado ~ '^[0-9a-f]{64}$'),
  sha256_actual text not null check (sha256_actual ~ '^[0-9a-f]{64}$'),
  razon_codigo text,
  registrado_at timestamptz not null default now(),
  unique (duda_id, revision),
  check ((tipo = 'DECISION' and codigo is not null and sha256_esperado = sha256_actual and razon_codigo is not null)
      or (tipo = 'INVALIDACION_HASH' and codigo is null and sha256_esperado <> sha256_actual and razon_codigo is null))
);

comment on table public.dudas_agenticas is
  'Tarjetas técnicas sin texto libre ni identidad personal; la decisión no activa ni publica candidatos. Contrato propuesto v1.';

alter table public.dudas_agenticas enable row level security;
drop policy if exists dudas_agenticas_leer on public.dudas_agenticas;
create policy dudas_agenticas_leer on public.dudas_agenticas for select to authenticated
  using ((select public.es_coach()) or (select public.tiene_capacidad('leer_entrenamiento')));
revoke all on public.dudas_agenticas from anon, public, authenticated;
grant select on public.dudas_agenticas to authenticated;
grant all on public.dudas_agenticas to service_role;
alter table public.dudas_agenticas_recibos enable row level security;
drop policy if exists dudas_agenticas_recibos_leer on public.dudas_agenticas_recibos;
create policy dudas_agenticas_recibos_leer on public.dudas_agenticas_recibos for select to authenticated
  using ((select public.es_coach()) or (select public.tiene_capacidad('leer_entrenamiento')));
revoke all on public.dudas_agenticas_recibos from anon, public, authenticated;
grant select on public.dudas_agenticas_recibos to authenticated;
grant select, insert on public.dudas_agenticas_recibos to service_role;

create or replace function public.decidir_duda_agentica(
  p_duda_id uuid,
  p_revision integer,
  p_sha256_esperado text,
  p_codigo text,
  p_razon_codigo text
)
returns public.dudas_agenticas
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_rol text;
  v_fila public.dudas_agenticas;
  v_estado text;
begin
  if v_actor is null then
    raise exception 'se requiere una sesión autenticada' using errcode = '42501';
  end if;
  if public.tiene_capacidad('decidir_duda_agentica') then
    v_rol := 'BRYAN';
  elsif public.tiene_capacidad('decidir_duda_agentica_delegada') then
    v_rol := 'MANUELA';
  else
    raise exception 'sin capacidad para decidir dudas agénticas' using errcode = '42501';
  end if;
  if p_codigo is null or p_razon_codigo is null
     or p_codigo not in ('APROBAR_VERSION','RECHAZAR_VERSION','PEDIR_FUENTE')
     or p_razon_codigo not in ('DUDA','FUENTE_FALTANTE','DESACUERDO','MUESTRA_INSUFICIENTE','ACUERDO_INSUFICIENTE',
                               'FRONTERA_SELLADA','AUDITORIA','ERROR_EVALUADOR','DOCUMENTAL_CONFORME') then
    raise exception 'decisión o motivo fuera del contrato' using errcode = '22023';
  end if;
  if p_sha256_esperado is null or p_sha256_esperado !~ '^[0-9a-f]{64}$' then
    raise exception 'hash esperado fuera del contrato' using errcode = '22023';
  end if;
  if p_codigo = 'APROBAR_VERSION' and p_razon_codigo <> 'DOCUMENTAL_CONFORME' then
    raise exception 'aprobar exige DOCUMENTAL_CONFORME' using errcode = '22023';
  end if;

  select * into v_fila from public.dudas_agenticas where duda_id = p_duda_id for update;
  if not found then raise exception 'la duda no existe' using errcode = 'P0002'; end if;

  -- La vista quedó fijada a otros bytes: invalida en servidor y devuelve el estado nuevo.
  if p_sha256_esperado is distinct from v_fila.candidato_sha256 then
    if v_fila.estado = 'INVALIDADA' then return v_fila; end if;
    insert into public.dudas_agenticas_recibos
      (duda_id,revision,tipo,decisor_rol,sha256_esperado,sha256_actual)
    values (p_duda_id,v_fila.revision,'INVALIDACION_HASH',v_rol,p_sha256_esperado,v_fila.candidato_sha256);
    update public.dudas_agenticas set estado = 'INVALIDADA', revision = revision + 1, actualizado_at = now()
     where duda_id = p_duda_id returning * into v_fila;
    return v_fila;
  end if;
  if p_revision is distinct from v_fila.revision then
    raise exception 'revisión obsoleta; vuelve a cargar la tarjeta' using errcode = '40001';
  end if;
  if v_fila.estado <> 'PENDIENTE_HUMANO' then
    raise exception 'estado inválido para una decisión humana' using errcode = '22023';
  end if;
  if p_codigo = 'RECHAZAR_VERSION' and not (p_razon_codigo = any(v_fila.motivos)) then
    raise exception 'el motivo de rechazo debe estar en los motivos de la tarjeta' using errcode = '22023';
  end if;
  if p_codigo = 'PEDIR_FUENTE' and p_razon_codigo <> 'FUENTE_FALTANTE' then
    raise exception 'pedir fuente exige FUENTE_FALTANTE' using errcode = '22023';
  end if;

  v_estado := case p_codigo when 'APROBAR_VERSION' then 'APROBADA_HUMANO'
                           when 'RECHAZAR_VERSION' then 'RECHAZADA'
                           else 'PENDIENTE_HUMANO' end;
  insert into public.dudas_agenticas_recibos
    (duda_id,revision,tipo,codigo,decisor_rol,sha256_esperado,sha256_actual,razon_codigo)
  values (p_duda_id,v_fila.revision,'DECISION',p_codigo,v_rol,v_fila.candidato_sha256,v_fila.candidato_sha256,p_razon_codigo);
  update public.dudas_agenticas
     set estado = v_estado,
         revision = revision + 1,
         actualizado_at = now(),
         decision = jsonb_build_object('codigo', p_codigo, 'decisor_rol', v_rol, 'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                                       'candidato_sha256', candidato_sha256, 'razon_codigo', p_razon_codigo)
   where duda_id = p_duda_id returning * into v_fila;
  return v_fila;
end;
$$;

revoke all on function public.decidir_duda_agentica(uuid, integer, text, text, text) from public, anon;
grant execute on function public.decidir_duda_agentica(uuid, integer, text, text, text) to authenticated;
revoke all on function public.duda_agentica_refs_validas(jsonb, text[]) from public, anon, authenticated;
revoke all on function public.duda_agentica_medicion_valida(jsonb) from public, anon, authenticated;
revoke all on function public.duda_agentica_objeto_claves(jsonb, text[]) from public, anon, authenticated;
revoke all on function public.duda_agentica_motivos_validos(text[], text) from public, anon, authenticated;
revoke all on function public.duda_agentica_medicion_categoria_valida(jsonb) from public, anon, authenticated;
grant execute on function public.duda_agentica_refs_validas(jsonb, text[]) to service_role;
grant execute on function public.duda_agentica_medicion_valida(jsonb) to service_role;
grant execute on function public.duda_agentica_objeto_claves(jsonb, text[]) to service_role;
grant execute on function public.duda_agentica_motivos_validos(text[], text) to service_role;
grant execute on function public.duda_agentica_medicion_categoria_valida(jsonb) to service_role;

commit;
