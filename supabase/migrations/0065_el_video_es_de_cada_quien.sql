-- 0065 · El vídeo de la revisión semanal pasa a ser de cada quien.
--
-- QUÉ CAMBIA Y POR QUÉ. La 0061 montó el cajón para una CABECERA: un vídeo
-- igual para los veintitrés, así que su regla decía «lo publicado lo abre
-- cualquiera con sesión iniciada». Correcto para un vídeo que no habla de
-- nadie.
--
-- El 10-sep Bryan decidió que el vídeo lo genera una máquina con su voz y que
-- **habrá uno por persona cada domingo**, diciendo en voz alta sus cargas, su
-- adherencia y su sueño. Con eso, aquella regla se vuelve un agujero: el vídeo
-- de una asesorada lo podría abrir cualquier otro. No hay nada expuesto —no se
-- ha publicado ni un archivo— y por eso esto entra ANTES de que exista el
-- primero, que es la única forma barata de arreglarlo.
--
-- LA FORMA DEL CAJÓN, a partir de ahora:
--   comunes/…            → lo que es igual para todos (una cabecera, un aviso)
--   personas/<uuid>/…    → el vídeo de esa persona, y de nadie más
--
-- La primera carpeta decide quién puede abrirlo, igual que en los adjuntos del
-- chat (0022). Se resuelve por prefijo y no por una lista, porque una lista hay
-- que mantenerla y un prefijo no.

create table if not exists videos_semanales (
  usuario_id uuid not null references usuarios_app (id) on delete cascade,
  -- Lunes de la semana a la que pertenece, en formato ISO. Así dos domingos no
  -- se pisan y se puede volver a ver el de la semana pasada.
  semana date not null,
  path text not null,
  -- Lo que dijo el vídeo, palabra por palabra. NO es decoración: es la única
  -- forma de auditar después si le contó a alguien un número equivocado.
  guion text not null,
  publicado_en timestamptz not null default now(),
  primary key (usuario_id, semana)
);

alter table videos_semanales enable row level security;

-- Cada quien el suyo. El coach ve todos, porque tiene que poder revisar lo que
-- se le dijo a su gente antes y después de que salga.
drop policy if exists "video semanal: cada quien el suyo" on videos_semanales;
create policy "video semanal: cada quien el suyo"
  on videos_semanales for select to authenticated
  using (usuario_id = auth.uid() or public.es_coach());

-- Publicar: nadie desde el cliente. Lo escribe el proceso que renderiza, con la
-- clave de servicio. Un asesorado que pudiera insertar aquí podría apuntar su
-- fila al archivo de otra persona.

-- ── El archivo ──────────────────────────────────────────────────────────────
-- La regla vieja se ESTRECHA a la carpeta común: deja de cubrir todo el cajón.
drop policy if exists "medios: lee lo publicado" on storage.objects;
create policy "medios: lee lo comun publicado"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'medios-app'
    and (storage.foldername(name))[1] = 'comunes'
    and exists (select 1 from medios_app m where m.path = storage.objects.name)
  );

-- Y la nueva: el vídeo de una persona lo abre esa persona. El coach también,
-- para poder revisarlo.
drop policy if exists "medios: cada quien abre su video" on storage.objects;
create policy "medios: cada quien abre su video"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'medios-app'
    and (storage.foldername(name))[1] = 'personas'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.es_coach()
    )
  );

-- Subir, cambiar o borrar desde el cliente: nadie, en ninguna de las dos
-- carpetas. Sin política, RLS lo niega.

create index if not exists videos_semanales_semana_idx on videos_semanales (semana desc);
