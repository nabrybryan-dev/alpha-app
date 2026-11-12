-- 0141: PROPUESTA (NO APLICADA, I-16) D-17-07 de Bryan: el primer plan se firma dentro de una ventana; vencida la ventana sin firma, un plan calificado de RIESGO BAJO pasa por la
-- automatizacion; un plan de riesgo ALTO o que requiera aprobacion/revision NUNCA pasa sin firma ni revision calificada. Sustituye el vencer_primer_plan de 0137 (opcion B ACOTADA).
-- Se aplica DESPUES de 0135/0138/0137, y solo con la orden de Bryan. 0135/0138 siguen para todo lo demas (una persona libera).
--
-- AJUSTE D-17-09 (Bryan, 17-oct 16:40, sustituye a D-17-07 en plazo y alcance): ventana de firma = 12 HORAS (antes 24); pasan por la regla los planes de riesgo BAJO y MEDIO; el ALTO o el que
-- requiera aprobacion/revision NUNCA pasa; mientras haya una duda sin resolver el plan NO pasa solo. Esta migracion cambia el DEFAULT de plazo_hasta a 12 h (solo filas nuevas; las ya
-- creadas conservan su plazo) y deja de exigir riesgo bajo en la restriccion de 0086 para 'vencido_aprobado'.
--
-- LO QUE CONSTA Y LO QUE NO (no se inventan cifras):
--  * Ventana: aprobaciones_primer_plan.plazo_hasta, por defecto now() + 12 h (D-17-09; en 0086 era 24 h por decision del 26-sep; "lo decide la cola si Bryan fija otro"). Se usa tal cual.
--  * "Rangos de horas" de la firma: NO CONSTA en 0086 ni en su spec. Queda como parametro `rangos_horas_firma` = 'NO CONSTA' para que Bryan lo confirme; esta migracion NO lo aplica.
--  * La regla nace APAGADA (`activa = false`): solo el dueno de la base (SQL Editor) la enciende, despues de confirmar los parametros.
--  * La clasificacion de riesgo: 0107 deja escrito que NO se puede calcular desde SQL (la fila nace `medio`, "lo afina la cadena"). La base NO calcula el riesgo: garantiza QUIEN lo fija
--    (solo la funcion clasificar_primer_plan, solo service_role, nunca una sesion de persona/staff), CUANDO (hora del servidor) y que no se cambia a mano (disparador que bloquea el UPDATE directo
--    de los roles de sesion y de servicio; la funcion corre como dueno, sin senal que forjar). LIMITE: quien tenga la llave service_role puede llamar a clasificar_primer_plan; la base no distingue "la cadena" de "un agente" que use esa llave.
--  * Sin clasificar = NO pasa (requiere_revision nace true y clasificado_en nace nulo).
--
-- CAMINO APARTE Y AUDITADO: activar_por_regla_ventana(aprobacion) revalida TODO con el reloj del servidor, libera la version con actor 'regla_ventana' (sin persona) y deja:
-- (a) liberaciones_microciclo.actor = 'regla_ventana', (b) una fila de auditoria con hora, motivo, riesgo, clasificacion y parametros, (c) una fila de AVISO para Bryan por cada uso.
-- El aviso es una fila durable que Bryan lee con la capacidad autorizar_excepcion; el envio (correo/push) NO esta implementado aqui.
-- Reversa: reversa-0116-0141.
begin;

-- 1 · Parametros de la regla (una fila; apagada).
create table public.regla_ventana_primer_plan (
  id boolean primary key default true check (id),
  activa boolean not null default false,
  ventana text not null default 'plazo_hasta de cada fila (por defecto 12 h desde su creacion, D-17-09)',
  rangos_horas_firma text not null default 'NO CONSTA',
  actualizada_en timestamptz not null default clock_timestamp()
);
insert into public.regla_ventana_primer_plan default values;
alter table public.regla_ventana_primer_plan enable row level security;
revoke all on public.regla_ventana_primer_plan from anon, public, authenticated;
grant select on public.regla_ventana_primer_plan to service_role;

-- 2 · Clasificacion del sistema en la fila de aprobacion (nace sin clasificar y exigiendo revision).
alter table public.aprobaciones_primer_plan
  add column clasificado_en timestamptz,
  add column clasificado_por text,
  add column requiere_revision boolean not null default true,
  add column huella_clasificada text check (huella_clasificada is null or huella_clasificada ~ '^[0-9a-f]{64}$'),  -- H2: sha256 del contenido que se clasifico
  add constraint aprobaciones_primer_plan_clasificacion_coherente
    check ((clasificado_en is null) = (clasificado_por is null) and (clasificado_por is null or clasificado_por = 'sistema'));
alter table public.aprobaciones_primer_plan
  add constraint aprobaciones_primer_plan_regla_ventana_exige_clasificacion
    check (estado <> 'vencido_aprobado' or (clasificado_por = 'sistema' and not requiere_revision and huella_clasificada is not null)) not valid;
-- D-17-09: ventana de 12 h por defecto y el riesgo medio puede pasar por la regla (0086 solo dejaba pasar riesgo bajo).
alter table public.aprobaciones_primer_plan alter column plazo_hasta set default (now() + interval '12 hours');
alter table public.aprobaciones_primer_plan drop constraint aprobaciones_primer_plan_vencido_solo_bajo;
alter table public.aprobaciones_primer_plan
  add constraint aprobaciones_primer_plan_vencido_solo_bajo
    check (estado <> 'vencido_aprobado'
           or (riesgo in ('bajo', 'medio') and cardinality(dudas_pendientes) = 0 and decidido_por is null and decidido_en is not null)) not valid;

-- 3 · La liberacion puede ser de la regla (sin persona), pero nunca anonima: o hay persona o el actor es 'regla_ventana'.
alter table public.liberaciones_microciclo
  alter column liberado_por drop not null,
  add column actor text not null default 'persona',
  add constraint liberaciones_microciclo_actor_coherente
    check ((actor = 'persona' and liberado_por is not null) or (actor = 'regla_ventana' and liberado_por is null));

-- 4 · Auditoria y aviso (una fila de cada una por uso de la regla).
create table public.activaciones_regla_ventana (
  id uuid primary key default gen_random_uuid(),
  aprobacion_id uuid not null references public.aprobaciones_primer_plan(id) on delete restrict,
  microciclo_id text not null references public.microciclos(id) on delete restrict,
  persona_id uuid not null references public.usuarios_app(id) on delete restrict,
  huella text not null check (huella ~ '^[0-9a-f]{64}$'),
  actor text not null default 'regla_ventana' check (actor = 'regla_ventana'),
  ejecutada_en timestamptz not null default clock_timestamp(),
  ventana_vencio_en timestamptz not null,
  riesgo text not null check (riesgo in ('bajo', 'medio')),
  clasificado_en timestamptz not null,
  rangos_horas_firma text not null,
  motivo text not null,
  unique (aprobacion_id)
);
create table public.avisos_regla_ventana (
  id uuid primary key default gen_random_uuid(),
  activacion_id uuid not null unique references public.activaciones_regla_ventana(id) on delete restrict,
  creado_en timestamptz not null default clock_timestamp(),
  mensaje text not null,
  leido_en timestamptz
);
alter table public.activaciones_regla_ventana enable row level security;
alter table public.avisos_regla_ventana enable row level security;
revoke all on public.activaciones_regla_ventana, public.avisos_regla_ventana from anon, public, authenticated;
grant select on public.activaciones_regla_ventana, public.avisos_regla_ventana to service_role;
grant select on public.avisos_regla_ventana to authenticated;
create policy avisos_regla_ventana_leer on public.avisos_regla_ventana for select to authenticated
  using ((select public.tiene_capacidad('autorizar_excepcion')));

-- 5 · Clasificar: UNICA via para fijar riesgo/revision/dudas/clasificacion. Solo service_role. Corre como DUENO (SECURITY DEFINER): el disparador de abajo solo bloquea a los roles de
-- sesion/servicio que intenten el UPDATE directo, asi que no hace falta una senal que ellos puedan forjar.
create function public.clasificar_primer_plan(p_aprobacion uuid, p_riesgo text, p_requiere_revision boolean, p_dudas text[] default '{}')
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_estado text;
  v_mc text;
  v_huella text;
begin
  if p_riesgo is null or p_riesgo not in ('bajo', 'medio', 'alto') or p_requiere_revision is null or p_dudas is null then
    raise exception 'clasificar_primer_plan: riesgo, revision y dudas son obligatorios' using errcode = '22023';
  end if;
  select estado, microciclo_id into v_estado, v_mc from public.aprobaciones_primer_plan where id = p_aprobacion for update;
  if v_estado is null then
    raise exception 'clasificar_primer_plan: la aprobacion no existe' using errcode = 'P0002';
  end if;
  if v_estado <> 'propuesto' then
    raise exception 'clasificar_primer_plan: solo se clasifica un plan propuesto (estado %)', v_estado using errcode = '22023';
  end if;
  -- H2 (C6): la clasificacion queda atada a la huella del contenido que se clasifico; si `datos` cambia despues, la regla ya no activa esa version.
  select public.huella_microciclo(datos) into v_huella from public.microciclos where id = v_mc;
  update public.aprobaciones_primer_plan
     set riesgo = p_riesgo, requiere_revision = p_requiere_revision, dudas_pendientes = p_dudas, huella_clasificada = v_huella,
         clasificado_en = clock_timestamp(), clasificado_por = 'sistema', actualizado_en = clock_timestamp()
   where id = p_aprobacion;
  return jsonb_build_object('aprobacion_id', p_aprobacion, 'riesgo', p_riesgo, 'requiere_revision', p_requiere_revision, 'clasificado_por', 'sistema');
end;
$$;
revoke all on function public.clasificar_primer_plan(uuid, text, boolean, text[]) from public, anon, authenticated;
grant execute on function public.clasificar_primer_plan(uuid, text, boolean, text[]) to service_role;

-- 6 · Disparador: nadie con rol de sesion/servicio cambia riesgo, revision, dudas, clasificacion ni ACORTA el plazo por UPDATE directo.
-- (El dueno de la base, p.ej. el SQL Editor, no se bloquea: igual que 0135/0138. El disparador de 0107 corre como dueno y siembra la fila sin clasificar.)
create function public.proteger_clasificacion_primer_plan()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon', 'service_role') then
    if tg_op = 'INSERT' then
      if new.clasificado_en is not null or new.clasificado_por is not null or new.requiere_revision = false or new.huella_clasificada is not null then
        raise exception 'la clasificacion del primer plan solo la fija clasificar_primer_plan' using errcode = '42501';
      end if;
      -- H4 (C6, D-17-21): la ventana de 12 horas corridas la impone la base; una sesion no inserta una aprobacion con el plazo ya vencido o recortado.
      if new.plazo_hasta < new.creado_en + interval '12 hours' then
        raise exception 'el plazo de un primer plan es de al menos 12 horas desde su creacion' using errcode = '42501';
      end if;
    elsif new.riesgo is distinct from old.riesgo or new.requiere_revision is distinct from old.requiere_revision
          or new.dudas_pendientes is distinct from old.dudas_pendientes
          or new.clasificado_en is distinct from old.clasificado_en or new.clasificado_por is distinct from old.clasificado_por
          or new.huella_clasificada is distinct from old.huella_clasificada or new.creado_en is distinct from old.creado_en then
      raise exception 'la clasificacion del primer plan solo la fija clasificar_primer_plan' using errcode = '42501';
    elsif new.plazo_hasta < old.plazo_hasta then
      raise exception 'el plazo de un primer plan no se acorta' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_proteger_clasificacion_primer_plan
  before insert or update on public.aprobaciones_primer_plan
  for each row execute function public.proteger_clasificacion_primer_plan();

-- 7 · El camino aparte. Revalida todo con el reloj del servidor; no lee claims de sesion ni acepta una hora.
create function public.activar_por_regla_ventana(p_aprobacion uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  a public.aprobaciones_primer_plan;
  p public.regla_ventana_primer_plan;
  v_uid uuid;
  v_estado_mc text;
  v_datos jsonb;
  v_huella text;
  v_ahora timestamptz := clock_timestamp();
  v_act uuid;
  v_activos integer;
begin
  select * into p from public.regla_ventana_primer_plan;
  select * into a from public.aprobaciones_primer_plan where id = p_aprobacion for update;
  if a.id is null then
    raise exception 'regla_ventana: la aprobacion no existe' using errcode = 'P0002';
  end if;
  if p.activa is not true then  -- NULL (sin fila de parametros) tambien es apagada
    raise exception 'regla_ventana: la regla esta apagada' using errcode = '42501';
  end if;
  if a.estado <> 'propuesto' or a.plazo_hasta > v_ahora then
    raise exception 'regla_ventana: la ventana no ha vencido o el plan ya no esta propuesto' using errcode = '42501';
  end if;
  if a.clasificado_por is distinct from 'sistema' or a.clasificado_en is null then
    raise exception 'regla_ventana: el plan no tiene clasificacion del sistema' using errcode = '42501';
  end if;
  if a.riesgo not in ('bajo', 'medio') or a.requiere_revision or cardinality(a.dudas_pendientes) > 0 then
    raise exception 'regla_ventana: solo riesgo bajo o medio, sin dudas sin resolver y sin revision requerida' using errcode = '42501';
  end if;
  select usuario_id, estado, datos into v_uid, v_estado_mc, v_datos from public.microciclos where id = a.microciclo_id for update;
  if v_uid is distinct from a.usuario_id or v_estado_mc is distinct from 'propuesto' then
    raise exception 'regla_ventana: el microciclo ya no esta propuesto' using errcode = '42501';
  end if;
  v_huella := public.huella_microciclo(v_datos);
  if a.huella_clasificada is distinct from v_huella then
    raise exception 'regla_ventana: el contenido cambio despues de clasificarlo (la clasificacion es de otra version)' using errcode = '42501';
  end if;
  insert into public.liberaciones_microciclo (propuesta_id, persona_id, huella, liberado_por, actor)
    values (a.microciclo_id, a.usuario_id, v_huella, null, 'regla_ventana') on conflict (propuesta_id, huella) do nothing;
  -- Activar como lo hace activar_microciclo (cerrar el activo previo, abrir este, comprobar uno solo). Corre como dueno: el disparador de 0135/0138 no bloquea al dueno.
  update public.microciclos set estado = 'cerrado' where usuario_id = a.usuario_id and id <> a.microciclo_id and estado = 'activo';
  update public.microciclos set estado = 'activo' where id = a.microciclo_id;
  select count(*) into v_activos from public.microciclos where usuario_id = a.usuario_id and estado = 'activo';
  if v_activos <> 1 then
    raise exception 'regla_ventana: quedaron % activos', v_activos;
  end if;
  update public.aprobaciones_primer_plan
     set estado = 'vencido_aprobado', decidido_por = null, decidido_en = v_ahora, actualizado_en = v_ahora,
         motivo = 'Regla de ventana (D-17-07/D-17-09): plazo vencido sin firma, riesgo bajo o medio clasificado por el sistema, sin dudas sin resolver ni revision requerida.'
   where id = a.id;
  insert into public.activaciones_regla_ventana (aprobacion_id, microciclo_id, persona_id, huella, ejecutada_en, ventana_vencio_en, riesgo, clasificado_en, rangos_horas_firma, motivo)
    values (a.id, a.microciclo_id, a.usuario_id, v_huella, v_ahora, a.plazo_hasta, a.riesgo, a.clasificado_en, p.rangos_horas_firma,
            'plazo vencido sin firma; riesgo bajo o medio; sin dudas sin resolver; sin revision requerida')
    returning id into v_act;
  insert into public.avisos_regla_ventana (activacion_id, mensaje)
    values (v_act, 'La regla de ventana activo un primer plan sin firma (aprobacion ' || a.id || '). Revisalo: fue riesgo ' || a.riesgo || ' clasificado por el sistema.');
  return jsonb_build_object('activacion_id', v_act, 'microciclo_id', a.microciclo_id, 'actor', 'regla_ventana', 'ejecutada_en', v_ahora);
end;
$$;
revoke all on function public.activar_por_regla_ventana(uuid) from public, anon, authenticated;
grant execute on function public.activar_por_regla_ventana(uuid) to service_role;

-- 8 · vencer_primer_plan: lo elegible pasa por la regla; todo lo demas espera con el motivo escrito. Sin sesion de persona no activa nada fuera de la regla.
create or replace function public.vencer_primer_plan()
returns table (aprobados int, a_bryan int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r           record;
  v_estado_mc text;
  n_aprob     int := 0;
  n_bryan     int := 0;
  v_espera    text;
  v_activa    boolean;
begin
  select activa into v_activa from public.regla_ventana_primer_plan;
  for r in
    select a.*
      from public.aprobaciones_primer_plan a
     where a.estado = 'propuesto' and a.plazo_hasta <= clock_timestamp()
     order by a.plazo_hasta
     for update skip locked
  loop
    select m.estado into v_estado_mc from public.microciclos m where m.id = r.microciclo_id;

    v_espera := case
      when r.riesgo = 'alto'  then 'Riesgo alto (clínico): nunca pasa sin Bryan.'
      when cardinality(r.dudas_pendientes) > 0 then
        'Dudas pendientes que frenan la progresión: ' || array_to_string(r.dudas_pendientes, '; ')
      when v_estado_mc is distinct from 'propuesto' then
        'El microciclo ya no está propuesto (estado: ' || coalesce(v_estado_mc, 'no existe') || ').'
      when r.clasificado_por is distinct from 'sistema' or r.clasificado_en is null then
        'Sin clasificacion del sistema: no pasa; la guarda de liberacion exige que una persona libere esta version.'
      when r.requiere_revision then 'El plan requiere aprobacion o revision: nunca pasa sin firma ni revision calificada.'
      when not coalesce(v_activa, false) then
        'Plazo vencido sin objeciones (riesgo bajo, sin dudas): la regla de ventana esta apagada y la guarda de liberacion exige que una persona libere esta version.'
      else null
    end;

    if v_espera is null then
      begin
        perform public.activar_por_regla_ventana(r.id);
        n_aprob := n_aprob + 1;
        continue;
      exception when others then
        v_espera := 'La regla de ventana no pudo activar el plan (' || sqlerrm || '); la guarda de liberacion exige que una persona libere esta version.';
      end;
    end if;

    update public.aprobaciones_primer_plan
       set estado = 'espera_bryan', motivo_espera = v_espera, actualizado_en = now()
     where id = r.id;
    n_bryan := n_bryan + 1;
  end loop;

  aprobados := n_aprob;
  a_bryan := n_bryan;
  return next;
end;
$$;
revoke all on function public.vencer_primer_plan() from public, anon, authenticated;
grant execute on function public.vencer_primer_plan() to service_role;

commit;
