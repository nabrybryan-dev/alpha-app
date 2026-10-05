-- ============================================================================
-- 0108 · Praxis: el aviso al coach cuando detecta una señal de riesgo
-- ============================================================================
--
-- NO ESTÁ APLICADA. La escribió la rama `feat/praxis-aviso-coach` el 3-oct-2026 y la aplica
-- Bryan, a mano, en el SQL Editor. Sin ella nada se rompe: la Edge Function `praxis-registro`
-- sigue derivando a la persona igual y solo anota en su log «aviso no guardado», y la consola
-- del coach dice «Avisos de Praxis: falta aplicar la migración 0108» y nada más.
--
-- NÚMERO. En `origin/main` y en todas las ramas remotas la más alta era la 0107; la 0108 era la
-- siguiente libre. Si otra rama la coge antes de que esta se aplique, se renumera AQUÍ, antes de
-- aplicar: nunca después.
--
-- QUÉ PROBLEMA RESUELVE. Encargo de Bryan (3-oct): cuando Praxis detecta una señal de riesgo en
-- una persona (vida, violencia de pareja, un menor, una frase ambigua o una señal de salud), el
-- aviso le aparece a él EN LA CONSOLA DEL COACH, arriba, con la hora y el tipo de señal, y queda
-- marcado hasta que lo atienda. Hasta hoy la función respondía `meta.aviso_bryan: true` y NO se
-- guardaba ni se avisaba nada. No existía ninguna tabla de avisos para el coach (se buscó en
-- todas las migraciones: `permisos_de_aviso` es el permiso de empuje del teléfono, y
-- `avisos_plan_enviados` es el registro de los avisos push del organizador); esta es nueva.
--
-- QUÉ GUARDA Y QUÉ NO. UNA fila por aviso: quién (`usuario_id`), cuándo, por dónde llegó
-- (`origen`: el registro de Praxis o el cuestionario de ingreso) y qué TIPO de señal fue
-- (`nivel`). NUNCA la frase ni la cita que disparó la marca: la retención de texto de salud
-- mental la está revisando un abogado y, hasta que diga algo, aquí no se guarda ni una palabra de
-- lo que la persona escribió. No hay columna de texto a propósito. El `check` de `nivel` y de
-- `origen` cierra la puerta a meter ahí una frase por la API.
--
-- QUIÉN PUEDE QUÉ.
--   · La persona: INSERTA avisos propios (`usuario_id = auth.uid()`), solo con las tres columnas
--     que le tocan (usuario, origen, nivel). NO los lee —ni los suyos—, no los edita y no los borra.
--     Quien no puede leer lo que se dijo de ella tampoco puede borrarlo ni saber si hubo aviso.
--   · El coach (`es_coach()`: el rol y la cuenta personal de Bryan con `puesto_de_coach`, 0106) y la
--     nutricionista (`es_nutricionista()`: rol 'nutricionista', 0067; Manuela): leen todos y los marcan
--     como atendidos. DECISIÓN DE BRYAN (2-oct): Manuela también ve los avisos y los atiende. Solo pueden
--     tocar `atendido_en` y `atendido_por`, solo en un aviso que sigue pendiente, y `atendido_por` tiene
--     que ser quien llama. No reabren ni reescriben uno ya atendido.
--   · anon: nada. Y nadie borra: no hay política de delete (se purgan con service_role).
--
-- NO SE DUPLICA. Si una persona escribe tres frases de riesgo seguidas, el coach necesita un aviso
-- y no tres. Un trigger descarta, en silencio, el aviso de la misma persona, mismo origen y mismo
-- tipo si ya hay uno SIN ATENDER de la última hora. Es también el tope contra quien llame a la
-- tabla a mano para llenarle la consola a Bryan de filas. Corre con candado por persona
-- (`pg_advisory_xact_lock`, como el tope de la 0105): dos inserciones a la vez no se saltan la regla.
-- El trigger también fija `creado_en = now()` y deja `atendido_*` vacíos: la persona no decide la hora.
--
-- CÓMO COMPROBAR QUE LA POLÍTICA FUNCIONA (después de aplicar):
--   1. `supabase/migrations/comprobar-0108.sql`: todas dicen SI. Corrido ANTES de aplicar dicen NO.
--   2. Con la sesión de un asesorado: insertar un aviso con `usuario_id` de OTRA persona falla (RLS);
--      `select` de la tabla devuelve 0 filas aunque haya avisos suyos; `update` no toca ninguna fila.
--   3. Con la sesión del coach o de la nutricionista: `select` ve todos y `update … set atendido_en = now(),
--      atendido_por = auth.uid()` marca uno pendiente.
--   (El CI corre esto mismo contra un Postgres de verdad: `supabase/test/108-praxis-avisos-coach.sql`.)
--
-- SEGURIDAD, la regla de siempre (`GUIA-BRYAN.md` §10): RLS en el mismo paso que el
-- `create table`, `revoke all from anon, public, authenticated` antes de conceder nada, y toda
-- función `security definer` con `search_path` fijo y sin `execute` para `public` ni `anon`.
-- ============================================================================

begin;

create table if not exists public.praxis_avisos_coach (
  id           uuid primary key default gen_random_uuid(),
  -- La persona de la que es la señal. Si se borra su cuenta, se borran sus avisos.
  usuario_id   uuid not null references public.usuarios_app(id) on delete cascade,
  creado_en    timestamptz not null default now(),
  -- Por dónde llegó: el registro en lenguaje natural o el cuestionario de ingreso por voz.
  origen       text not null check (origen in ('praxis', 'ingreso')),
  -- El TIPO de señal, no lo que dijo. Mismos valores que `NIVELES_AVISO` en `domain/praxis/aviso.ts`:
  --   vida · pareja · nino  = la Quieta, por la línea de ayuda que se ofreció
  --   cuidado               = frase ambigua (Praxis preguntó con cuidado)
  --   salud                 = señal de salud
  nivel        text not null check (nivel in ('vida', 'pareja', 'nino', 'cuidado', 'salud')),
  atendido_en  timestamptz,
  atendido_por uuid references public.usuarios_app(id) on delete set null,
  -- Quién atendió implica cuándo. (Al revés no: si se borra la cuenta de quien atendió, el aviso
  -- sigue atendido, solo sin nombre.)
  constraint praxis_aviso_atendido_con_hora check (atendido_por is null or atendido_en is not null)
);

comment on table public.praxis_avisos_coach is
  'Avisos de Praxis al coach (0108, 2026-10-03): una fila por señal de riesgo detectada, con quién, '
  'cuándo, por dónde llegó y el TIPO de señal. SIN la frase ni la cita (retención de texto en revisión '
  'legal). La persona inserta el suyo y no lo lee; el coach y la nutricionista leen todos y marcan atendido; nadie borra.';

-- Los pendientes, los que la consola pide siempre, del más nuevo al más viejo.
create index if not exists praxis_avisos_pendientes
  on public.praxis_avisos_coach (creado_en desc) where atendido_en is null;
-- Para la regla de «no se duplica» y para «los avisos de esta persona».
create index if not exists praxis_avisos_por_persona
  on public.praxis_avisos_coach (usuario_id, origen, nivel, creado_en desc);

alter table public.praxis_avisos_coach enable row level security;

-- ────────────────────────────────────────────────────────────────────────────
-- Lo que la persona NO decide al insertar (la hora, el atendido) y el «no se duplica».
-- `security definer` porque tiene que ver los avisos pendientes de la persona, y ella no puede
-- leerlos. Solo actúa sobre sesiones de usuario: `service_role` y las migraciones pueden sembrar.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.praxis_aviso_nace_limpio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.creado_en := now();
  new.atendido_en := null;
  new.atendido_por := null;
  -- El candado por persona: dos avisos a la vez se ponen en fila y el segundo ve al primero.
  perform pg_advisory_xact_lock(hashtext('praxis_avisos_coach:' || new.usuario_id::text));
  if exists (
    select 1
      from public.praxis_avisos_coach a
     where a.usuario_id = new.usuario_id
       and a.origen = new.origen
       and a.nivel = new.nivel
       and a.atendido_en is null
       and a.creado_en > now() - interval '1 hour'
  ) then
    -- Ya hay uno igual sin atender: el coach ya está avisado. Se descarta sin error.
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.praxis_aviso_nace_limpio() from public, anon, authenticated;

drop trigger if exists trg_praxis_aviso_nace_limpio on public.praxis_avisos_coach;
create trigger trg_praxis_aviso_nace_limpio
  before insert on public.praxis_avisos_coach
  for each row execute function public.praxis_aviso_nace_limpio();

-- ────────────────────────────────────────────────────────────────────────────
-- Políticas
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists praxis_avisos_insertar_propio on public.praxis_avisos_coach;
create policy praxis_avisos_insertar_propio on public.praxis_avisos_coach
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

-- Lee el coach y la nutricionista. La persona no: ni los suyos.
drop policy if exists praxis_avisos_leer_coach on public.praxis_avisos_coach;
create policy praxis_avisos_leer_coach on public.praxis_avisos_coach
  for select to authenticated
  using ((select public.es_coach()) or (select public.es_nutricionista()));

-- Marcar atendido: el coach o la nutricionista, solo un aviso pendiente, y quien atiende es quien llama.
drop policy if exists praxis_avisos_atender_coach on public.praxis_avisos_coach;
create policy praxis_avisos_atender_coach on public.praxis_avisos_coach
  for update to authenticated
  using (((select public.es_coach()) or (select public.es_nutricionista())) and atendido_en is null)
  with check (
    ((select public.es_coach()) or (select public.es_nutricionista()))
    and atendido_en is not null
    and atendido_por = (select auth.uid())
  );

-- Sin política de delete: un aviso no se borra por la API.
revoke all on public.praxis_avisos_coach from anon, public;
revoke all on public.praxis_avisos_coach from authenticated;
grant select on public.praxis_avisos_coach to authenticated;
-- Al insertar solo viajan estas columnas; la hora la pone la base.
grant insert (usuario_id, origen, nivel) on public.praxis_avisos_coach to authenticated;
-- Al atender solo se tocan estas: ni de quién es, ni el tipo, ni cuándo se creó.
grant update (atendido_en, atendido_por) on public.praxis_avisos_coach to authenticated;
grant all on public.praxis_avisos_coach to service_role;

commit;
