-- ============================================================================
-- 0086 · El PRIMER plan de un cliente nuevo lo aprueba Manuela en la app, con plazo
-- ============================================================================
--
-- Decisión de Bryan (26-sep-2026). Spec: `docs/specs/2026-09-26-aprobacion-primer-plan.md`.
--
--   · El primer plan de un cliente que llega por la cola de la landing NO se publica solo:
--     queda `propuesto` y alguien con la capacidad `aprobar_primer_plan` lo aprueba o lo
--     rechaza desde la consola, antes de un plazo (`plazo_hasta`).
--   · Si vence el plazo y el perfil es de riesgo BAJO sin dudas pendientes, pasa SIN firma
--     (`vencido_aprobado`). Todo lo demás (riesgo medio, dudas, riesgo alto) se queda en
--     `espera_bryan`: nunca pasa solo.
--   · Lo clínico (cribado rojo, cambios de salud declarados) llega como riesgo `alto`: eso
--     solo lo aprueba quien tenga `autorizar_excepcion` (Bryan). Manuela lo ve y puede
--     rechazarlo, no aprobarlo.
--   · Esto NO es la firma SSH de recortes/retiros de clientes existentes (0083/0084): esa
--     sigue siendo de Bryan y no se toca.
--
-- NÚMERO. Comprobado el 26-sep contra `origin/main` (llega a la 0085), el historial de TODAS
-- las ramas remotas (`git log --remotes -- supabase/migrations`: ninguna trae una 0086) y
-- `mcp__supabase__list_migrations` del proyecto (la última desplegada es
-- `consola_lee_ficha_y_cribado_por_capacidad`, la 0085). Es el siguiente número libre en
-- las tres fuentes a la vez.
--
-- EL PLAN PROPUESTO ES UN MICROCICLO `propuesto`. `microciclos.estado` ya admite
-- 'propuesto' desde la 0001, y `activar_microciclo()` (0060/0066) es el único camino que
-- cierra/abre sin romper el índice de «un solo activo» (0069). Aprobar = activar ese
-- microciclo en la misma transacción que se registra la decisión: no hay un «aprobado»
-- que se quede sin publicar esperando a otro proceso.
--
-- SEGURIDAD, la regla de siempre (0083/0084): toda función de `public` nace ejecutable por
-- `anon`; cada `security definer` de aquí lleva `set search_path = public` y su propio
-- `revoke … from public, anon`. La tabla enciende RLS y pierde insert/update/delete de
-- `authenticated` (lección de la 0084: sin el revoke explícito, el privilegio por defecto
-- de Supabase se queda y un UPDATE sin política «pasa» sobre cero filas en vez de fallar).
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · CAPACIDAD NUEVA: aprobar_primer_plan
-- ────────────────────────────────────────────────────────────────────────────
-- El `check` de `capacidad` no llevaba nombre en la 0083: se localiza por definición, igual
-- que hizo la 0084 con `ordenes.tipo` (si el nombre adivinado no existiera, el check viejo
-- seguiría vigente y la capacidad nueva se rechazaría en silencio).
do $$
declare
  v_nombre text;
begin
  select conname into v_nombre
    from pg_constraint
   where conrelid = 'public.capacidades_staff'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%capacidad%'
   limit 1;
  if v_nombre is not null then
    execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  end if;
end
$$;

alter table public.capacidades_staff
  add constraint capacidades_staff_capacidad_check
  check (capacidad in (
    'leer_entrenamiento',
    'responder_por_asesorado',
    'detener_publicacion',
    'reportar_riesgo',
    'autorizar_excepcion',
    'firmar_politica',
    'aprobar_primer_plan'
  ));

-- Asignación por UUID, sin fallar donde esas personas no existen (el CI arranca con la
-- base vacía): se inserta SOLO lo que casa con una fila real de `usuarios_app`.
--   aa202ff5-… = Manuela (nutricionista)   28c3cfe8-… = Bryan (coach)
insert into public.capacidades_staff (usuario_id, capacidad)
select u.id, 'aprobar_primer_plan'
  from public.usuarios_app u
 where u.id in ('aa202ff5-74c1-4b76-9140-8ba44dc62f17', '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce')
on conflict do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · aprobaciones_primer_plan
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.aprobaciones_primer_plan (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references public.usuarios_app(id) on delete cascade,
  -- El plan propuesto: un microciclo en estado `propuesto` de ESTA persona (lo comprueba
  -- el trigger de alta de más abajo). Uno por microciclo: un plan no se aprueba dos veces.
  microciclo_id     text not null unique references public.microciclos(id) on delete cascade,
  estado            text not null default 'propuesto'
                      check (estado in ('propuesto', 'aprobado', 'rechazado', 'vencido_aprobado', 'espera_bryan')),
  riesgo            text not null check (riesgo in ('bajo', 'medio', 'alto')),
  -- Por qué ese riesgo, en lenguaje llano (lo escribe quien crea la fila: la cola).
  motivo_riesgo     text,
  -- Dudas que frenan la progresión (p. ej. «no sabemos si puede cargar la rodilla»).
  -- Con alguna pendiente, el plan no pasa solo al vencer el plazo aunque el riesgo sea bajo.
  dudas_pendientes  text[] not null default '{}',
  plazo_hasta       timestamptz not null default (now() + interval '48 hours'),
  -- Quién decidió (auth.uid() dentro de la RPC). NULL en `vencido_aprobado`: nadie firmó.
  decidido_por      uuid references public.usuarios_app(id),
  -- El motivo de la decisión humana (obligatorio al rechazar) o el texto automático del
  -- vencimiento.
  motivo            text,
  decidido_en       timestamptz,
  -- Por qué quedó esperando a Bryan (lo escribe `vencer_primer_plan`).
  motivo_espera     text,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),

  constraint aprobaciones_primer_plan_rechazo_con_motivo
    check (estado <> 'rechazado' or length(btrim(coalesce(motivo, ''))) > 0),
  constraint aprobaciones_primer_plan_decision_humana_con_autor
    check (estado not in ('aprobado', 'rechazado') or (decidido_por is not null and decidido_en is not null)),
  -- Lo que pasa solo tiene que ser, por construcción, bajo y sin dudas, y sin autor.
  constraint aprobaciones_primer_plan_vencido_solo_bajo
    check (estado <> 'vencido_aprobado'
           or (riesgo = 'bajo' and cardinality(dudas_pendientes) = 0
               and decidido_por is null and decidido_en is not null))
);

comment on table public.aprobaciones_primer_plan is
  'Aprobación del PRIMER plan de un cliente nuevo (2026-09-26): propuesto → aprobado | '
  'rechazado | vencido_aprobado | espera_bryan. La crea la cola (service_role); se decide '
  'SOLO por la RPC decidir_primer_plan o, al vencer, por vencer_primer_plan.';

-- Un solo primer plan PENDIENTE por persona: un rechazo deja sitio a una propuesta nueva.
create unique index if not exists aprobaciones_primer_plan_un_pendiente
  on public.aprobaciones_primer_plan (usuario_id)
  where estado in ('propuesto', 'espera_bryan');

create index if not exists aprobaciones_primer_plan_por_plazo
  on public.aprobaciones_primer_plan (plazo_hasta)
  where estado = 'propuesto';

-- El microciclo tiene que ser de ESTA persona y estar `propuesto` al crear la fila: sin
-- esto, una fila mal armada por la cola aprobaría (y activaría) el plan de otra persona.
create or replace function public.validar_aprobacion_primer_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid;
  v_estado  text;
begin
  select m.usuario_id, m.estado into v_usuario, v_estado
    from public.microciclos m
   where m.id = new.microciclo_id;
  if v_usuario is distinct from new.usuario_id then
    raise exception 'El microciclo % no es de la persona %', new.microciclo_id, new.usuario_id
      using errcode = '23514';
  end if;
  if v_estado <> 'propuesto' then
    raise exception 'El microciclo % no está propuesto (estado: %)', new.microciclo_id, v_estado
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validar_aprobacion_primer_plan() from public, anon, authenticated;

drop trigger if exists trg_validar_aprobacion_primer_plan on public.aprobaciones_primer_plan;
create trigger trg_validar_aprobacion_primer_plan
  before insert on public.aprobaciones_primer_plan
  for each row execute function public.validar_aprobacion_primer_plan();

alter table public.aprobaciones_primer_plan enable row level security;

-- Lectura: quien tenga `leer_entrenamiento`. El asesorado NO ve su propia fila: es un
-- trámite del staff, y el riesgo/las dudas son notas internas.
drop policy if exists aprobaciones_primer_plan_leer on public.aprobaciones_primer_plan;
create policy aprobaciones_primer_plan_leer on public.aprobaciones_primer_plan
  for select to authenticated
  using ((select public.tiene_capacidad('leer_entrenamiento')));

-- Sin políticas de escritura y sin privilegios: se escribe solo por las funciones de abajo
-- (security definer) o con service_role (la cola).
revoke all on public.aprobaciones_primer_plan from anon, public;
revoke insert, update, delete, truncate on public.aprobaciones_primer_plan from authenticated;
grant select on public.aprobaciones_primer_plan to authenticated;
grant all on public.aprobaciones_primer_plan to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · RPC decidir_primer_plan(aprobacion_id, decision, motivo)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.decidir_primer_plan(aprobacion_id uuid, decision text, motivo text default null)
returns public.aprobaciones_primer_plan
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  quien        uuid := auth.uid();
  fila         public.aprobaciones_primer_plan%rowtype;
  v_estado_mc  text;
  v_motivo     text := nullif(btrim(coalesce(motivo, '')), '');
begin
  if quien is null then
    raise exception 'Falta sesión' using errcode = '28000';
  end if;

  if not public.tiene_capacidad('aprobar_primer_plan') then
    raise exception 'No tienes permiso para decidir primeros planes' using errcode = '42501';
  end if;

  if decision is null or decision not in ('aprobar', 'rechazar') then
    raise exception 'Decisión desconocida: %', decision using errcode = '22023';
  end if;

  select a.* into fila
    from public.aprobaciones_primer_plan a
   where a.id = aprobacion_id
   for update;
  if not found then
    raise exception 'La aprobación no existe' using errcode = 'P0002';
  end if;

  if fila.estado not in ('propuesto', 'espera_bryan') then
    raise exception 'Este plan ya se decidió (estado actual: %)', fila.estado using errcode = '22023';
  end if;

  if decision = 'rechazar' then
    if v_motivo is null then
      raise exception 'Hace falta un motivo para rechazar' using errcode = '22023';
    end if;
    update public.aprobaciones_primer_plan a
       set estado = 'rechazado', decidido_por = quien, decidido_en = now(),
           motivo = v_motivo, actualizado_en = now()
     where a.id = aprobacion_id
    returning * into fila;
    return fila;
  end if;

  -- Aprobar. Lo clínico (riesgo alto) y lo que ya venció hacia Bryan solo lo aprueba quien
  -- tenga `autorizar_excepcion`.
  if (fila.riesgo = 'alto' or fila.estado = 'espera_bryan')
     and not public.tiene_capacidad('autorizar_excepcion') then
    raise exception 'Este plan lo aprueba Bryan (riesgo %, estado %)', fila.riesgo, fila.estado
      using errcode = '42501';
  end if;

  select m.estado into v_estado_mc from public.microciclos m where m.id = fila.microciclo_id;
  if v_estado_mc is distinct from 'propuesto' then
    raise exception 'El plan propuesto ya no está pendiente (estado del microciclo: %)', v_estado_mc
      using errcode = '22023';
  end if;

  update public.aprobaciones_primer_plan a
     set estado = 'aprobado', decidido_por = quien, decidido_en = now(),
         motivo = v_motivo, actualizado_en = now()
   where a.id = aprobacion_id
  returning * into fila;

  -- Publicar: el mismo camino que usa el resto de la app (cierra y abre en una operación).
  perform public.activar_microciclo(fila.microciclo_id);

  return fila;
end;
$$;

revoke all on function public.decidir_primer_plan(uuid, text, text) from public, anon;
grant execute on function public.decidir_primer_plan(uuid, text, text) to authenticated, service_role;

comment on function public.decidir_primer_plan(uuid, text, text) is
  'Aprueba o rechaza un primer plan. Actor = auth.uid(); exige aprobar_primer_plan; aprobar '
  'riesgo alto o algo en espera_bryan exige además autorizar_excepcion. Aprobar activa el '
  'microciclo propuesto (activar_microciclo) en la misma transacción.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · vencer_primer_plan(): para service_role / cron
-- ────────────────────────────────────────────────────────────────────────────
-- Recorre los `propuesto` con el plazo vencido. Pasa SOLO riesgo bajo sin dudas y con el
-- microciclo aún propuesto; el resto va a `espera_bryan` con el motivo escrito. Cada fila
-- en su subtransacción: si activar un plan falla, esa fila espera a Bryan y las demás
-- siguen. Devuelve cuántas pasaron y cuántas quedaron esperando.
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
begin
  for r in
    select a.*
      from public.aprobaciones_primer_plan a
     where a.estado = 'propuesto' and a.plazo_hasta <= now()
     order by a.plazo_hasta
     for update skip locked
  loop
    select m.estado into v_estado_mc from public.microciclos m where m.id = r.microciclo_id;

    v_espera := case
      when r.riesgo = 'alto'  then 'Riesgo alto (clínico): nunca pasa sin Bryan.'
      when r.riesgo = 'medio' then 'Riesgo medio: al vencer el plazo no pasa solo.'
      when cardinality(r.dudas_pendientes) > 0 then
        'Dudas pendientes que frenan la progresión: ' || array_to_string(r.dudas_pendientes, '; ')
      when v_estado_mc is distinct from 'propuesto' then
        'El microciclo ya no está propuesto (estado: ' || coalesce(v_estado_mc, 'no existe') || ').'
      else null
    end;

    if v_espera is null then
      begin
        update public.aprobaciones_primer_plan
           set estado = 'vencido_aprobado', decidido_por = null, decidido_en = now(),
               motivo = 'Plazo vencido sin objeciones: riesgo bajo y sin dudas pendientes.',
               actualizado_en = now()
         where id = r.id;
        perform public.activar_microciclo(r.microciclo_id);
        n_aprob := n_aprob + 1;
        continue;
      exception when others then
        v_espera := 'No se pudo publicar al vencer: ' || sqlerrm;
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

comment on function public.vencer_primer_plan() is
  'Al vencer el plazo: pasa (vencido_aprobado + activar_microciclo) solo riesgo bajo sin '
  'dudas; el resto queda en espera_bryan. Solo service_role (cron / cola).';

-- Programarla cada 15 minutos donde haya pg_cron (producción), igual que la 0048: se
-- PREGUNTA antes en vez de capturar el error, para no tragarse un fallo de verdad. En el
-- CI no hay pg_cron y no se programa nada; la cola puede llamarla igual en cada pasada.
-- Un `cron.schedule` con el mismo nombre reemplaza el trabajo: reaplicar no lo duplica.
do $cron_primer_plan$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $q$
      select cron.schedule('vencer-primer-plan', '*/15 * * * *', 'select public.vencer_primer_plan();')
    $q$;
  else
    raise notice 'pg_cron no está disponible: vencer_primer_plan() no queda programada; que la llame la cola.';
  end if;
end
$cron_primer_plan$;

commit;
