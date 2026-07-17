-- App Alpha Athletics · Etapa 2a · Esquema + RLS
-- Pegar completo en: Supabase → SQL Editor → New query → Run

-- ============ USUARIOS ============
create table if not exists public.usuarios_app (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  rol text not null default 'asesorado' check (rol in ('asesorado', 'coach')),
  avatar_iniciales text not null default '',
  creado_en timestamptz not null default now()
);

-- Se crea la fila automáticamente al registrarse un usuario
create or replace function public.crear_usuario_app()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.usuarios_app (id, nombre, avatar_iniciales)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data ->> 'nombre', new.email), 2))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_usuario_app();

-- Función auxiliar: ¿la sesión actual es del coach?
create or replace function public.es_coach()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.usuarios_app
    where id = auth.uid() and rol = 'coach'
  );
$$;

-- ============ TABLAS DE DATOS ============
create table if not exists public.perfiles (
  usuario_id uuid primary key references public.usuarios_app (id) on delete cascade,
  datos jsonb not null,
  actualizado_en timestamptz not null default now()
);

create table if not exists public.microciclos (
  id text primary key,
  usuario_id uuid not null references public.usuarios_app (id) on delete cascade,
  numero int not null,
  estado text not null check (estado in ('activo', 'cerrado', 'propuesto')),
  datos jsonb not null,
  actualizado_en timestamptz not null default now()
);
create index if not exists microciclos_usuario on public.microciclos (usuario_id);

create table if not exists public.checkins (
  id text primary key,
  usuario_id uuid not null references public.usuarios_app (id) on delete cascade,
  fecha date not null,
  datos jsonb not null,
  unique (usuario_id, fecha)
);
create index if not exists checkins_usuario on public.checkins (usuario_id);

create table if not exists public.adherencias (
  id text primary key,
  usuario_id uuid not null references public.usuarios_app (id) on delete cascade,
  fecha date not null,
  estado text not null check (estado in ('si', 'parcial', 'no')),
  comentario text,
  unique (usuario_id, fecha)
);
create index if not exists adherencias_usuario on public.adherencias (usuario_id);

create table if not exists public.planes_nutricionales (
  id text primary key,
  usuario_id uuid not null references public.usuarios_app (id) on delete cascade,
  datos jsonb not null,
  actualizado_en timestamptz not null default now()
);
create index if not exists planes_usuario on public.planes_nutricionales (usuario_id);

create table if not exists public.mensajes (
  id text primary key,
  de_id uuid not null references public.usuarios_app (id) on delete cascade,
  para_id uuid not null references public.usuarios_app (id) on delete cascade,
  fecha_iso timestamptz not null default now(),
  texto text not null,
  adjunto_url text,
  leido boolean not null default false
);
create index if not exists mensajes_de on public.mensajes (de_id);
create index if not exists mensajes_para on public.mensajes (para_id);

create table if not exists public.cuestionarios (
  id text primary key,
  datos jsonb not null,
  asignado_a uuid[] not null default '{}'
);

create table if not exists public.respuestas (
  id text primary key,
  cuestionario_id text not null references public.cuestionarios (id) on delete cascade,
  usuario_id uuid not null references public.usuarios_app (id) on delete cascade,
  fecha_iso timestamptz not null default now(),
  valores jsonb not null
);
create index if not exists respuestas_usuario on public.respuestas (usuario_id);

create table if not exists public.contenidos (
  id text primary key,
  datos jsonb not null
);

create table if not exists public.premiaciones (
  id text primary key,
  usuario_id uuid not null references public.usuarios_app (id) on delete cascade,
  titulo text not null,
  fecha date not null,
  nota text
);

-- ============ RLS ============
alter table public.usuarios_app enable row level security;
alter table public.perfiles enable row level security;
alter table public.microciclos enable row level security;
alter table public.checkins enable row level security;
alter table public.adherencias enable row level security;
alter table public.planes_nutricionales enable row level security;
alter table public.mensajes enable row level security;
alter table public.cuestionarios enable row level security;
alter table public.respuestas enable row level security;
alter table public.contenidos enable row level security;
alter table public.premiaciones enable row level security;

-- usuarios_app: cada quien se ve; el coach ve a todos
create policy usuarios_leer on public.usuarios_app
  for select using (id = auth.uid() or public.es_coach());
create policy usuarios_editar_propio on public.usuarios_app
  for update using (id = auth.uid()) with check (id = auth.uid() and rol = rol);

-- Patrón general: dueño lee/escribe lo suyo; coach todo
create policy perfiles_leer on public.perfiles
  for select using (usuario_id = auth.uid() or public.es_coach());
create policy perfiles_escribir_coach on public.perfiles
  for all using (public.es_coach()) with check (public.es_coach());

create policy microciclos_leer on public.microciclos
  for select using (usuario_id = auth.uid() or public.es_coach());
create policy microciclos_actualizar_propio on public.microciclos
  for update using (usuario_id = auth.uid() or public.es_coach())
  with check (usuario_id = auth.uid() or public.es_coach());
create policy microciclos_crear_coach on public.microciclos
  for insert with check (public.es_coach());
create policy microciclos_borrar_coach on public.microciclos
  for delete using (public.es_coach());

create policy checkins_todo_propio on public.checkins
  for all using (usuario_id = auth.uid() or public.es_coach())
  with check (usuario_id = auth.uid() or public.es_coach());

create policy adherencias_todo_propio on public.adherencias
  for all using (usuario_id = auth.uid() or public.es_coach())
  with check (usuario_id = auth.uid() or public.es_coach());

create policy planes_leer on public.planes_nutricionales
  for select using (usuario_id = auth.uid() or public.es_coach());
create policy planes_escribir_coach on public.planes_nutricionales
  for all using (public.es_coach()) with check (public.es_coach());

-- mensajes: solo emisor y receptor; leído lo marca el receptor
create policy mensajes_leer on public.mensajes
  for select using (de_id = auth.uid() or para_id = auth.uid());
create policy mensajes_enviar on public.mensajes
  for insert with check (de_id = auth.uid());
create policy mensajes_marcar_leido on public.mensajes
  for update using (para_id = auth.uid()) with check (para_id = auth.uid());

-- cuestionarios: asignados los leen; coach administra
create policy cuestionarios_leer on public.cuestionarios
  for select using (auth.uid() = any (asignado_a) or public.es_coach());
create policy cuestionarios_escribir_coach on public.cuestionarios
  for all using (public.es_coach()) with check (public.es_coach());

create policy respuestas_leer on public.respuestas
  for select using (usuario_id = auth.uid() or public.es_coach());
create policy respuestas_crear_propia on public.respuestas
  for insert with check (usuario_id = auth.uid());

-- contenidos: biblioteca visible para todo usuario autenticado; coach administra
create policy contenidos_leer on public.contenidos
  for select using (auth.uid() is not null);
create policy contenidos_escribir_coach on public.contenidos
  for all using (public.es_coach()) with check (public.es_coach());

create policy premiaciones_leer on public.premiaciones
  for select using (usuario_id = auth.uid() or public.es_coach());
create policy premiaciones_escribir_coach on public.premiaciones
  for all using (public.es_coach()) with check (public.es_coach());
