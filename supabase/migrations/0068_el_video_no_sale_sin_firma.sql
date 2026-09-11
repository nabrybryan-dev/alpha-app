-- 0068 · El vídeo no sale hasta que alguien lo firma.
--
-- ARREGLA UN FALLO DE LA 0065, QUE ESCRIBÍ YO. Aquella dejó dos puertas sin
-- cerrar, y la segunda es peor que la primera:
--
--   1. `videos_semanales` no tenía NINGÚN estado de aprobación: en cuanto el
--      proceso que renderiza escribía la fila, la persona ya podía leerla.
--   2. La política del archivo se ataba a la CARPETA —«cualquier cosa bajo
--      `personas/<tu-uuid>/`»— y no a lo publicado. Con eso ni siquiera hacía
--      falta la fila: bastaba con que el archivo estuviera subido y con
--      adivinar la ruta, que es adivinable (`personas/<uuid>/<lunes>.mp4`).
--
-- QUÉ ES Y QUÉ NO ES. **No es una fuga entre asesorados**: cada quien solo
-- alcanzaba lo suyo, nadie podía abrir el vídeo de otro. Lo que es —y es
-- serio— es un **salto de la aprobación**: alguien podía ver y oír SU vídeo,
-- con la cara y la voz del coach, antes de que el coach lo hubiera firmado.
--
-- Medido antes de escribir esto: la 0065 está aplicada, con **0 filas y 0
-- archivos**. No hay nada expuesto; esto se adelanta al primer vídeo.
--
-- EL REPARTO, para que no se solape con la puerta de la salida automática:
-- quien escribe `aprobado_en` es el botón de la bandeja del coach (o el
-- proceso, el día que la puerta se gane la salida sola). Esta política no sabe
-- nada de domingos ni de rachas: solo mira si hay fila aprobada con ese `path`.
-- Un sitio decide, otro obedece.

alter table videos_semanales add column if not exists aprobado_en timestamptz;

comment on column videos_semanales.aprobado_en is
  'Cuando el coach firmo que este video puede salir. NULL = existe pero no sale.';

-- El asesorado ve el suyo SOLO si está firmado. El coach lo ve todo, que es
-- justo lo que necesita para revisarlo antes de firmarlo.
drop policy if exists "video semanal: cada quien el suyo" on videos_semanales;
create policy "video semanal: el suyo y solo si esta firmado"
  on videos_semanales for select to authenticated
  using (
    public.es_coach()
    or (usuario_id = auth.uid() and aprobado_en is not null)
  );

-- El ARCHIVO deja de colgar de la carpeta y pasa a colgar de la fila firmada.
-- Es la misma forma que ya usa `comunes/` contra `medios_app`: se ata a lo
-- publicado, no a dónde está guardado.
drop policy if exists "medios: cada quien abre su video" on storage.objects;
create policy "medios: el video firmado, y de su dueno"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'medios-app'
    and (storage.foldername(name))[1] = 'personas'
    and exists (
      select 1 from videos_semanales v
      where v.path = storage.objects.name
        and (
          public.es_coach()
          or (v.usuario_id = auth.uid() and v.aprobado_en is not null)
        )
    )
  );

-- La política de lectura busca por `path` en cada archivo que se abre.
create index if not exists videos_semanales_path_idx on videos_semanales (path);
