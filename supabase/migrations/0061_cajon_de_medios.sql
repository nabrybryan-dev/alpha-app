-- 0061 · El cajón de los medios de la app: bucket privado + qué hay publicado.
--
-- Aquí vive el vídeo de la revisión semanal (la «cabecera»). Se graba una vez y
-- sirve todas las semanas; lo que cambia cada semana es la tarjeta de números
-- que va debajo, y esa no es un archivo.
--
-- **El bucket es PRIVADO, y esta vez no por el dato sino por la cara.** El
-- vídeo lleva la cara del coach —generada, además— y una URL pública de Storage
-- es un enlace permanente que sigue vivo aunque se despublique. Se lee con URL
-- firmada de una hora, igual que los adjuntos del chat (0022).

insert into storage.buckets (id, name, public)
values ('medios-app', 'medios-app', false)
on conflict (id) do nothing;

-- Qué hay publicado. Una fila por hueco de la app; hoy solo la cabecera.
create table if not exists medios_app (
  clave text primary key,
  path text not null,
  -- Cuándo se grabó, para poder decirlo en pantalla si algún día hace falta.
  grabado_el date,
  actualizado_en timestamptz not null default now()
);

alter table medios_app enable row level security;

-- Leer la ficha: cualquiera que haya iniciado sesión. Es el MISMO vídeo para
-- todos y no lleva el dato de nadie, así que aquí no hay aislamiento que
-- proteger — y una política por rol sería justo el error de la 0008.
drop policy if exists "medios: lee quien ha iniciado sesion" on medios_app;
create policy "medios: lee quien ha iniciado sesion"
  on medios_app for select to authenticated
  using (true);

-- Escribir la ficha desde el cliente: NADIE. Sin política de insert/update/
-- delete, RLS lo niega. Lo publica el coach por el panel de Supabase o por una
-- función con la clave de servicio.

-- Leer el archivo: solo lo que está PUBLICADO, y solo con sesión iniciada. Un
-- vídeo subido y todavía no anunciado no se puede abrir aunque se adivine su
-- ruta, que es lo que pasaría atando la política solo al bucket.
drop policy if exists "medios: lee lo publicado" on storage.objects;
create policy "medios: lee lo publicado"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'medios-app'
    and exists (select 1 from medios_app m where m.path = storage.objects.name)
  );

-- Subir, cambiar o borrar el archivo desde el cliente: nadie. Sin política.

-- La política de lectura resuelve por `path` en cada archivo que se abre.
create index if not exists medios_app_path_idx on medios_app (path);
