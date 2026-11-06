-- 0135: GUARDA DE LIBERACION de prescripciones (piloto). Propuesta, NO APLICADA (I-16). CAMBIO DE PERMISOS: requiere visto bueno de Bryan.
-- Contrato (C4 ESPECIFICACION-GUARDA-LIBERACION-C3.md sha256 ab0f327e...; plan V2.1: el agente solo propone, Bryan o Manuela liberan):
--  * Activar un microciclo exige auth.uid() NO nulo, es_staff() Y la capacidad NUEVA `liberar_prescripcion` (se crea aqui; no se concede a nadie:
--    la concede Bryan, solo a Bryan y Manuela). Ser coach, ser el asignado o decir en un JSON que se es Bryan NO basta.
--  * La liberacion queda ligada a persona + propuesta + HUELLA (sha256 del contenido `datos`): liberar_microciclo(propuesta, huella) la sella
--    con actor y fecha del SERVIDOR; si el contenido cambia despues, la huella ya no coincide y activar rechaza hasta una liberacion nueva.
--    Repetir la misma liberacion devuelve la evidencia original (no cambia actor ni fecha).
--  * Ninguna via alternativa activa: un disparador rechaza poner un microciclo en 'activo' (INSERT o UPDATE) a las sesiones authenticated,
--    anon o service_role salvo dentro de activar_microciclo. El SQL Editor (rol postgres) NO se bloquea: es el canal de administracion humana.
--  * La persona no lee ni edita sus propuestas sin liberar: las politicas de lectura y actualizacion propias excluyen estado 'propuesto'.
--  * Cierre del activo previo y apertura son atomicos (una funcion = una transaccion). No cambia GRANT ni vuelve la funcion SECURITY DEFINER.
-- Codigos de error (precedencia): 42501 sin sesion > 42501 sin staff > 42501 sin capacidad > 42501 sin liberacion vigente de ESA huella.
-- Consecuencias que hay que saber: decidir_primer_plan (0086) y vencer_primer_plan llaman a activar_microciclo: sin liberacion previa ya no activan
-- (el vencimiento automatico queda bloqueado a proposito; la aprobacion humana del primer plan debe llamar antes a liberar_microciclo).
begin;

do $$
declare
  v_nombre text;
  v_def text;
  v_lista text[];
begin
  select conname, pg_get_constraintdef(oid) into v_nombre, v_def
    from pg_constraint
   where conrelid = 'public.capacidades_staff'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%capacidad%'
   limit 1;
  if v_nombre is null then
    raise exception 'no se encontro el check de capacidades_staff: no se reescribe a ciegas';
  end if;
  select array_agg(distinct m[1] order by m[1]) into v_lista from regexp_matches(v_def, '''([a-z_]+)''', 'g') as t(m);
  v_lista := array(select distinct x from unnest(v_lista || array['liberar_prescripcion']) as x order by x);
  execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  execute format('alter table public.capacidades_staff add constraint capacidades_staff_capacidad_check check (capacidad in (%s))',
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(v_lista) as x));
end
$$;

create function public.huella_microciclo(p_datos jsonb)
returns text language sql immutable set search_path = public
as $$ select encode(sha256(convert_to(p_datos::text, 'UTF8')), 'hex') $$;

create table public.liberaciones_microciclo (
  propuesta_id text not null references public.microciclos(id) on delete cascade,
  persona_id uuid not null references public.usuarios_app(id) on delete cascade,
  huella text not null check (huella ~ '^[0-9a-f]{64}$'),
  liberado_por uuid not null references public.usuarios_app(id) on delete restrict,
  liberado_en timestamptz not null default clock_timestamp(),
  primary key (propuesta_id, huella)
);
alter table public.liberaciones_microciclo enable row level security;
revoke all on public.liberaciones_microciclo from anon, public, authenticated;
grant all on public.liberaciones_microciclo to service_role;

-- Sellar la liberacion de EXACTAMENTE esta version del contenido. Actor y fecha salen del servidor, nunca del payload.
create function public.liberar_microciclo(p_propuesta_id text, p_huella text)
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

-- Lectura de la evidencia para activar_microciclo (que sigue siendo SECURITY INVOKER).
create function public.microciclo_liberado(p_propuesta_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
      from public.liberaciones_microciclo l
      join public.microciclos m on m.id = l.propuesta_id
     where l.propuesta_id = p_propuesta_id and l.huella = public.huella_microciclo(m.datos)
       and l.persona_id = m.usuario_id)  -- H3: la liberacion es de ESTA persona; si el microciclo cambia de dueno, deja de valer
    and (auth.uid() is null or public.tiene_capacidad('liberar_prescripcion'));  -- H7: una sesion sin la capacidad de liberar no puede usarla de oraculo (sin sesion = canal de servicio/dueno)
$$;
revoke all on function public.microciclo_liberado(text) from public, anon;
grant execute on function public.microciclo_liberado(text) to authenticated, service_role;

create or replace function public.activar_microciclo(p_propuesta_id text)
returns void
language plpgsql
set search_path = public
as $function$
declare
  v_uid    uuid;
  v_estado text;
  v_activos int;
begin
  -- Guardas de liberacion (0135), en este orden: sesion, staff, capacidad. Antes de mirar si la fila existe.
  if auth.uid() is null then
    raise exception 'activar_microciclo: se requiere sesion' using errcode = '42501';
  end if;
  if not public.es_staff() then
    raise exception 'activar_microciclo: el estado del microciclo lo decide el staff' using errcode = '42501';
  end if;
  if not public.tiene_capacidad('liberar_prescripcion') then
    raise exception 'activar_microciclo: falta la capacidad de liberar' using errcode = '42501';
  end if;

  select usuario_id, estado into v_uid, v_estado
    from public.microciclos
   where id = p_propuesta_id;

  -- Sin fila no hay nada que activar.
  if v_uid is null then
    return;
  end if;

  -- Un bloque cerrado no se reabre.
  if v_estado = 'cerrado' then
    return;
  end if;

  -- Una version se activa solo si esa huella exacta fue liberada por un humano autorizado.
  if v_estado <> 'activo' and not public.microciclo_liberado(p_propuesta_id) then
    raise exception 'activar_microciclo: esta version no tiene liberacion vigente' using errcode = '42501';
  end if;

  perform set_config('alpha.activando', p_propuesta_id, true);

  -- CERRAR PRIMERO Y ABRIR DESPUES, dentro de la misma transaccion.
  update public.microciclos
     set estado = 'cerrado'
   where usuario_id = v_uid
     and id <> p_propuesta_id
     and estado = 'activo';

  update public.microciclos
     set estado = 'activo'
   where id = p_propuesta_id;

  select count(*) into v_activos
    from public.microciclos
   where usuario_id = v_uid
     and estado = 'activo';

  if v_activos <> 1 then
    raise exception 'activar_microciclo: quedaron % activos para el usuario %', v_activos, v_uid;
  end if;
end;
$function$;
revoke all on function public.activar_microciclo(text) from public, anon;
grant execute on function public.activar_microciclo(text) to authenticated, service_role;

-- Ninguna via alternativa pone un microciclo en 'activo' (INSERT/UPDATE directo, cargador o servicio por REST).
create function public.microciclo_activo_solo_liberado()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.estado = 'activo'
     and (tg_op = 'INSERT' or old.estado is distinct from 'activo')
     and current_user in ('authenticated', 'anon', 'service_role')
     and current_setting('alpha.activando', true) is distinct from new.id then
    raise exception 'un microciclo solo pasa a activo por activar_microciclo con liberacion' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger trg_microciclo_activo_solo_liberado
  before insert or update on public.microciclos
  for each row execute function public.microciclo_activo_solo_liberado();

-- La persona no lee ni edita sus propuestas sin liberar (REST/RLS). El staff conserva lo suyo.
alter policy microciclos_leer on public.microciclos
  using ((usuario_id = (select auth.uid()) and estado <> 'propuesto') or (select public.es_coach()));
alter policy microciclos_actualizar_propio on public.microciclos
  using ((usuario_id = (select auth.uid()) and estado <> 'propuesto') or (select public.es_coach()))
  with check ((usuario_id = (select auth.uid()) and estado <> 'propuesto') or (select public.es_coach()));
-- H1 (C6, 22-oct): la politica de INSERT de 0009 (microciclos_crear_propio) dejaba al asesorado crear su propia propuesta: el disparador de 0107 le abria
-- aprobacion de primer plan y la cola de liberacion aceptaba contenido escrito por la persona. La persona sigue pudiendo subir (upsert) lo que NO es propuesta.
alter policy microciclos_crear_propio on public.microciclos
  with check ((usuario_id = (select auth.uid()) and estado <> 'propuesto') or (select public.es_coach()));

commit;
