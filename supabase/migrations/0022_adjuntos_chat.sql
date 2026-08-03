-- 0022 · Adjuntos del chat: bucket privado + columnas del mensaje.
--
-- Hasta ahora el boton de adjuntar guardaba el NOMBRE del archivo y mandaba un
-- mensaje de texto con ese nombre. No habia archivo detras. Esto crea el sitio
-- donde vive el archivo de verdad.
--
-- El bucket es PRIVADO, no publico: son imagenes de cuerpos, dato de salud. Una
-- URL publica de Storage es un enlace permanente a la foto de alguien, que sigue
-- vivo aunque el mensaje se borre. Se leen con URL firmada de una hora.

insert into storage.buckets (id, name, public)
values ('adjuntos-chat', 'adjuntos-chat', false)
on conflict (id) do nothing;

alter table mensajes add column if not exists adjunto_path text;
alter table mensajes add column if not exists adjunto_tipo text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mensajes_adjunto_tipo_valido'
  ) then
    alter table mensajes add constraint mensajes_adjunto_tipo_valido
      check (adjunto_tipo is null or adjunto_tipo in ('imagen', 'video'));
  end if;
end $$;

-- Subir: solo dentro de la carpeta propia. La primera carpeta de la ruta es el
-- id de quien sube, y por eso se puede decidir por prefijo.
drop policy if exists "adjuntos: sube en su propia carpeta" on storage.objects;
create policy "adjuntos: sube en su propia carpeta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'adjuntos-chat'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leer: quien lo mando y quien lo recibio. Se resuelve contra `mensajes` y NO
-- contra el rol: el aislamiento entre asesorados ya se rompio dos veces por
-- politicas que miraban el rol, y una de ellas era tautologica (migracion 0008).
drop policy if exists "adjuntos: lee quien envio o recibio" on storage.objects;
create policy "adjuntos: lee quien envio o recibio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'adjuntos-chat'
    and exists (
      select 1 from mensajes m
      where m.adjunto_path = storage.objects.name
        and (m.de_id = auth.uid() or m.para_id = auth.uid())
    )
  );

-- La consulta de lectura busca por `adjunto_path` en cada objeto que se abre.
create index if not exists mensajes_adjunto_path_idx
  on mensajes (adjunto_path) where adjunto_path is not null;

-- Borrar y actualizar desde el cliente: nadie. Sin politica, RLS lo niega.
