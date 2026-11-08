-- ============================================================================
-- 0176 · Praxis: el cuaderno de anotaciones de cada persona (recuperación de una zona, reacción a una comida)
-- ============================================================================
--
-- SIN APLICAR. Escrita el 8-nov-2026 por decisión de Bryan (chat, opción a del cuaderno propio). Aplicarla es otro sí.
-- La prueba `supabase/test/272-praxis-anotaciones-persona.sql` corre en el CI. NO SE EJECUTÓ en un Postgres local.
--
-- NÚMERO. Revisado el 8-nov: la base real llega a 0171 (list_migrations); origin/main trae 0172 y 0173;
-- `origin/praxis/busqueda-mixta` trae 0174. Nació como 0175; al rechequear antes de aplicar (8-nov) apareció
-- `origin/claude/cadena-codigo-0175-20261108` con su propio 0175 (cadena_respuestas_con_codigo), y se renumeró a 0176.
-- Ninguna rama remota trae 0176 ni un test 272. Volver a mirar `origin/*` y `schema_migrations` justo antes de aplicarla.
--
-- PARA QUÉ. Bryan firmó los seis huecos de los conectores el 8-nov. Dos frases no llenan ningún campo del check-in,
-- pero dicen algo que vale la pena revisar más adelante:
--   · «estoy molida de las piernas»  -> recuperación tardía de esa zona.
--   · «me sentí pesada después del almuerzo» -> cómo reacciona su organismo a esa comida o cantidad (patrón).
-- Se guardan como ANOTACIÓN con fecha y la cita de la persona, no como valor del check-in. Nada se anota sin que la
-- persona toque la tarjeta (mismo criterio del check-in); eso lo hace la app, esta migración solo da dónde guardar.
--
-- QUÉ GUARDA Y QUÉ NO.
--   · Por anotación: el día (Bogotá), el tipo (recuperacion_zona | reaccion_comida), la zona o el momento de la comida,
--     el alimento si lo dijo, y la CITA literal de la persona (hasta 300 caracteres).
--   · No guarda diagnósticos ni dolor con número: el dolor > 0 sigue sin escribirse por Praxis.
--   · NO entra al entrenamiento del modelo propio ni a la destilación: es dato de salud de una persona.
--
-- QUIÉN PUEDE QUÉ (igual que la 0171).
--   · LEER: solo la persona dueña (`usuario_id = auth.uid()`). El equipo NO la lee. Si Bryan quiere que el coach o la
--     nutricionista revisen el patrón, es otra decisión y otra política.
--   · ESCRIBIR: nadie directo; solo `praxis_anotar_patron` (security definer, `auth.uid()`, sin `usuario_id`).
--     Es idempotente por `clave` (un mensaje no se anota dos veces). Tope de 2000 por persona.
--   · BORRAR: la persona, todo lo suyo, con `praxis_olvidar_mis_anotaciones()` (supresión, Ley 1581). Al borrar la
--     cuenta se va sola (`on delete cascade`).
--   · anon: nada.
--
-- CÓMO REVERTIRLA:
--   begin;
--   drop function if exists public.praxis_olvidar_mis_anotaciones();
--   drop function if exists public.praxis_anotar_patron(text, text, text, text, text, text, date);
--   drop table if exists public.praxis_anotaciones_persona;
--   commit;
--   (Se pierden las anotaciones; ningún otro dato depende de esto.)
-- ============================================================================

begin;

create table if not exists public.praxis_anotaciones_persona (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios_app (id) on delete cascade,
  dia         date not null,
  tipo        text not null check (tipo in ('recuperacion_zona', 'reaccion_comida')),
  zona        text check (zona is null or (length(zona) between 1 and 40 and zona ~ '^[a-z]+( [a-z]+){0,3}$')),
  momento     text check (momento is null or momento in ('desayuno', 'almuerzo', 'cena', 'merienda', 'otro')),
  alimento    text check (alimento is null or length(alimento) between 1 and 60),
  cita        text not null check (length(cita) between 1 and 300),
  clave       text not null check (length(clave) between 1 and 80),
  creada_en   timestamptz not null default now(),
  unique (usuario_id, clave),
  -- Cada tipo pide lo suyo: una recuperación dice la zona; una reacción dice cuándo comió.
  constraint praxis_anotaciones_persona_tipo_completo check (
    (tipo = 'recuperacion_zona' and zona is not null and momento is null and alimento is null)
    or (tipo = 'reaccion_comida' and momento is not null and zona is null)
  )
);

create index if not exists praxis_anotaciones_persona_por_dia
  on public.praxis_anotaciones_persona (usuario_id, tipo, dia desc);

comment on table public.praxis_anotaciones_persona is
  'Cuaderno de la persona (0176, 2026-11-08): recuperacion tardia de una zona o reaccion a una comida, con fecha y su cita. '
  'Solo la lee la persona; solo la escribe praxis_anotar_patron; la persona la borra con praxis_olvidar_mis_anotaciones. No entra al entrenamiento.';

alter table public.praxis_anotaciones_persona enable row level security;

drop policy if exists praxis_anotaciones_persona_leer_propio on public.praxis_anotaciones_persona;
create policy praxis_anotaciones_persona_leer_propio on public.praxis_anotaciones_persona
  for select to authenticated
  using (usuario_id = (select auth.uid()));

revoke all on public.praxis_anotaciones_persona from anon, public;
revoke all on public.praxis_anotaciones_persona from authenticated;
grant select on public.praxis_anotaciones_persona to authenticated;
grant all on public.praxis_anotaciones_persona to service_role;

-- ---------------------------------------------------------------------------
-- Anotar un patrón (idempotente por clave)
-- ---------------------------------------------------------------------------
create or replace function public.praxis_anotar_patron(
  p_tipo text, p_zona text, p_momento text, p_alimento text, p_cita text, p_clave text, p_dia date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_hoy   date := (now() at time zone 'America/Bogota')::date;
  v_dia   date := coalesce(p_dia, (now() at time zone 'America/Bogota')::date);
  v_cita  text := btrim(p_cita);
  v_clave text := btrim(p_clave);
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'praxis_anotar_patron: hace falta una sesion' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('recuperacion_zona', 'reaccion_comida') then
    raise exception 'praxis_anotar_patron: tipo desconocido' using errcode = '22023';
  end if;
  if v_dia > v_hoy then
    raise exception 'praxis_anotar_patron: no se anota en un dia futuro' using errcode = '22023';
  end if;
  if v_cita is null or length(v_cita) not between 1 and 300 or v_clave is null or length(v_clave) not between 1 and 80 then
    raise exception 'praxis_anotar_patron: cita (1-300) y clave (1-80) obligatorias' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('anot-' || v_uid::text));

  if not exists (select 1 from public.praxis_anotaciones_persona a where a.usuario_id = v_uid and a.clave = v_clave)
     and (select count(*) from public.praxis_anotaciones_persona a where a.usuario_id = v_uid) >= 2000 then
    raise exception 'praxis_anotar_patron: tope de 2000 anotaciones por persona' using errcode = '22023';
  end if;

  insert into public.praxis_anotaciones_persona (usuario_id, dia, tipo, zona, momento, alimento, cita, clave)
  values (v_uid, v_dia, p_tipo, nullif(btrim(p_zona), ''), nullif(btrim(p_momento), ''), nullif(btrim(p_alimento), ''), v_cita, v_clave)
  on conflict (usuario_id, clave) do nothing
  returning id into v_id;

  if v_id is null then
    select a.id into v_id from public.praxis_anotaciones_persona a where a.usuario_id = v_uid and a.clave = v_clave;
    return jsonb_build_object('id', v_id, 'repetida', true);
  end if;
  return jsonb_build_object('id', v_id, 'repetida', false);
end
$$;

comment on function public.praxis_anotar_patron(text, text, text, text, text, text, date) is
  'Anota en el cuaderno de quien llama una recuperacion de zona o una reaccion a comida, con su cita. Idempotente por clave; sin dias futuros (Bogota). auth.uid(); sin usuario_id. 0176.';

revoke execute on function public.praxis_anotar_patron(text, text, text, text, text, text, date) from public, anon;
grant execute on function public.praxis_anotar_patron(text, text, text, text, text, text, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Olvidar todo lo anotado de quien llama
-- ---------------------------------------------------------------------------
create or replace function public.praxis_olvidar_mis_anotaciones()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_n   int;
begin
  if v_uid is null then
    raise exception 'praxis_olvidar_mis_anotaciones: hace falta una sesion' using errcode = '42501';
  end if;
  delete from public.praxis_anotaciones_persona where usuario_id = v_uid;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

comment on function public.praxis_olvidar_mis_anotaciones() is
  'Borra todo el cuaderno de anotaciones de quien llama (derecho a supresion). Devuelve cuantas borro. 0176.';

revoke execute on function public.praxis_olvidar_mis_anotaciones() from public, anon;
grant execute on function public.praxis_olvidar_mis_anotaciones() to authenticated, service_role;

commit;
