-- ============================================================================
-- 0087 · El plan estratégico RENOVADO lo aprueba Manuela en la app, como el primer plan
-- ============================================================================
--
-- Decisión de Bryan (26-sep-2026). Mismo patrón que la 0086 (primer plan), aplicado al
-- borrador de plan estratégico que escribe el agente de renovación (/renovacion,
-- `tuberia/guardar_borrador_plan.py` en cerebro-alpha-agentes):
--
--   · El borrador NO se publica solo: queda `planes_estrategicos.estado = 'borrador'`
--     (vigente = false) con una fila en `aprobaciones_plan_estrategico` `propuesto`.
--   · Lo aprueba o lo rechaza quien tenga `aprobar_plan_estrategico` (Manuela y Bryan),
--     antes de `plazo_hasta` (24 h por defecto).
--   · Al vencer el plazo pasa SOLO lo de riesgo BAJO, NO clínico, sin dudas pendientes y
--     sin preguntas abiertas para Bryan (`vencido_aprobado`). Todo lo demás queda en
--     `espera_bryan` y no pasa nunca solo.
--   · Lo clínico o de riesgo alto (y lo que ya espera a Bryan) solo lo APRUEBA quien tenga
--     `autorizar_excepcion` (Bryan). Manuela lo ve y puede rechazarlo, no aprobarlo
--     (igual que la 0086: rechazar es la dirección segura).
--   · Aprobar = en la MISMA transacción apagar el vigente (estado 'reemplazado') y
--     encender el borrador (vigente = true, estado 'vigente'). El índice único parcial
--     «un vigente por persona» (0083) no se puede diferir: primero se apaga, luego se
--     enciende.
--
-- NÚMERO. Comprobado el 26-sep contra `origin/main` (llega a la 0086), las 130+ ramas
-- remotas (ninguna trae un archivo 0087/0088 en supabase/migrations) y
-- `mcp__supabase__list_migrations` del proyecto (la última desplegada es
-- `aprobacion_primer_plan`, la 0086). Es el siguiente número libre en las tres fuentes.
--
-- COMPATIBILIDAD CON QUIEN YA ESCRIBE LA TABLA. `planes_estrategicos` la escriben hoy, con
-- service_role, `tuberia/subir_a_consola.py` (apaga `vigente` del viejo e inserta el nuevo
-- con `vigente = true`, sin columna `estado`), `tuberia/guardar_borrador_plan.py` (inserta
-- con `vigente = false`) y `tuberia/activar_plan.py` (update de `vigente`). Ninguno sabe de
-- `estado`, así que un trigger lo DERIVA cuando quien escribe no lo da:
--     insert sin estado  → vigente ? 'vigente' : 'borrador'
--     update de vigente sin tocar estado → true: 'vigente'; true→false: 'reemplazado'
-- Un insert con `vigente = false` y sin estado queda como BORRADOR (oculto al asesorado):
-- ante la duda, lo conservador es no enseñarlo.
--
-- CORRECCIONES A LA PROPUESTA DEL AGENTE DE RENOVACIÓN:
--   · El asesorado ve solo `vigente` y `reemplazado`, no «todo menos borrador»: un
--     borrador RECHAZADO tampoco se le enseña nunca.
--   · La fila de aprobación lleva también `justificacion`, `supuestos` y
--     `preguntas_para_bryan` (el esquema `plan_estrategico_borrador.schema.json` dice que
--     esas claves NUNCA viajan a `contenido`: sin columnas aquí, Manuela no las vería).
--   · Una pregunta abierta para Bryan cuenta como duda: con alguna, no pasa solo al vencer.
--   · Aprobar comprueba que el borrador sigue siendo borrador, del mismo usuario y con el
--     MISMO hash que se propuso (se aprueba ESTE contenido, no otro).
--
-- SEGURIDAD, la regla de siempre (0083/0084/0086): cada `security definer` lleva
-- `set search_path = public` y su propio `revoke … from public, anon`; la tabla nueva
-- enciende RLS y pierde insert/update/delete/truncate de `authenticated`.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · planes_estrategicos.estado
-- ────────────────────────────────────────────────────────────────────────────
alter table public.planes_estrategicos add column if not exists estado text;

-- Relleno desde `vigente`: lo que ya existe o es el vigente o es historial reemplazado.
update public.planes_estrategicos
   set estado = case when vigente then 'vigente' else 'reemplazado' end
 where estado is null;

alter table public.planes_estrategicos alter column estado set not null;

alter table public.planes_estrategicos drop constraint if exists planes_estrategicos_estado_check;
alter table public.planes_estrategicos
  add constraint planes_estrategicos_estado_check
  check (estado in ('borrador', 'vigente', 'reemplazado', 'rechazado'));

alter table public.planes_estrategicos drop constraint if exists planes_estrategicos_estado_coherente;
alter table public.planes_estrategicos
  add constraint planes_estrategicos_estado_coherente
  check ((estado = 'vigente') = vigente);

comment on column public.planes_estrategicos.estado is
  'borrador (propuesto por el agente de renovación, espera aprobación) | vigente | '
  'reemplazado | rechazado. Coherente con `vigente` por check. Si quien escribe no lo da, '
  'lo deriva el trigger trg_planes_estrategicos_estado (0087).';

-- El NOT NULL se comprueba DESPUÉS de los triggers BEFORE: el insert sin estado de los
-- importadores viejos pasa porque este trigger lo rellena antes.
create or replace function public.derivar_estado_plan_estrategico()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.estado is null then
      new.estado := case when new.vigente then 'vigente' else 'borrador' end;
    end if;
  elsif new.vigente is distinct from old.vigente and new.estado is not distinct from old.estado then
    if new.vigente then
      new.estado := 'vigente';
    elsif old.estado = 'vigente' then
      new.estado := 'reemplazado';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.derivar_estado_plan_estrategico() from public, anon, authenticated;

drop trigger if exists trg_planes_estrategicos_estado on public.planes_estrategicos;
create trigger trg_planes_estrategicos_estado
  before insert or update of vigente, estado on public.planes_estrategicos
  for each row execute function public.derivar_estado_plan_estrategico();

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · CAPACIDAD NUEVA: aprobar_plan_estrategico
-- ────────────────────────────────────────────────────────────────────────────
-- El check se localiza por definición, como en la 0086 (el nombre no es fiable).
do $$
declare
  v_nombre text;
begin
  for v_nombre in
    select conname
      from pg_constraint
     where conrelid = 'public.capacidades_staff'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%capacidad%'
  loop
    execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  end loop;
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
    'aprobar_primer_plan',
    'aprobar_plan_estrategico'
  ));

--   aa202ff5-… = Manuela (nutricionista)   28c3cfe8-… = Bryan (coach)
-- Solo si existen (el CI arranca con la base vacía).
insert into public.capacidades_staff (usuario_id, capacidad)
select u.id, 'aprobar_plan_estrategico'
  from public.usuarios_app u
 where u.id in ('aa202ff5-74c1-4b76-9140-8ba44dc62f17', '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce')
on conflict do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · Lectura de planes_estrategicos: el asesorado no ve borradores ni rechazados
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists planes_estrategicos_leer on public.planes_estrategicos;
create policy planes_estrategicos_leer on public.planes_estrategicos
  for select to authenticated
  using (
    (usuario_id = (select auth.uid()) and estado in ('vigente', 'reemplazado'))
    or (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
    or (select public.tiene_capacidad('aprobar_plan_estrategico'))
  );

-- La 0083 solo revocó a anon/public: `authenticated` conservaba el privilegio por defecto
-- de Supabase y un UPDATE sin política «pasaba» sobre cero filas en vez de fallar (lección
-- de la 0084). Ahora que encender un borrador es LA decisión, que falle en voz alta: solo
-- se escribe con service_role o por las funciones de abajo.
revoke insert, update, delete, truncate on public.planes_estrategicos from authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · aprobaciones_plan_estrategico
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.aprobaciones_plan_estrategico (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid not null references public.usuarios_app(id) on delete cascade,
  -- El borrador: una fila `estado = 'borrador'` de ESTA persona con ESTE hash (lo comprueba
  -- el trigger de alta). Uno por plan: un borrador no se aprueba dos veces.
  plan_id               uuid not null unique references public.planes_estrategicos(id) on delete cascade,
  hash                  text not null,
  estado                text not null default 'propuesto'
                          check (estado in ('propuesto', 'aprobado', 'rechazado', 'vencido_aprobado', 'espera_bryan')),
  riesgo                text not null check (riesgo in ('bajo', 'medio', 'alto')),
  -- Lo clínico va aparte del riesgo: aunque alguien lo marque «bajo», clínico no pasa solo
  -- y solo lo aprueba Bryan.
  clinico               boolean not null default false,
  motivo_riesgo         text,
  dudas_pendientes      text[] not null default '{}',
  -- Lo que el agente escribe para quien aprueba y NO viaja a `contenido`
  -- (plan_estrategico_borrador.schema.json): [{decision, evidencia}], [texto],
  -- [{pregunta, opciones[]}].
  justificacion         jsonb not null default '[]'::jsonb check (jsonb_typeof(justificacion) = 'array'),
  supuestos             text[] not null default '{}',
  preguntas_para_bryan  jsonb not null default '[]'::jsonb check (jsonb_typeof(preguntas_para_bryan) = 'array'),
  plazo_hasta           timestamptz not null default (now() + interval '24 hours'),
  decidido_por          uuid references public.usuarios_app(id),
  motivo                text,
  decidido_en           timestamptz,
  motivo_espera         text,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),

  constraint aprobaciones_plan_estrategico_rechazo_con_motivo
    check (estado <> 'rechazado' or length(btrim(coalesce(motivo, ''))) > 0),
  constraint aprobaciones_plan_estrategico_decision_humana_con_autor
    check (estado not in ('aprobado', 'rechazado') or (decidido_por is not null and decidido_en is not null)),
  -- Lo que pasa solo tiene que ser, por construcción: bajo, no clínico, sin dudas, sin
  -- preguntas para Bryan y sin autor.
  constraint aprobaciones_plan_estrategico_vencido_solo_bajo
    check (estado <> 'vencido_aprobado'
           or (riesgo = 'bajo' and not clinico and cardinality(dudas_pendientes) = 0
               and jsonb_array_length(preguntas_para_bryan) = 0
               and decidido_por is null and decidido_en is not null))
);

comment on table public.aprobaciones_plan_estrategico is
  'Aprobación del plan estratégico RENOVADO (2026-09-26): propuesto → aprobado | rechazado '
  '| vencido_aprobado | espera_bryan. La crea el agente de renovación (service_role); se '
  'decide SOLO por la RPC decidir_plan_estrategico o, al vencer, por vencer_plan_estrategico.';

create unique index if not exists aprobaciones_plan_estrategico_un_pendiente
  on public.aprobaciones_plan_estrategico (usuario_id)
  where estado in ('propuesto', 'espera_bryan');

create index if not exists aprobaciones_plan_estrategico_por_plazo
  on public.aprobaciones_plan_estrategico (plazo_hasta)
  where estado = 'propuesto';

-- El plan tiene que ser un BORRADOR de ESTA persona con ESTE hash al crear la fila: sin
-- esto, una fila mal armada aprobaría (y encendería) el plan de otra persona, o un
-- contenido distinto del que se enseñó.
create or replace function public.validar_aprobacion_plan_estrategico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid;
  v_estado  text;
  v_hash    text;
begin
  select p.usuario_id, p.estado, p.hash into v_usuario, v_estado, v_hash
    from public.planes_estrategicos p
   where p.id = new.plan_id;
  if v_usuario is distinct from new.usuario_id then
    raise exception 'El plan % no es de la persona %', new.plan_id, new.usuario_id
      using errcode = '23514';
  end if;
  if v_estado is distinct from 'borrador' then
    raise exception 'El plan % no es un borrador (estado: %)', new.plan_id, v_estado
      using errcode = '23514';
  end if;
  if v_hash is distinct from new.hash then
    raise exception 'El hash de la aprobación no es el del borrador %', new.plan_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validar_aprobacion_plan_estrategico() from public, anon, authenticated;

drop trigger if exists trg_validar_aprobacion_plan_estrategico on public.aprobaciones_plan_estrategico;
create trigger trg_validar_aprobacion_plan_estrategico
  before insert on public.aprobaciones_plan_estrategico
  for each row execute function public.validar_aprobacion_plan_estrategico();

alter table public.aprobaciones_plan_estrategico enable row level security;

-- Lectura: quien tenga `leer_entrenamiento`. El asesorado NO ve su fila (trámite interno).
drop policy if exists aprobaciones_plan_estrategico_leer on public.aprobaciones_plan_estrategico;
create policy aprobaciones_plan_estrategico_leer on public.aprobaciones_plan_estrategico
  for select to authenticated
  using ((select public.tiene_capacidad('leer_entrenamiento')));

revoke all on public.aprobaciones_plan_estrategico from anon, public;
revoke insert, update, delete, truncate on public.aprobaciones_plan_estrategico from authenticated;
grant select on public.aprobaciones_plan_estrategico to authenticated;
grant all on public.aprobaciones_plan_estrategico to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · Encender un borrador (interna: la usan la RPC y el vencimiento)
-- ────────────────────────────────────────────────────────────────────────────
-- Apaga el vigente (→ 'reemplazado') y enciende el borrador (→ 'vigente') en la
-- transacción de quien llama. Falla si el borrador ya no es borrador o si su hash cambió.
create or replace function public.encender_plan_estrategico(p_plan_id uuid, p_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.planes_estrategicos%rowtype;
begin
  select p.* into v_plan
    from public.planes_estrategicos p
   where p.id = p_plan_id
   for update;
  if not found then
    raise exception 'El borrador % no existe', p_plan_id using errcode = 'P0002';
  end if;
  if v_plan.estado <> 'borrador' then
    raise exception 'El plan % ya no es un borrador (estado: %)', p_plan_id, v_plan.estado
      using errcode = '22023';
  end if;
  if v_plan.hash is distinct from p_hash then
    raise exception 'El borrador % cambió desde que se propuso (hash distinto)', p_plan_id
      using errcode = '22023';
  end if;

  -- Primero apagar (el índice único parcial no se puede diferir), luego encender.
  update public.planes_estrategicos p
     set vigente = false, estado = 'reemplazado'
   where p.usuario_id = v_plan.usuario_id and p.vigente;

  update public.planes_estrategicos p
     set vigente = true, estado = 'vigente'
   where p.id = p_plan_id;
end;
$$;

revoke all on function public.encender_plan_estrategico(uuid, text) from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6 · RPC decidir_plan_estrategico(aprobacion_id, decision, motivo)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.decidir_plan_estrategico(aprobacion_id uuid, decision text, motivo text default null)
returns public.aprobaciones_plan_estrategico
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  quien     uuid := auth.uid();
  fila      public.aprobaciones_plan_estrategico%rowtype;
  v_motivo  text := nullif(btrim(coalesce(motivo, '')), '');
begin
  if quien is null then
    raise exception 'Falta sesión' using errcode = '28000';
  end if;

  if not public.tiene_capacidad('aprobar_plan_estrategico') then
    raise exception 'No tienes permiso para decidir planes estratégicos' using errcode = '42501';
  end if;

  if decision is null or decision not in ('aprobar', 'rechazar') then
    raise exception 'Decisión desconocida: %', decision using errcode = '22023';
  end if;

  select a.* into fila
    from public.aprobaciones_plan_estrategico a
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
    update public.aprobaciones_plan_estrategico a
       set estado = 'rechazado', decidido_por = quien, decidido_en = now(),
           motivo = v_motivo, actualizado_en = now()
     where a.id = aprobacion_id
    returning * into fila;
    -- El borrador queda rechazado (nunca lo verá el asesorado). Solo si sigue siendo
    -- borrador: un plan ya vigente no se toca desde aquí.
    update public.planes_estrategicos p
       set estado = 'rechazado'
     where p.id = fila.plan_id and p.estado = 'borrador';
    return fila;
  end if;

  -- Aprobar. Lo clínico, el riesgo alto y lo que ya espera a Bryan solo lo aprueba quien
  -- tenga `autorizar_excepcion`.
  if (fila.riesgo = 'alto' or fila.clinico or fila.estado = 'espera_bryan')
     and not public.tiene_capacidad('autorizar_excepcion') then
    raise exception 'Este plan lo aprueba Bryan (riesgo %, clínico %, estado %)',
      fila.riesgo, fila.clinico, fila.estado
      using errcode = '42501';
  end if;

  update public.aprobaciones_plan_estrategico a
     set estado = 'aprobado', decidido_por = quien, decidido_en = now(),
         motivo = v_motivo, actualizado_en = now()
   where a.id = aprobacion_id
  returning * into fila;

  perform public.encender_plan_estrategico(fila.plan_id, fila.hash);

  return fila;
end;
$$;

revoke all on function public.decidir_plan_estrategico(uuid, text, text) from public, anon;
grant execute on function public.decidir_plan_estrategico(uuid, text, text) to authenticated, service_role;

comment on function public.decidir_plan_estrategico(uuid, text, text) is
  'Aprueba o rechaza un plan estratégico renovado. Actor = auth.uid(); exige '
  'aprobar_plan_estrategico; aprobar riesgo alto, clínico o algo en espera_bryan exige además '
  'autorizar_excepcion. Aprobar apaga el vigente y enciende el borrador en la misma '
  'transacción; rechazar deja aprobación y borrador en rechazado.';

-- ────────────────────────────────────────────────────────────────────────────
-- 7 · vencer_plan_estrategico(): para service_role / cron
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vencer_plan_estrategico()
returns table (aprobados int, a_bryan int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r         record;
  v_estado  text;
  v_hash    text;
  n_aprob   int := 0;
  n_bryan   int := 0;
  v_espera  text;
begin
  for r in
    select a.*
      from public.aprobaciones_plan_estrategico a
     where a.estado = 'propuesto' and a.plazo_hasta <= now()
     order by a.plazo_hasta
     for update skip locked
  loop
    select p.estado, p.hash into v_estado, v_hash from public.planes_estrategicos p where p.id = r.plan_id;

    v_espera := case
      when r.clinico           then 'Clínico: nunca pasa sin Bryan.'
      when r.riesgo = 'alto'   then 'Riesgo alto: nunca pasa sin Bryan.'
      when r.riesgo = 'medio'  then 'Riesgo medio: al vencer el plazo no pasa solo.'
      when cardinality(r.dudas_pendientes) > 0 then
        'Dudas pendientes que frenan la progresión: ' || array_to_string(r.dudas_pendientes, '; ')
      when jsonb_array_length(r.preguntas_para_bryan) > 0 then
        'Hay ' || jsonb_array_length(r.preguntas_para_bryan) || ' pregunta(s) abiertas para Bryan.'
      when v_estado is distinct from 'borrador' then
        'El plan ya no es un borrador (estado: ' || coalesce(v_estado, 'no existe') || ').'
      when v_hash is distinct from r.hash then
        'El borrador cambió desde que se propuso (hash distinto).'
      else null
    end;

    if v_espera is null then
      begin
        update public.aprobaciones_plan_estrategico
           set estado = 'vencido_aprobado', decidido_por = null, decidido_en = now(),
               motivo = 'Plazo vencido sin objeciones: riesgo bajo, no clínico y sin dudas pendientes.',
               actualizado_en = now()
         where id = r.id;
        perform public.encender_plan_estrategico(r.plan_id, r.hash);
        n_aprob := n_aprob + 1;
        continue;
      exception when others then
        v_espera := 'No se pudo publicar al vencer: ' || sqlerrm;
      end;
    end if;

    update public.aprobaciones_plan_estrategico
       set estado = 'espera_bryan', motivo_espera = v_espera, actualizado_en = now()
     where id = r.id;
    n_bryan := n_bryan + 1;
  end loop;

  aprobados := n_aprob;
  a_bryan := n_bryan;
  return next;
end;
$$;

revoke all on function public.vencer_plan_estrategico() from public, anon, authenticated;
grant execute on function public.vencer_plan_estrategico() to service_role;

comment on function public.vencer_plan_estrategico() is
  'Al vencer el plazo: pasa (vencido_aprobado + encender el borrador) solo riesgo bajo, no '
  'clínico, sin dudas ni preguntas para Bryan; el resto queda en espera_bryan. Solo '
  'service_role (cron / cinta).';

-- Cada 15 minutos donde haya pg_cron (producción), con la misma guarda que la 0086.
do $cron_plan_estrategico$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $q$
      select cron.schedule('vencer-plan-estrategico', '*/15 * * * *', 'select public.vencer_plan_estrategico();')
    $q$;
  else
    raise notice 'pg_cron no está disponible: vencer_plan_estrategico() no queda programada; que la llame la cinta.';
  end if;
end
$cron_plan_estrategico$;

commit;
