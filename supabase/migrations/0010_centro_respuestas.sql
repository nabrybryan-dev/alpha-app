-- 0010_centro_respuestas.sql
-- Centro de Respuestas: banco de fichas con búsqueda semántica + bitácora de consultas.
-- Dimensión 1536 = OpenAI text-embedding-3-small. Cambiarla obliga a recrear la tabla.
-- OJO: los comentarios SQL van con -- , nunca con ==== (da "operator too long").

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------- fichas

create table if not exists public.fichas_respuesta (
  id            text primary key,
  bloque        text not null,
  titulo        text not null,
  variantes     text[] not null default '{}',
  cuerpo        jsonb not null,
  datos_que_usa text[] not null default '{}',
  bandera_salud boolean not null default false,
  fuentes       text[] not null default '{}',
  publicada     boolean not null default true,
  embedding     extensions.vector(1536),
  actualizado   timestamptz not null default now()
);

alter table public.fichas_respuesta enable row level security;

drop policy if exists fichas_leer on public.fichas_respuesta;
create policy fichas_leer on public.fichas_respuesta
  for select to authenticated using (publicada);

drop policy if exists fichas_escribir_staff on public.fichas_respuesta;
create policy fichas_escribir_staff on public.fichas_respuesta
  for all to authenticated using (public.es_staff()) with check (public.es_staff());

-- ------------------------------------------------------------- consultas

create table if not exists public.consultas_chat (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.usuarios_app (id) on delete cascade,
  mensaje      text not null,
  ficha_id     text references public.fichas_respuesta (id) on delete set null,
  similitud    real,
  via          text not null check (via in ('ficha', 'ficha_tentativa', 'ia_vivo', 'escalado')),
  bandera_roja boolean not null default false,
  revisado     boolean not null default false,
  corregido    boolean not null default false,
  creado_en    timestamptz not null default now()
);

create index if not exists consultas_chat_usuario_idx
  on public.consultas_chat (usuario_id, creado_en desc);

alter table public.consultas_chat enable row level security;

drop policy if exists consultas_leer_propias on public.consultas_chat;
create policy consultas_leer_propias on public.consultas_chat
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_staff());

-- El check de dueño (usuario_id = auth.uid()) no basta: sin las otras tres
-- columnas en false, un asesorado autenticado podría llamar al endpoint REST
-- directo (sin pasar por la app) e insertar su propia fila ya con
-- bandera_roja/revisado/corregido en true, evadiendo la cola de pendientes
-- del coach. La política de UPDATE de abajo protege esas columnas después
-- del insert, pero de nada sirve si ya se pueden fijar en el insert mismo.
-- bandera_roja en particular NO es un dato que el navegador pueda declarar:
-- es una clasificación de confianza (¿este mensaje es de salud?) que hace la
-- Edge Function `responder-chat` de la Etapa 3 con la service role key, que
-- se salta RLS y por tanto no la limita esta política.
drop policy if exists consultas_insertar_propias on public.consultas_chat;
create policy consultas_insertar_propias on public.consultas_chat
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and revisado = false
    and corregido = false
    and bandera_roja = false
  );

-- Solo el staff marca revisado/corregido.
drop policy if exists consultas_actualizar_staff on public.consultas_chat;
create policy consultas_actualizar_staff on public.consultas_chat
  for update to authenticated
  using (public.es_staff()) with check (public.es_staff());

-- No hay política de DELETE para consultas_chat, y es a propósito: es una
-- bitácora de consultas de salud y debe ser append-only para todos los
-- roles de la API (con RLS activo y sin política de delete, el borrado
-- queda bloqueado por defecto, tanto para authenticated como para anon).
-- El único borrado posible es fuera de RLS, con la service role key
-- (p. ej. para cumplir una solicitud de baja de datos).

-- --------------------------------------------------------------- búsqueda

-- Sin índice vectorial a propósito: con 50 filas el escaneo secuencial es
-- instantáneo y un HNSW sería optimización prematura. Añadir si el banco crece.

create or replace function public.buscar_ficha(
  consulta extensions.vector(1536),
  limite   int default 3
)
returns table (
  id            text,
  titulo        text,
  bloque        text,
  cuerpo        jsonb,
  datos_que_usa text[],
  bandera_salud boolean,
  similitud     real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    f.id, f.titulo, f.bloque, f.cuerpo, f.datos_que_usa, f.bandera_salud,
    (1 - (f.embedding <=> consulta))::real
  from public.fichas_respuesta f
  where f.publicada and f.embedding is not null
  order by f.embedding <=> consulta
  limit greatest(1, least(limite, 10));
$$;

-- Supabase concede execute a anon por defecto. Revocar SIEMPRE (lección de 0005).
revoke execute on function public.buscar_ficha(extensions.vector, int) from anon, public;
grant  execute on function public.buscar_ficha(extensions.vector, int) to authenticated;
