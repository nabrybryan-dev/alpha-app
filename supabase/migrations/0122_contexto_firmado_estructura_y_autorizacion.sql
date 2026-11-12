-- 0122 fortalece el contrato ya creado por 0116; no duplica sus columnas.
-- Fuentes: DECISION-REGLAS-FALSOS-BLOQUEOS-20261012.md:46-92; CONTRATO-DATOS-R2-CAMPOS.md:51-56;
-- RESULT-B2-R2-CAMPOS.md:32-35; 0116:259-279 (campos), 288-301 (RLS), 303-373 (RPC/auditoria).
begin;

create or replace function public.contexto_dolor_base_valido(p_valor jsonb)
returns boolean
language sql immutable set search_path = pg_catalog
as $$
  select case when jsonb_typeof(p_valor) is distinct from 'array' then false else not exists (
       select 1 from jsonb_array_elements(p_valor) r
        where jsonb_typeof(r) is distinct from 'object'
           or (select array_agg(k order by k) from jsonb_object_keys(r) k)
                is distinct from array['desde','eva_max','eva_min','fecha','validado_por','zona']::text[]
           or jsonb_typeof(r->'zona') is distinct from 'string'
           or coalesce(length(btrim(r->>'zona')), 0) = 0
           or jsonb_typeof(r->'eva_min') is distinct from 'number'
           or jsonb_typeof(r->'eva_max') is distinct from 'number'
           or case when jsonb_typeof(r->'eva_min') = 'number'
                    and jsonb_typeof(r->'eva_max') = 'number'
                   then (r->>'eva_min')::numeric not between 0 and 10
                     or (r->>'eva_max')::numeric not between 0 and 10
                     or (r->>'eva_min')::numeric > (r->>'eva_max')::numeric
                   else true end
           or coalesce(r->>'desde','') !~ '^\d{4}-\d{2}-\d{2}$'
           or coalesce(r->>'fecha','') !~ '^\d{4}-\d{2}-\d{2}$'
           or coalesce(r->>'validado_por','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     ) end;
$$;

create or replace function public.contexto_sustancias_validas(p_valor jsonb)
returns boolean
language sql immutable set search_path = pg_catalog
as $$
  select case when jsonb_typeof(p_valor) is distinct from 'array' then false else not exists (
       select 1 from jsonb_array_elements(p_valor) r
        where jsonb_typeof(r) is distinct from 'object'
           or (select array_agg(k order by k) from jsonb_object_keys(r) k)
                is distinct from array['autoadministrada','declarada_en','nombre','nota','sin_prescripcion']::text[]
           or jsonb_typeof(r->'nombre') is distinct from 'string'
           or coalesce(length(btrim(r->>'nombre')), 0) = 0
           or r->'autoadministrada' is distinct from 'true'::jsonb
           or jsonb_typeof(r->'sin_prescripcion') is distinct from 'boolean'
           or coalesce(r->>'declarada_en','') !~ '^\d{4}-\d{2}-\d{2}$'
           or jsonb_typeof(r->'nota') is distinct from 'string'
     ) end;
$$;

revoke all on function public.contexto_dolor_base_valido(jsonb) from public, anon, authenticated;
revoke all on function public.contexto_sustancias_validas(jsonb) from public, anon, authenticated;
grant execute on function public.contexto_dolor_base_valido(jsonb) to service_role;
grant execute on function public.contexto_sustancias_validas(jsonb) to service_role;

alter table public.contexto_clinico_firmado
  add constraint contexto_dolor_base_forma_v1 check (public.contexto_dolor_base_valido(dolor_base)),
  add constraint contexto_sustancias_forma_v1 check (public.contexto_sustancias_validas(sustancias_autodeclaradas));

-- La persona consulta solo su propia ficha; la escritura sigue reservada a la RPC del coach.
drop policy if exists contexto_clinico_leer on public.contexto_clinico_firmado;
create policy contexto_clinico_leer on public.contexto_clinico_firmado
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

create or replace function public.firmar_contexto_clinico(
  p_usuario_id uuid,
  p_zona text,
  p_zona_nota text default null,
  p_profesionales_a_cargo boolean default false,
  p_profesionales_nota text default null,
  p_dolor_base jsonb default '[]'::jsonb,
  p_sustancias_autodeclaradas jsonb default '[]'::jsonb,
  p_revisar_antes_de date default null
)
returns public.contexto_clinico_firmado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_fila public.contexto_clinico_firmado;
begin
  if v_actor is null or not (
    (public.es_coach() and public.es_coach_asignado(p_usuario_id))
    or public.tiene_capacidad('autorizar_excepcion')
  ) then
    raise exception 'solo el coach asignado o quien tiene autorizar_excepcion firma el contexto clinico'
      using errcode = '42501';
  end if;
  if p_usuario_id is null or not exists (select 1 from public.usuarios_app where id = p_usuario_id) then
    raise exception 'la persona no existe' using errcode = 'P0002';
  end if;
  if p_zona is null or p_zona not in ('verde', 'amarillo', 'rojo', 'no_determinada') then
    raise exception 'la zona es verde, amarillo, rojo o no_determinada' using errcode = '22023';
  end if;
  if p_dolor_base is null or not public.contexto_dolor_base_valido(p_dolor_base)
     or p_sustancias_autodeclaradas is null
     or not public.contexto_sustancias_validas(p_sustancias_autodeclaradas) then
    raise exception 'dolor_base o sustancias no cumplen el contrato firmado' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_dolor_base) r
     where lower(r->>'validado_por') <> v_actor::text
  ) then
    raise exception 'cada dolor_base debe identificar al coach que la valida' using errcode = '22023';
  end if;

  insert into public.contexto_clinico_firmado as c (
    usuario_id, zona, zona_firmada_por, zona_firmada_en, zona_nota,
    profesionales_a_cargo, profesionales_nota, dolor_base,
    sustancias_autodeclaradas, revisar_antes_de, actualizado_en
  ) values (
    p_usuario_id, p_zona, v_actor, clock_timestamp(), nullif(btrim(p_zona_nota), ''),
    coalesce(p_profesionales_a_cargo, false), nullif(btrim(p_profesionales_nota), ''),
    p_dolor_base, p_sustancias_autodeclaradas, p_revisar_antes_de, clock_timestamp()
  )
  on conflict (usuario_id) do update set
    zona = excluded.zona,
    zona_firmada_por = excluded.zona_firmada_por,
    zona_firmada_en = excluded.zona_firmada_en,
    zona_nota = excluded.zona_nota,
    profesionales_a_cargo = excluded.profesionales_a_cargo,
    profesionales_nota = excluded.profesionales_nota,
    dolor_base = excluded.dolor_base,
    sustancias_autodeclaradas = excluded.sustancias_autodeclaradas,
    revisar_antes_de = excluded.revisar_antes_de,
    actualizado_en = excluded.actualizado_en
  returning * into v_fila;
  return v_fila;
end;
$$;

revoke all on function public.firmar_contexto_clinico(uuid,text,text,boolean,text,jsonb,jsonb,date) from public, anon;
grant execute on function public.firmar_contexto_clinico(uuid,text,text,boolean,text,jsonb,jsonb,date) to authenticated, service_role;

comment on column public.contexto_clinico_firmado.revisar_antes_de is
  'Campo de 0116 conservado. El plazo por defecto de 90 dias sigue propuesto; esta migracion no lo impone.';

commit;
