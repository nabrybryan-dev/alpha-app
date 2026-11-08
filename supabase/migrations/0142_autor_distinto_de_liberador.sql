-- 0142 · PROPUESTA (NO APLICADA, I-16; CAMBIO DE PERMISOS: requiere visto bueno de Bryan). Decision D-17-57 (22-oct): quien libera un plan debe ser distinto de quien lo edito.
-- Se aplica DESPUES de 0135, 0138 (par indivisible, D-17-56) y 0141. No edita ninguna migracion existente: reemplaza dos funciones con CREATE OR REPLACE.
-- Mecanismo: un disparador definer anota en `ediciones_microciclo` a quien (auth.uid()) inserta o cambia `datos` de un microciclo. liberar_microciclo rechaza (42501) a quien
-- figura como editor de ESA propuesta (cualquier version: criterio estricto). microciclo_liberado vuelve a mirarlo, para que una liberacion sellada antes de que el liberador
-- editara (y volviera el contenido a la huella liberada) deje de valer.
-- LIMITES (no cubiertos): ediciones hechas sin sesion (service_role, SQL Editor, cargador) no tienen autor y no cuentan: el agente propone sin uid y puede liberarla cualquiera con la
-- capacidad. Si el staff edita por el canal de servicio, la regla no lo ve. Con una sola persona con la capacidad (hoy Bryan y Manuela son dos) nadie puede liberar lo que edito: queda el otro.
-- Reversa: restaurar el cuerpo de liberar_microciclo (0135) y de microciclo_liberado (0135), borrar el disparador y la tabla.
begin;

create table public.ediciones_microciclo (
  propuesta_id text not null references public.microciclos(id) on delete cascade,
  editado_por uuid not null,
  huella text not null check (huella ~ '^[0-9a-f]{64}$'),
  editado_en timestamptz not null default clock_timestamp(),
  primary key (propuesta_id, editado_por, huella)
);
alter table public.ediciones_microciclo enable row level security;
revoke all on public.ediciones_microciclo from public, anon, authenticated, service_role;
grant select on public.ediciones_microciclo to service_role;

create function public.registrar_editor_microciclo()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is not null and (tg_op = 'INSERT' or new.datos is distinct from old.datos) then
    insert into public.ediciones_microciclo (propuesta_id, editado_por, huella)
    values (new.id, v_uid, public.huella_microciclo(new.datos))
    on conflict do nothing;
  end if;
  return null;
end;
$$;
revoke all on function public.registrar_editor_microciclo() from public, anon, authenticated, service_role;
create trigger trg_registrar_editor_microciclo
  after insert or update of datos on public.microciclos
  for each row execute function public.registrar_editor_microciclo();

create or replace function public.liberar_microciclo(p_propuesta_id text, p_huella text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_persona uuid;
  v_estado text;
  v_datos jsonb;
  r public.liberaciones_microciclo;
begin
  if v_uid is null then
    raise exception 'liberar_microciclo: se requiere sesion' using errcode = '42501';
  end if;
  if not public.es_staff() then
    raise exception 'liberar_microciclo: solo el staff libera' using errcode = '42501';
  end if;
  if not public.tiene_capacidad('liberar_prescripcion') then
    raise exception 'liberar_microciclo: falta la capacidad de liberar' using errcode = '42501';
  end if;
  select usuario_id, estado, datos into v_persona, v_estado, v_datos from public.microciclos where id = p_propuesta_id for share;
  if not found then
    raise exception 'liberar_microciclo: la propuesta no existe' using errcode = 'P0002';
  end if;
  if v_estado <> 'propuesto' then
    raise exception 'liberar_microciclo: solo se libera una propuesta (estado %)', v_estado using errcode = '22023';
  end if;
  if p_huella is null or p_huella <> public.huella_microciclo(v_datos) then
    raise exception 'liberar_microciclo: la huella no es la del contenido actual (la version cambio)' using errcode = '22023';
  end if;
  -- 0142 (D-17-57): quien edito esta propuesta no la libera.
  if exists (select 1 from public.ediciones_microciclo e where e.propuesta_id = p_propuesta_id and e.editado_por = v_uid) then
    raise exception 'liberar_microciclo: quien edito esta propuesta no puede liberarla' using errcode = '42501';
  end if;
  insert into public.liberaciones_microciclo (propuesta_id, persona_id, huella, liberado_por)
  values (p_propuesta_id, v_persona, p_huella, v_uid)
  on conflict (propuesta_id, huella) do nothing;
  select * into r from public.liberaciones_microciclo where propuesta_id = p_propuesta_id and huella = p_huella;
  return jsonb_build_object('propuesta_id', r.propuesta_id, 'persona_id', r.persona_id, 'huella', r.huella,
                            'liberado_por', r.liberado_por, 'liberado_en', r.liberado_en);
end;
$$;
revoke all on function public.liberar_microciclo(text, text) from public, anon;
grant execute on function public.liberar_microciclo(text, text) to authenticated;

create or replace function public.microciclo_liberado(p_propuesta_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
      from public.liberaciones_microciclo l
      join public.microciclos m on m.id = l.propuesta_id
     where l.propuesta_id = p_propuesta_id and l.huella = public.huella_microciclo(m.datos)
       and l.persona_id = m.usuario_id
       and not exists (select 1 from public.ediciones_microciclo e where e.propuesta_id = l.propuesta_id and e.editado_por = l.liberado_por))  -- 0142: el liberador no es editor
    and (auth.uid() is null or public.tiene_capacidad('liberar_prescripcion'));
$$;
revoke all on function public.microciclo_liberado(text) from public, anon;
grant execute on function public.microciclo_liberado(text) to authenticated, service_role;

commit;
