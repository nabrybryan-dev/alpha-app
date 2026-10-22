-- ============================================================================
-- BORRADOR, NO ESTÁ APLICADA, la numera y aplica Bryan
-- Praxis · el canal «proponer al coach»: tabla `praxis_propuestas_coach`
-- ============================================================================
--
-- ESTO ES TEXTO. No es una migración: no está en `supabase/migrations/`, no tiene número y nadie la
-- ha corrido. Bryan la numera (hay que mirar todas las ramas el día de aplicar), la mueve a
-- `supabase/migrations/` y la aplica a mano en el SQL Editor. Si algo sale mal después de aplicada,
-- NO se edita: se escribe una migración nueva.
--
-- DE DÓNDE SALE. `DISENO-CANAL-PROPONER-AL-COACH-20261021.md` y las respuestas de Bryan del 21-oct-2026
-- (`DECISIONES-CANAL-PROPONER-AL-COACH-20261021.md`), que mandan donde difieren. Patrones copiados de
-- 0105 (tope por persona con candado, grant insert por columnas), 0108 (la persona inserta y NO lee,
-- sin columna de texto a propósito, dedupe silencioso) y 0110 (funciones security definer con
-- search_path fijo).
--
-- DECISIONES DE BRYAN QUE ESTE BORRADOR CUMPLE
--   1. Una sola tabla, con `tipo`: 'bajar_carga' o 'voy_a_escribirte'.
--   2. La nutricionista ve y atiende SOLO 'voy_a_escribirte'. Las cargas no las ve.
--   3. Sin serie registrada NO hay fila: Praxis le pide una serie a la persona antes (eso es de la app).
--   4. El `tema` de 'voy_a_escribirte' (animo, alimentacion, otro) se guarda como lista cerrada.
--      La retención de texto de salud mental la sigue revisando el abogado: por eso NO hay ninguna
--      columna de texto libre en esta tabla, ni de la persona ni del coach.
--   5. Plazo de 12 horas (`vence_en`). Pasado el plazo la fila sigue 'pendiente'; la consola la pinta
--      «vencida» en rojo suave. NO hay respuesta automática de Praxis (espera al psicólogo y al abogado).
--   6. El cálculo de la carga se hace en la app; la base solo comprueba rangos y que la propuesta baje.
--      La consola recalcula desde la serie de origen y marca «no coincide» si difiere.
--   7. `regla_firmada` es false y un check lo obliga: la tabla del RIR por cansancio está firmada por
--      Bryan pero con revisión profesional pendiente. El día que se pase a true hace falta otra migración.
--   8. `aplicada_en` solo se fija cuando el coach aplicó la carga al plan y la escritura confirmó.
--   9. No se anota en `anotarDecision`: esta fila ya guarda quién, cuándo y qué kilos.
--
-- QUIÉN PUEDE QUÉ
--   · La persona: inserta lo suyo (solo columnas de la propuesta, nunca estado ni decisión) y NO lee
--     nada, ni lo suyo: la fila lleva un número que la persona no debe ver (LENGUAJE-DE-PRAXIS §3.6).
--   · El coach: lee todo y decide (aceptar, ajustar, rechazar, atender) y marca `aplicada_en`.
--   · La nutricionista: lee y atiende SOLO 'voy_a_escribirte', y solo hacia 'atendida'.
--   · anon: nada. Nadie borra por la API (se purga con service_role).
--
-- ANTES DE APLICAR (pasos de Bryan): numerar; correr una comprobación que diga NO; revisor aparte con
-- defecto sembrado (un select que deje leer a la persona, una columna de texto, la nutricionista leyendo
-- cargas); aplicar; correr la comprobación que diga SI; prueba de dos sesiones a la vez para el tope.
-- ============================================================================

begin;

create table if not exists public.praxis_propuestas_coach (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references public.usuarios_app(id) on delete cascade,
  tipo               text not null check (tipo in ('bajar_carga', 'voy_a_escribirte')),
  creado_en          timestamptz not null default now(),
  vence_en           timestamptz not null default now() + interval '12 hours',
  estado             text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'ajustada', 'rechazada', 'atendida')),

  -- Solo 'bajar_carga' (null en 'voy_a_escribirte'). Identificadores y números: ninguna frase.
  microciclo_id      text check (microciclo_id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  ejercicio_id       text check (ejercicio_id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  cansancio          text check (cansancio in ('algo', 'mucho')),
  motivo             text check (motivo in ('cansancio', 'tecnica', 'otro')),
  serie_carga_kg     numeric(6,2) check (serie_carga_kg > 0),
  serie_reps         smallint check (serie_reps between 1 and 100),
  serie_rir          smallint check (serie_rir between 0 and 10),
  rir_objetivo       smallint check (rir_objetivo between 0 and 15),
  un_rm_kg           numeric(6,2) check (un_rm_kg > 0),
  carga_propuesta_kg numeric(6,2) check (carga_propuesta_kg > 0),
  razon_sin_calculo  text check (razon_sin_calculo in ('fuera_de_tabla', 'no_baja')),
  salto_kg           numeric(4,2) check (salto_kg > 0),
  regla_firmada      boolean not null default false check (regla_firmada = false),

  -- Solo 'voy_a_escribirte' (null en 'bajar_carga'). Listas cerradas y un identificador de ficha.
  origen_contacto    text check (origen_contacto in ('ficha', 'filtro_clinico')),
  ficha_id           text check (ficha_id ~ '^[a-z0-9-]{1,60}$'),
  tema               text check (tema in ('animo', 'alimentacion', 'otro')),

  -- Lo que pone la base al decidir (nunca el cliente).
  decidido_por       uuid references public.usuarios_app(id) on delete set null,
  decidido_en        timestamptz,
  carga_decidida_kg  numeric(6,2) check (carga_decidida_kg > 0),
  motivo_rechazo     text check (motivo_rechazo in ('no_corresponde', 'ya_ajustado', 'lo_hablo_con_la_persona', 'otro')),
  aplicada_en        timestamptz,

  constraint propuesta_carga_completa check (
    tipo <> 'bajar_carga' or (
      microciclo_id is not null and ejercicio_id is not null and cansancio is not null and motivo is not null
      and serie_carga_kg is not null and serie_reps is not null and serie_rir is not null
      and rir_objetivo is not null and salto_kg is not null
      and origen_contacto is null and ficha_id is null and tema is null
    )
  ),
  constraint propuesta_carga_numero check (
    tipo <> 'bajar_carga' or (
      (carga_propuesta_kg is not null and un_rm_kg is not null and carga_propuesta_kg < serie_carga_kg and razon_sin_calculo is null)
      or (carga_propuesta_kg is null and razon_sin_calculo is not null)
    )
  ),
  constraint propuesta_contacto_completa check (
    tipo <> 'voy_a_escribirte' or (
      origen_contacto is not null and ficha_id is not null and tema is not null
      and microciclo_id is null and ejercicio_id is null and cansancio is null and motivo is null
      and serie_carga_kg is null and serie_reps is null and serie_rir is null and rir_objetivo is null
      and un_rm_kg is null and carga_propuesta_kg is null and razon_sin_calculo is null and salto_kg is null
      and carga_decidida_kg is null and motivo_rechazo is null
    )
  ),
  constraint propuesta_estado_coherente check (
    (estado = 'pendiente' and decidido_en is null and carga_decidida_kg is null and motivo_rechazo is null and aplicada_en is null)
    or (estado = 'aceptada' and tipo = 'bajar_carga' and decidido_en is not null and carga_decidida_kg = carga_propuesta_kg)
    or (estado = 'ajustada' and tipo = 'bajar_carga' and decidido_en is not null and carga_decidida_kg is not null and carga_decidida_kg is distinct from carga_propuesta_kg)
    or (estado = 'rechazada' and tipo = 'bajar_carga' and decidido_en is not null and motivo_rechazo is not null)
    or (estado = 'atendida' and tipo = 'voy_a_escribirte' and decidido_en is not null)
  ),
  constraint propuesta_aplicada_solo_si_acepto check (aplicada_en is null or estado in ('aceptada', 'ajustada'))
);

comment on table public.praxis_propuestas_coach is
  'BORRADOR (sin numerar). Propuestas de Praxis al coach: bajar_carga y voy_a_escribirte. SIN ninguna columna de '
  'texto libre. La persona inserta lo suyo y no lee nada; el coach lee y decide; la nutricionista solo ve voy_a_escribirte.';

create index if not exists praxis_propuestas_pendientes
  on public.praxis_propuestas_coach (creado_en desc) where estado = 'pendiente';
create index if not exists praxis_propuestas_por_persona
  on public.praxis_propuestas_coach (usuario_id, tipo, creado_en desc);

alter table public.praxis_propuestas_coach enable row level security;

-- ────────────────────────────────────────────────────────────────────────────
-- Al insertar: la fila nace limpia, sin repetidos y con tope por persona
-- (el repetido de «voy a escribirte» exige mismo tema y mismo origen: otro tema u otro origen es otra señal)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.praxis_propuesta_nace_limpia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_abiertas integer;
begin
  if auth.uid() is null then
    return new;  -- service_role puede sembrar
  end if;
  new.creado_en := now();
  new.vence_en := now() + interval '12 hours';
  new.estado := 'pendiente';
  new.decidido_por := null;
  new.decidido_en := null;
  new.carga_decidida_kg := null;
  new.motivo_rechazo := null;
  new.aplicada_en := null;
  -- El candado por persona: dos inserciones a la vez se ponen en fila y la segunda ve a la primera.
  perform pg_advisory_xact_lock(hashtext('praxis_propuestas_coach:' || new.usuario_id::text));
  if exists (
    select 1
      from public.praxis_propuestas_coach p
     where p.usuario_id = new.usuario_id
       and p.tipo = new.tipo
       and p.estado = 'pendiente'
       and (
         (new.tipo = 'bajar_carga' and p.ejercicio_id = new.ejercicio_id)
         or (new.tipo = 'voy_a_escribirte' and p.tema = new.tema and p.origen_contacto = new.origen_contacto and p.creado_en > now() - interval '1 day')
       )
  ) then
    return null;  -- ya hay una igual sin atender: se descarta sin error
  end if;
  select count(*) into v_abiertas
    from public.praxis_propuestas_coach p
   where p.usuario_id = new.usuario_id and p.estado = 'pendiente';
  if v_abiertas >= 5 then
    raise exception 'demasiadas propuestas pendientes' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.praxis_propuesta_nace_limpia() from public, anon, authenticated;

drop trigger if exists trg_praxis_propuesta_nace_limpia on public.praxis_propuestas_coach;
create trigger trg_praxis_propuesta_nace_limpia
  before insert on public.praxis_propuestas_coach
  for each row execute function public.praxis_propuesta_nace_limpia();

-- ────────────────────────────────────────────────────────────────────────────
-- Al actualizar: quién y cuándo los pone la base; lo decidido no se reescribe
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.praxis_propuesta_no_reescribe()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;  -- service_role
  end if;
  if old.estado <> 'pendiente' then
    -- Ya decidida: lo único que se admite es fijar `aplicada_en` por primera vez, y solo el coach.
    if old.aplicada_en is not null or new.aplicada_en is null or not (select public.es_coach()) then
      raise exception 'la propuesta ya está decidida' using errcode = 'check_violation';
    end if;
    new := old;
    new.aplicada_en := now();
    return new;
  end if;
  -- Lo que nunca cambia por la API.
  new.id := old.id;
  new.usuario_id := old.usuario_id;
  new.tipo := old.tipo;
  new.creado_en := old.creado_en;
  new.vence_en := old.vence_en;
  -- Pendiente que se decide ahora: quién y cuándo, de la base.
  if new.estado <> 'pendiente' then
    new.decidido_por := auth.uid();
    new.decidido_en := now();
  end if;
  -- La nutricionista solo cierra 'voy_a_escribirte': nada de kilos ni de aplicar.
  if not (select public.es_coach()) then
    new.carga_decidida_kg := null;
    new.motivo_rechazo := null;
    new.aplicada_en := null;
  end if;
  -- Decidir y aplicar son dos pasos: aquí nunca nace aplicada. `aplicada_en` solo se fija después, en un
  -- segundo UPDATE del coach, cuando la escritura al plan confirmó (decisión 8 de Bryan).
  new.aplicada_en := null;
  return new;
end;
$$;

revoke all on function public.praxis_propuesta_no_reescribe() from public, anon, authenticated;

drop trigger if exists trg_praxis_propuesta_no_reescribe on public.praxis_propuestas_coach;
create trigger trg_praxis_propuesta_no_reescribe
  before update on public.praxis_propuestas_coach
  for each row execute function public.praxis_propuesta_no_reescribe();

-- ────────────────────────────────────────────────────────────────────────────
-- Políticas
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists praxis_propuestas_insertar_propia on public.praxis_propuestas_coach;
create policy praxis_propuestas_insertar_propia on public.praxis_propuestas_coach
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

-- Lee el coach todo; la nutricionista solo 'voy_a_escribirte'. La persona no lee nada, ni lo suyo.
drop policy if exists praxis_propuestas_leer on public.praxis_propuestas_coach;
create policy praxis_propuestas_leer on public.praxis_propuestas_coach
  for select to authenticated
  using ((select public.es_coach()) or ((select public.es_nutricionista()) and tipo = 'voy_a_escribirte'));

-- El coach decide y marca aplicada (el trigger impide reescribir lo decidido).
drop policy if exists praxis_propuestas_decidir_coach on public.praxis_propuestas_coach;
create policy praxis_propuestas_decidir_coach on public.praxis_propuestas_coach
  for update to authenticated
  using ((select public.es_coach()))
  with check ((select public.es_coach()));

-- La nutricionista: solo 'voy_a_escribirte' pendiente, y solo hacia 'atendida'.
drop policy if exists praxis_propuestas_atender_nutricionista on public.praxis_propuestas_coach;
create policy praxis_propuestas_atender_nutricionista on public.praxis_propuestas_coach
  for update to authenticated
  using ((select public.es_nutricionista()) and tipo = 'voy_a_escribirte' and estado = 'pendiente')
  with check ((select public.es_nutricionista()) and tipo = 'voy_a_escribirte' and estado = 'atendida');

-- Sin política de delete: una propuesta no se borra por la API.
revoke all on public.praxis_propuestas_coach from anon, public;
revoke all on public.praxis_propuestas_coach from authenticated;
grant select on public.praxis_propuestas_coach to authenticated;
-- Al insertar solo viajan las columnas de la propuesta; el estado, las horas y la decisión los pone la base.
grant insert (usuario_id, tipo, microciclo_id, ejercicio_id, cansancio, motivo, serie_carga_kg, serie_reps, serie_rir, rir_objetivo, un_rm_kg, carga_propuesta_kg, razon_sin_calculo, salto_kg, origen_contacto, ficha_id, tema) on public.praxis_propuestas_coach to authenticated;
-- Al decidir solo se tocan estas; quién y cuándo los fija el trigger.
grant update (estado, carga_decidida_kg, motivo_rechazo, aplicada_en) on public.praxis_propuestas_coach to authenticated;
grant all on public.praxis_propuestas_coach to service_role;

commit;
