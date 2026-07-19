-- 0007 · El asesorado puede guardar sus propias medidas corporales.
-- El perfil vive en public.perfiles (jsonb); hasta ahora solo el coach podía
-- escribirlo. Esta migración permite a cada usuario actualizar SU fila (la app
-- solo toca perfil.medidas, pero la política protege por fila, no por campo).

drop policy if exists perfiles_actualizar_propio on public.perfiles;
create policy perfiles_actualizar_propio on public.perfiles
  for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- El upsert de la app también necesita insert cuando el perfil aún no existe.
drop policy if exists perfiles_insertar_propio on public.perfiles;
create policy perfiles_insertar_propio on public.perfiles
  for insert with check (usuario_id = auth.uid());
