-- ============================================================================
-- 0103 · Investigación de mercadeo con la que Manuela INTERACTÚA
-- ============================================================================
--
-- Respalda la tarjeta «Investigación del agente» de Estrategias (pedido de Bryan, 29-sep-2026):
-- el agente de mercadeo deja HALLAZGOS (un hook, un loop, una estructura de video, una tendencia
-- o un gancho visual) con su fuente y su estado; Manuela y Bryan los leen y COMENTAN; el agente
-- responde al comentario y fortalece el hallazgo. Las tablas del buzón (0096) no sirven para
-- esto: son preguntas del agente con UNA respuesta de Manuela, no un hilo por hallazgo.
--
--   · `mercadeo_hallazgos`: lo que encontró el agente. Lo escribe SOLO service_role.
--   · `mercadeo_hallazgo_comentarios`: el hilo. Manuela y Bryan comentan por
--     `comentar_hallazgo_mercadeo()`; el agente responde solo con service_role
--     (`autor = 'agente'`, `en_respuesta_a` apunta al comentario que contesta).
--   · Leen Manuela (capacidad `responder_mercadeo`, la misma del buzón) y el coach.
--
-- NUNCA salud, medidas, asesorados ni contactos: texto y notas no admiten correos, @ ni
-- teléfonos (`mercadeo_sin_contactos`, 0096), y la fuente es un enlace https o nada.
--
-- SEGURIDAD, la regla de siempre: RLS en el mismo paso, `revoke all … from anon,
-- authenticated, public` antes de conceder nada, sin insert/update/delete para la API; la
-- función es `security definer` con `search_path` fijo y `revoke … from public, anon`.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · MERCADEO_HALLAZGOS
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.mercadeo_hallazgos (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique check (codigo ~ '^H-[0-9]{2,}$'),
  tipo           text not null check (tipo in ('hook', 'loop', 'estructura', 'tendencia', 'gancho_visual')),
  titulo         text not null check (char_length(btrim(titulo)) between 5 and 160
                                      and public.mercadeo_sin_contactos(titulo)),
  resumen        text not null check (char_length(btrim(resumen)) between 5 and 1200
                                      and public.mercadeo_sin_contactos(resumen)),
  -- De dónde sale: un nombre (cuenta pública, curso, artículo) y, si hay, un enlace https.
  fuente_nombre  text check (char_length(btrim(fuente_nombre)) between 2 and 160),
  fuente_url     text check (fuente_url ~ '^https://[^[:space:]]+$' and char_length(fuente_url) <= 500),
  fuente_fecha   date,
  estado         text not null default 'nuevo'
                   check (estado in ('nuevo', 'en_discusion', 'fortalecido', 'descartado')),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.mercadeo_hallazgos is
  'Hallazgos del agente de mercadeo (0103, 2026-09-30): hook, loop, estructura, tendencia o gancho visual, '
  'con fuente y estado. Los carga solo service_role; leen Manuela (responder_mercadeo) y el coach.';

create index if not exists mercadeo_hallazgos_por_tipo on public.mercadeo_hallazgos (tipo, estado, creado_en desc);

alter table public.mercadeo_hallazgos enable row level security;
revoke all on public.mercadeo_hallazgos from anon, authenticated, public;
grant select on public.mercadeo_hallazgos to authenticated;
grant all on public.mercadeo_hallazgos to service_role;

create policy mercadeo_hallazgos_leer on public.mercadeo_hallazgos
  for select to authenticated
  using ((select public.tiene_capacidad('responder_mercadeo')) or (select public.es_coach()));

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · MERCADEO_HALLAZGO_COMENTARIOS (el hilo Manuela / Bryan ↔ agente)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.mercadeo_hallazgo_comentarios (
  id             uuid primary key default gen_random_uuid(),
  hallazgo_id    uuid not null references public.mercadeo_hallazgos(id) on delete cascade,
  autor          text not null check (autor in ('manuela', 'bryan', 'agente')),
  -- Una persona tiene usuario; el agente no.
  autor_id       uuid references public.usuarios_app(id),
  texto          text not null check (char_length(btrim(texto)) between 1 and 1000
                                      and public.mercadeo_sin_contactos(texto)),
  -- La respuesta del agente apunta al comentario que contesta.
  en_respuesta_a uuid references public.mercadeo_hallazgo_comentarios(id) on delete set null,
  creado_en      timestamptz not null default now(),
  constraint mercadeo_comentario_autor_coherente check ((autor = 'agente') = (autor_id is null)),
  constraint mercadeo_comentario_solo_agente_responde check (autor = 'agente' or en_respuesta_a is null)
);

comment on table public.mercadeo_hallazgo_comentarios is
  'Hilo de comentarios de un hallazgo de mercadeo (0103). Manuela y Bryan comentan por '
  'comentar_hallazgo_mercadeo(); el agente responde solo con service_role. Sin salud ni contactos.';

create index if not exists mercadeo_hallazgo_comentarios_por_hallazgo
  on public.mercadeo_hallazgo_comentarios (hallazgo_id, creado_en);

alter table public.mercadeo_hallazgo_comentarios enable row level security;
revoke all on public.mercadeo_hallazgo_comentarios from anon, authenticated, public;
grant select on public.mercadeo_hallazgo_comentarios to authenticated;
grant all on public.mercadeo_hallazgo_comentarios to service_role;

create policy mercadeo_hallazgo_comentarios_leer on public.mercadeo_hallazgo_comentarios
  for select to authenticated
  using ((select public.tiene_capacidad('responder_mercadeo')) or (select public.es_coach()));

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · COMENTAR: Manuela (con responder_mercadeo) o el coach
-- ────────────────────────────────────────────────────────────────────────────
-- Un hallazgo descartado no admite comentarios. Comentar uno nuevo o fortalecido lo pasa a
-- «en_discusion»: así el agente sabe que tiene algo pendiente.
create or replace function public.comentar_hallazgo_mercadeo(p_hallazgo_id uuid, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo    uuid := auth.uid();
  h       public.mercadeo_hallazgos%rowtype;
  v_autor text;
  v_id    uuid;
begin
  if v_yo is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  if public.es_coach() then
    v_autor := 'bryan';
  elsif public.tiene_capacidad('responder_mercadeo') then
    v_autor := 'manuela';
  else
    raise exception 'no puedes comentar la investigación de mercadeo' using errcode = '42501';
  end if;
  select * into h from public.mercadeo_hallazgos where id = p_hallazgo_id for update;
  if not found then
    raise exception 'ese hallazgo no existe' using errcode = 'P0002';
  end if;
  if h.estado = 'descartado' then
    raise exception 'ese hallazgo está descartado: ya no admite comentarios' using errcode = '23514';
  end if;

  insert into public.mercadeo_hallazgo_comentarios (hallazgo_id, autor, autor_id, texto)
  values (p_hallazgo_id, v_autor, v_yo, btrim(coalesce(p_texto, '')))
  returning id into v_id;

  if h.estado in ('nuevo', 'fortalecido') then
    update public.mercadeo_hallazgos set estado = 'en_discusion', actualizado_en = now() where id = p_hallazgo_id;
  end if;
  return v_id;
end
$$;
revoke all on function public.comentar_hallazgo_mercadeo(uuid, text) from public, anon;
grant execute on function public.comentar_hallazgo_mercadeo(uuid, text) to authenticated, service_role;

commit;
