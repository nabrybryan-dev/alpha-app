-- R5: el agente solo propone; la zona vigente cambia exclusivamente al firmar el coach asignado.
begin;

create table public.propuestas_zona_cambio (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.usuarios_app(id) on delete cascade,
  zona_actual text not null check (zona_actual in ('verde','amarillo','rojo','no_determinada')),
  zona_propuesta text not null check (zona_propuesta in ('verde','amarillo','rojo','no_determinada')),
  razon text not null check (length(btrim(razon)) between 1 and 300),
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','FIRMAR','RECHAZAR','OBSOLETA')),
  creada_en timestamptz not null default transaction_timestamp(),
  decidida_por uuid,
  decidida_en timestamptz,
  constraint propuestas_zona_cambio_diferente check (zona_actual <> zona_propuesta),
  constraint propuestas_zona_cambio_auditoria check (
    (estado = 'PENDIENTE' and decidida_por is null and decidida_en is null)
    or (estado in ('FIRMAR','RECHAZAR','OBSOLETA') and decidida_por is not null and decidida_en is not null)
  )
);

create unique index propuestas_zona_cambio_una_pendiente
  on public.propuestas_zona_cambio(persona_id) where estado = 'PENDIENTE';

alter table public.propuestas_zona_cambio enable row level security;
create policy propuestas_zona_cambio_leer on public.propuestas_zona_cambio
  for select to authenticated
  using (
    (select public.es_coach_asignado(persona_id))
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );
revoke all on public.propuestas_zona_cambio from anon, public, authenticated;
grant select on public.propuestas_zona_cambio to authenticated;
grant all on public.propuestas_zona_cambio to service_role;

create function public.proponer_cambio_zona(
  p_persona_id uuid,
  p_zona_propuesta text,
  p_razon text
)
returns public.propuestas_zona_cambio
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual text;
  v_fila public.propuestas_zona_cambio;
begin
  if p_persona_id is null or not exists (select 1 from public.usuarios_app where id = p_persona_id) then
    raise exception 'la persona no existe' using errcode = 'P0002';
  end if;
  if p_zona_propuesta is null or p_zona_propuesta not in ('verde','amarillo','rojo','no_determinada') then
    raise exception 'la zona propuesta no pertenece al contrato' using errcode = '22023';
  end if;
  if p_razon is null or length(btrim(p_razon)) not between 1 and 300 then
    raise exception 'la propuesta requiere una razon de hasta 300 caracteres' using errcode = '22023';
  end if;

  select c.zona into v_actual
    from public.contexto_clinico_firmado c
   where c.usuario_id = p_persona_id;
  v_actual := coalesce(v_actual, 'no_determinada');
  if v_actual = p_zona_propuesta then
    raise exception 'la zona propuesta ya es la vigente' using errcode = '22023';
  end if;

  insert into public.propuestas_zona_cambio(persona_id,zona_actual,zona_propuesta,razon)
  values (p_persona_id,v_actual,p_zona_propuesta,btrim(p_razon))
  on conflict (persona_id) where estado = 'PENDIENTE' do nothing
  returning * into v_fila;
  if not found then
    select * into v_fila from public.propuestas_zona_cambio
     where persona_id = p_persona_id and estado = 'PENDIENTE';
  end if;
  return v_fila;
end;
$$;

revoke all on function public.proponer_cambio_zona(uuid,text,text) from public, anon, authenticated;
grant execute on function public.proponer_cambio_zona(uuid,text,text) to service_role;

create function public.decidir_propuesta_zona(
  p_propuesta_id uuid,
  p_decision text
)
returns public.propuestas_zona_cambio
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_fila public.propuestas_zona_cambio;
  v_zona_actual text;
  v_actualizadas integer;
begin
  select * into v_fila
    from public.propuestas_zona_cambio
   where id = p_propuesta_id
   for update;
  if not found then
    raise exception 'la propuesta no existe' using errcode = 'P0002';
  end if;
  if v_actor is null or not (
    public.es_coach() and public.es_coach_asignado(v_fila.persona_id)
  ) then
    raise exception 'solo el coach asignado puede decidir la propuesta' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('FIRMAR','RECHAZAR') then
    raise exception 'la decision debe ser FIRMAR o RECHAZAR' using errcode = '22023';
  end if;
  if v_fila.estado <> 'PENDIENTE' then
    raise exception 'la propuesta ya fue decidida' using errcode = '22023';
  end if;

  select c.zona into v_zona_actual
    from public.contexto_clinico_firmado c
   where c.usuario_id = v_fila.persona_id
   for update;
  v_zona_actual := coalesce(v_zona_actual, 'no_determinada');
  if v_zona_actual is distinct from v_fila.zona_actual then
    update public.propuestas_zona_cambio
       set estado = 'OBSOLETA', decidida_por = v_actor, decidida_en = clock_timestamp()
     where id = v_fila.id
     returning * into v_fila;
    return v_fila;
  end if;

  if p_decision = 'FIRMAR' then
    insert into public.contexto_clinico_firmado as c
      (usuario_id,zona,zona_firmada_por,zona_firmada_en,actualizado_en)
    values (v_fila.persona_id,v_fila.zona_propuesta,v_actor,clock_timestamp(),clock_timestamp())
    on conflict (usuario_id) do update set
      zona = excluded.zona,
      zona_firmada_por = excluded.zona_firmada_por,
      zona_firmada_en = excluded.zona_firmada_en,
      actualizado_en = excluded.actualizado_en
    where c.zona = v_fila.zona_actual;
    get diagnostics v_actualizadas = row_count;
    if v_actualizadas = 0 then
      update public.propuestas_zona_cambio
         set estado = 'OBSOLETA', decidida_por = v_actor, decidida_en = clock_timestamp()
       where id = v_fila.id
       returning * into v_fila;
      return v_fila;
    end if;
  end if;

  update public.propuestas_zona_cambio
     set estado = p_decision,
         decidida_por = v_actor,
         decidida_en = clock_timestamp()
   where id = v_fila.id
   returning * into v_fila;
  return v_fila;
end;
$$;

revoke all on function public.decidir_propuesta_zona(uuid,text) from public, anon;
grant execute on function public.decidir_propuesta_zona(uuid,text) to authenticated, service_role;

comment on table public.propuestas_zona_cambio is
  'Cola y auditoria de propuestas del agente para cambiar la zona; solo la firma del coach asignado modifica el contexto vigente (R5).';

commit;
