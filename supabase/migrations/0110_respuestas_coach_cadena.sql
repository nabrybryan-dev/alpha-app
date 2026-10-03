-- ============================================================================
-- 0110 · La respuesta del coach a una pregunta que la cadena de agentes le dejó
-- ============================================================================
--
-- NO ESTÁ APLICADA. La escribió la rama `feat/consola-preguntas-al-coach` el 3-oct-2026 y la aplica
-- Bryan, a mano, en el SQL Editor. Sin ella nada se rompe: la consola muestra las preguntas de la
-- cadena arriba del tablero de Agentes y dice «falta aplicar la migración 0110 para poder
-- responderlas».
--
-- NÚMERO. En `origin/main` y en las ramas remotas la más alta era la 0109; la 0110 era la siguiente
-- libre. Si otra rama la coge antes de que esta se aplique, se renumera AQUÍ, antes de aplicar.
--
-- QUÉ PROBLEMA RESUELVE. Las preguntas que los agentes le dejan al coach (`para_el_coach` del ②, p. ej.
-- «¿con qué volumen vuelve tras la descarga?») subían a `cadena_corridas.avisos`, una nota gris plegada,
-- y una asesorada estuvo dos semanas a mitad de volumen. El importador ahora las sube también a
-- `cadena_corridas.preguntas_pendientes` (con un `id` estable, `cp-…`), pero la consola no tenía dónde
-- RESPONDERLAS COMO COACH: `responder_como_staff` (0083) responde POR el asesorado, a un cuestionario
-- suyo, y estas preguntas no tienen cuestionario. Esta tabla guarda la respuesta del coach, con quién
-- la dio y cuándo, y `corridas/bajar_respuestas_coach.py` (cerebro-alpha) la baja a
-- `F:/alpha-corridas/respuestas-coach/<slug>.json`, que la siguiente tanda adjunta a la entrada del ① y del ②.
--
-- QUÉ GUARDA. UNA fila por pregunta (`id_pregunta` es la clave: contestar otra vez la corrige y deja la
-- hora nueva). La persona de la que habla la pregunta, el paso que la hizo, el texto tal como se mostró y
-- la respuesta. El texto de la pregunta lo manda la consola (viene de `cadena_corridas`, que el coach ya
-- lee); la base no puede comprobarlo, así que la respuesta se atribuye siempre a `auth.uid()` y no a lo
-- que diga el cliente. Es la palabra del coach, no un dato de la persona: no suma series ni cambia cargas.
--
-- QUIÉN PUEDE QUÉ.
--   · El coach (`es_coach()`: el rol y la cuenta personal de Bryan con `puesto_de_coach`, 0106) y la
--     nutricionista (`es_nutricionista()`: Manuela; 0067): LEEN las respuestas y RESPONDEN a su nombre,
--     solo por la función `responder_pregunta_coach`. Quién responde y cuándo los pone la base.
--   · Nadie más: ni lee ni responde. La persona de la pregunta tampoco (puede hablar de su salud).
--   · anon: nada. Nadie escribe por la API directo (sin política de insert/update/delete): la única
--     puerta es la función. Nadie borra (se purga con service_role).
--
-- SEGURIDAD, la regla de siempre (`GUIA-BRYAN.md` §10): RLS en el mismo paso que el `create table`,
-- `revoke all from anon, public, authenticated` antes de conceder nada, y la función `security definer`
-- con `search_path` fijo y sin `execute` para `public` ni `anon`.
--
-- CÓMO COMPROBAR (después de aplicar): `supabase/migrations/comprobar-0110.sql` y la fila 0110 de
-- `supabase/comprobar-migraciones.sql` dicen SI (ANTES de aplicar, NO). El CI corre las sesiones de verdad:
-- `supabase/test/112-respuestas-coach-cadena.sql`.
-- ============================================================================

begin;

create table if not exists public.respuestas_coach_cadena (
  -- El `id` que el importador le puso a la pregunta (hash de texto + corrida + paso).
  id_pregunta   text primary key check (id_pregunta ~ '^cp-[0-9a-f]{16}$'),
  -- La persona de la que trata la pregunta (la de la fila de `cadena_corridas`).
  usuario_id    uuid not null references public.usuarios_app(id) on delete cascade,
  paso          smallint not null check (paso between 1 and 4),
  texto         text not null check (length(btrim(texto)) between 1 and 1000),
  respuesta     text not null check (length(btrim(respuesta)) between 1 and 2000),
  -- Quién respondió: el id (si se borra su cuenta queda null) y el nombre, para el archivo que lee la cadena.
  respondido_por uuid references public.usuarios_app(id) on delete set null,
  quien         text not null,
  respondido_en timestamptz not null default now()
);

comment on table public.respuestas_coach_cadena is
  'Respuestas del coach (o de la nutricionista) a las preguntas que la cadena de agentes le dejó (0110, 2026-10-03). '
  'Una fila por pregunta (`cp-…`). Solo se escribe con responder_pregunta_coach; la baja corridas/bajar_respuestas_coach.py.';

create index if not exists respuestas_coach_cadena_por_persona
  on public.respuestas_coach_cadena (usuario_id, respondido_en desc);

alter table public.respuestas_coach_cadena enable row level security;

drop policy if exists respuestas_coach_cadena_leer on public.respuestas_coach_cadena;
create policy respuestas_coach_cadena_leer on public.respuestas_coach_cadena
  for select to authenticated
  using ((select public.es_coach()) or (select public.es_nutricionista()));

-- Sin política de insert/update/delete: la única puerta es la función de abajo.
revoke all on public.respuestas_coach_cadena from anon, public;
revoke all on public.respuestas_coach_cadena from authenticated;
grant select on public.respuestas_coach_cadena to authenticated;
grant all on public.respuestas_coach_cadena to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- La puerta: el coach o la nutricionista responden, a su nombre. Volver a contestar corrige.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.responder_pregunta_coach(
  p_id_pregunta text,
  p_usuario_id  uuid,
  p_paso        integer,
  p_texto       text,
  p_respuesta   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  uuid := auth.uid();
  v_nombre text;
begin
  if v_actor is null or not (public.es_coach() or public.es_nutricionista()) then
    raise exception 'solo el coach o la nutricionista responden las preguntas de la cadena'
      using errcode = '42501';
  end if;
  if p_id_pregunta is null or p_id_pregunta !~ '^cp-[0-9a-f]{16}$' then
    raise exception 'el id de la pregunta no es de la cadena' using errcode = '22023';
  end if;
  if p_respuesta is null or length(btrim(p_respuesta)) = 0 or length(p_respuesta) > 2000 then
    raise exception 'la respuesta va de 1 a 2000 caracteres' using errcode = '22023';
  end if;
  if p_texto is null or length(btrim(p_texto)) = 0 or length(p_texto) > 1000 then
    raise exception 'el texto de la pregunta va de 1 a 1000 caracteres' using errcode = '22023';
  end if;
  if p_paso is null or p_paso not between 1 and 4 then
    raise exception 'el paso va de 1 a 4' using errcode = '22023';
  end if;
  if not exists (select 1 from public.usuarios_app where id = p_usuario_id) then
    raise exception 'la persona de la pregunta no existe' using errcode = 'P0002';
  end if;

  select nombre into v_nombre from public.usuarios_app where id = v_actor;

  insert into public.respuestas_coach_cadena
    (id_pregunta, usuario_id, paso, texto, respuesta, respondido_por, quien, respondido_en)
  values
    (p_id_pregunta, p_usuario_id, p_paso, btrim(p_texto), btrim(p_respuesta), v_actor,
     coalesce(v_nombre, 'coach'), now())
  on conflict (id_pregunta) do update set
    respuesta      = excluded.respuesta,
    respondido_por = excluded.respondido_por,
    quien          = excluded.quien,
    respondido_en  = excluded.respondido_en;
  -- `usuario_id`, `paso` y `texto` de la primera vez NO se reescriben: contestar de nuevo corrige la
  -- respuesta, no cambia de quién ni de qué era la pregunta.
end;
$$;

revoke all on function public.responder_pregunta_coach(text, uuid, integer, text, text) from public, anon;
grant execute on function public.responder_pregunta_coach(text, uuid, integer, text, text) to authenticated, service_role;

commit;
