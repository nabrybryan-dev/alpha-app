-- App Alpha Athletics · Migración 0003 · Hidratación diaria
-- Pegar completo en: Supabase → SQL Editor → New query → Run

create table if not exists public.hidratacion (
  id text primary key,
  usuario_id uuid not null references public.usuarios_app (id) on delete cascade,
  fecha date not null,
  ml int not null default 0 check (ml >= 0),
  actualizado_en timestamptz not null default now(),
  unique (usuario_id, fecha)
);
create index if not exists hidratacion_usuario on public.hidratacion (usuario_id);

alter table public.hidratacion enable row level security;

create policy hidratacion_todo_propio on public.hidratacion
  for all using (usuario_id = auth.uid() or public.es_coach())
  with check (usuario_id = auth.uid() or public.es_coach());
