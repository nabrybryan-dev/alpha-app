-- ============================================================================
-- 0105 · Praxis: la «pregunta en espera»
-- ============================================================================
--
-- NO ESTÁ APLICADA. La escribió la rama `feat/praxis-conexion` el 1-oct-2026 y la aplica
-- Bryan, a mano, en el SQL Editor (ver `PASOS-DE-BRYAN.md`). Sin ella la pantalla de
-- Praxis sigue funcionando: al ofrecer «¿Se lo pregunto a tu coach?» y recibir el «sí»,
-- dice que todavía no puede dejar la pregunta, y no finge que la dejó.
--
-- NÚMERO. Comprobado el 1-oct contra todas las ramas locales y remotas: la más alta que
-- alguna trae es la 0104 (`hallazgos_autor_real`), que esa misma noche entró en `main` con
-- el PR #329; la 0093 es de `feat/salud-atajo`. La 0105 es el siguiente libre. Si otra rama la coge antes de que
-- esta se aplique, se renumera AQUÍ, antes de aplicar: nunca después.
--
-- QUÉ PROBLEMA RESUELVE. Decisión D6 de Bryan (29-sep) y plazos de PD-8 (30-sep): cuando
-- Praxis no sabe algo, no inventa ni se queda callada. Ofrece «¿Se lo pregunto a tu coach?
-- Te aviso cuando responda» —«tu nutricionista» si es de comida, nunca un nombre propio— y,
-- solo con el «sí» de la persona, deja la pregunta en una bandeja. Esta tabla es esa
-- bandeja. La regla de armado vive en `src/domain/praxis/enEspera.ts` y quien escribe aquí
-- es `src/data/praxis/preguntasEnEspera.ts`, con la sesión de la persona.
--
-- QUÉ GUARDA Y QUÉ NO. La pregunta en palabras de la persona (hasta 500 caracteres), a
-- quién va por ROL, qué le faltó a Praxis y las REFERENCIAS de lo que tenía delante
-- (`M6 · PIERNA A · SENTADILLA · prescripcion`), no el contenido. Una frase con señal de
-- riesgo o de salud no llega aquí: el filtro de `domain/praxis/riesgo.ts` la detiene antes
-- y va por la capa de seguridad. Esta tabla NO entra al aprendizaje de Praxis (D5).
--
-- QUIÉN PUEDE QUÉ.
--   · La persona: inserta la suya (como mucho 2 abiertas, con un trigger que no se salta
--     ni con varias filas en una sentencia ni con dos inserciones a la vez) y lee las suyas. No la edita, no
--     la responde y no la borra: ni puede contestarse a sí misma ni reabrir una cerrada.
--   · El coach: lee todas y responde.
--   · La nutricionista: lee y responde SOLO las que van a `nutricionista`. Está acotada a
--     propósito desde la 0013 y no se la trata como staff con acceso total.
--   · anon: nada.
--
-- QUÉ NO ENTRA. La bandeja en la consola del coach (no está construida: hasta entonces las
-- preguntas se leen en el Table Editor), el aviso a la persona cuando llega la respuesta y
-- el recordatorio a las 24 horas. Tampoco se toca ninguna tabla existente.
--
-- CÓMO COMPROBAR QUE LA POLÍTICA FUNCIONA (después de aplicar):
--   1. `supabase/comprobar-migraciones.sql`: las seis filas `0105 - …` dicen SI. Corrido
--      ANTES de aplicar tienen que decir NO.
--   2. Con la sesión de un asesorado, insertar una fila con `usuario_id` de OTRA persona
--      tiene que fallar (RLS), e insertar la tercera abierta propia también, aunque vaya en
--      la misma sentencia que las otras dos.
--   3. Con la sesión de un asesorado, `update … set respuesta = 'x'` no toca ninguna fila.
--   4. Con la sesión de la nutricionista, `select` no devuelve las de `destinatario = 'coach'`.
--
-- SEGURIDAD, la regla de siempre (`GUIA-BRYAN.md` §10): RLS en el mismo paso que el
-- `create table`, `revoke all from anon, public` antes de conceder nada, y toda función
-- `security definer` con `search_path` fijo y sin `execute` para `public` ni `anon`.
-- ============================================================================

begin;

create table if not exists public.praxis_preguntas_en_espera (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references public.usuarios_app(id) on delete cascade,
  -- En palabras de la persona. Texto limpio: el filtro de riesgo corre antes, en la app.
  pregunta        text not null check (length(btrim(pregunta)) between 1 and 500),
  -- Un ROL, nunca un nombre (D6).
  destinatario    text not null check (destinatario in ('coach', 'nutricionista')),
  -- Qué le faltó a Praxis. Mismo enum que `QueFalto` en `domain/praxis/plan/responder.ts`.
  que_falto       text not null check (que_falto in (
                    'sin_plan_activo', 'sin_dato', 'porque_no_escrito', 'cambio_del_plan', 'fuera_del_plan', 'no_entendido')),
  -- Referencias de lo citado, no el contenido. Como mucho 8.
  citas           jsonb not null default '[]'::jsonb
                    check (jsonb_typeof(citas) = 'array' and jsonb_array_length(citas) <= 8),
  estado          text not null default 'abierta' check (estado in ('abierta', 'respondida', 'cerrada')),
  respuesta       text check (respuesta is null or length(btrim(respuesta)) > 0),
  respondida_por  uuid references public.usuarios_app(id),
  respondida_en   timestamptz,
  -- 24 horas (PD-8). Pasado el plazo sigue `abierta`: «vencida» es `vence_en < now()`.
  vence_en        timestamptz not null default (now() + interval '24 hours'),
  creado_en       timestamptz not null default now(),
  -- Una respondida trae respuesta, quién y cuándo; una abierta no trae nada de eso.
  constraint praxis_pregunta_respondida_completa check (
    (estado = 'respondida' and respuesta is not null and respondida_por is not null and respondida_en is not null)
    or (estado <> 'respondida')
  ),
  constraint praxis_pregunta_abierta_sin_respuesta check (
    estado <> 'abierta' or (respuesta is null and respondida_por is null and respondida_en is null)
  )
);

comment on table public.praxis_preguntas_en_espera is
  'Preguntas que Praxis no supo contestar y que la persona pidió pasarle a su coach o a su '
  'nutricionista (D6). La dueña inserta y lee las suyas; el coach lee y responde todas; la '
  'nutricionista, solo las suyas. Sin datos clínicos: el filtro de riesgo corre antes.';

create index if not exists praxis_preguntas_por_usuario
  on public.praxis_preguntas_en_espera (usuario_id, creado_en desc);
create index if not exists praxis_preguntas_abiertas
  on public.praxis_preguntas_en_espera (destinatario, creado_en) where estado = 'abierta';

alter table public.praxis_preguntas_en_espera enable row level security;

-- ────────────────────────────────────────────────────────────────────────────
-- Cuántas tiene abiertas quien llama: para que la app lo pueda preguntar. El tope NO se
-- hace con esto (ver el trigger de abajo). No recibe el usuario por parámetro: una función
-- que aceptara un uuid dejaría contar las de otra persona por RPC.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.praxis_mis_preguntas_abiertas()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.praxis_preguntas_en_espera
   where usuario_id = auth.uid() and estado = 'abierta';
$$;

revoke all on function public.praxis_mis_preguntas_abiertas() from public, anon;
grant execute on function public.praxis_mis_preguntas_abiertas() to authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- Lo que la persona NO decide al insertar: la hora, el plazo y el estado. El navegador
-- podría mandar un `vence_en` del año que viene o una fila ya `respondida`; el trigger lo
-- pisa. Solo actúa sobre sesiones de usuario: `service_role` puede sembrar pruebas.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.praxis_pregunta_nace_abierta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.creado_en := now();
    new.vence_en := now() + interval '24 hours';
    new.estado := 'abierta';
    new.respuesta := null;
    new.respondida_por := null;
    new.respondida_en := null;
  end if;
  return new;
end;
$$;

revoke all on function public.praxis_pregunta_nace_abierta() from public, anon, authenticated;

drop trigger if exists trg_praxis_pregunta_nace_abierta on public.praxis_preguntas_en_espera;
create trigger trg_praxis_pregunta_nace_abierta
  before insert on public.praxis_preguntas_en_espera
  for each row execute function public.praxis_pregunta_nace_abierta();

-- ────────────────────────────────────────────────────────────────────────────
-- El tope de DOS preguntas abiertas por persona, en un trigger y no en la política.
--
-- La primera versión lo ponía en el `with check` de la política, con
-- `(select praxis_mis_preguntas_abiertas()) < 2`, y se saltaba de dos maneras (revisión
-- independiente del PR #331, M1):
--   · un POST con un arreglo JSON es UNA sentencia `insert` de varias filas; la subconsulta
--     se calcula una sola vez y una función `stable` no ve las filas de su propia sentencia:
--     entraban N abiertas de golpe;
--   · dos inserciones a la vez, desde dos pestañas, pasaban las dos.
-- Un trigger de fila BEFORE en plpgsql (volátil) sí ve las filas que su misma sentencia ya
-- metió, y el candado por persona (`pg_advisory_xact_lock`) pone en fila a las sentencias
-- simultáneas: la segunda espera a que la primera termine y cuenta lo que esta dejó.
-- Corre después de `trg_praxis_pregunta_nace_abierta` (los triggers van por orden
-- alfabético), así que cuenta con el estado ya fijado.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.praxis_pregunta_tope_de_abiertas()
returns trigger
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  abiertas integer;
begin
  if new.estado <> 'abierta' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('praxis_preguntas_en_espera:' || new.usuario_id::text));
  select count(*) into abiertas
    from public.praxis_preguntas_en_espera
   where usuario_id = new.usuario_id and estado = 'abierta';
  if abiertas >= 2 then
    raise exception 'praxis: ya hay dos preguntas abiertas para esta persona'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.praxis_pregunta_tope_de_abiertas() from public, anon, authenticated;

drop trigger if exists trg_praxis_pregunta_tope_de_abiertas on public.praxis_preguntas_en_espera;
create trigger trg_praxis_pregunta_tope_de_abiertas
  before insert on public.praxis_preguntas_en_espera
  for each row execute function public.praxis_pregunta_tope_de_abiertas();

-- ────────────────────────────────────────────────────────────────────────────
-- Políticas
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists praxis_preguntas_insertar_propia on public.praxis_preguntas_en_espera;
create policy praxis_preguntas_insertar_propia on public.praxis_preguntas_en_espera
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

drop policy if exists praxis_preguntas_leer on public.praxis_preguntas_en_espera;
create policy praxis_preguntas_leer on public.praxis_preguntas_en_espera
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.es_coach())
    or (destinatario = 'nutricionista' and (select public.es_nutricionista()))
  );

-- Responder es de quien recibe la pregunta, nunca de quien la hizo: la dueña no entra en
-- esta política aunque sea staff, salvo que además sea la destinataria por rol.
drop policy if exists praxis_preguntas_responder on public.praxis_preguntas_en_espera;
create policy praxis_preguntas_responder on public.praxis_preguntas_en_espera
  for update to authenticated
  using (
    (select public.es_coach())
    or (destinatario = 'nutricionista' and (select public.es_nutricionista()))
  )
  with check (
    respondida_por = (select auth.uid())
    and (
      (select public.es_coach())
      or (destinatario = 'nutricionista' and (select public.es_nutricionista()))
    )
  );

-- Sin política de delete: una pregunta no se borra por la API.
revoke all on public.praxis_preguntas_en_espera from anon, public;
revoke all on public.praxis_preguntas_en_espera from authenticated;
grant select on public.praxis_preguntas_en_espera to authenticated;
-- Al insertar solo viajan estas columnas; el resto lo pone la base.
grant insert (usuario_id, pregunta, destinatario, que_falto, citas) on public.praxis_preguntas_en_espera to authenticated;
-- Al responder solo se tocan estas: ni la pregunta, ni de quién es, ni a quién iba.
grant update (estado, respuesta, respondida_por, respondida_en) on public.praxis_preguntas_en_espera to authenticated;
grant all on public.praxis_preguntas_en_espera to service_role;

commit;
