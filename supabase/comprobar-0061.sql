-- ============================================================================
-- COMPROBAR 0061 · el cajón de los medios
-- ============================================================================
--
-- Contrato: CERO filas. Cualquier fila que salga es un fallo con su nombre.
--
-- ⚠ Estas señales hay que verlas en ROJO antes de darlas por buenas. La forma
--   de hacerlo, en el mismo SQL Editor y sin tocar nada de nadie:
--     · señal 1 → `update storage.buckets set public = true where id='medios-app';`
--       (sale la fila; se devuelve a `false` y desaparece)
--     · señal 3 → publicar una fila con un `path` que no existe en el bucket
--       y borrarla después.
--   Un guardián que solo se ha visto en verde no está comprobado.
-- ============================================================================

-- ── SEÑAL 1 · el cajón existe y NO es público ───────────────────────────────
-- Un bucket público es un enlace permanente a la cara del coach, vivo aunque el
-- vídeo se despublique.
select 'el cajón medios-app no existe o es público' as fallo, id, public
  from storage.buckets
 where id = 'medios-app' and public is true
union all
select 'el cajón medios-app no existe', 'medios-app', null
 where not exists (select 1 from storage.buckets where id = 'medios-app');

-- ── SEÑAL 2 · la ficha de lo publicado tiene RLS y solo deja LEER ───────────
-- Sin RLS, la clave anónima puede reescribir a qué archivo apunta la cabecera:
-- o sea, cambiar el vídeo que ven los asesorados.
select 'medios_app sin RLS' as fallo, c.relname, null::text as cmd
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'medios_app' and c.relrowsecurity is false
union all
select 'medios_app deja escribir desde el cliente', p.tablename, p.cmd
  from pg_policies p
 where p.schemaname = 'public' and p.tablename = 'medios_app' and p.cmd <> 'SELECT';

-- ── SEÑAL 3 · nada publicado que no exista en el cajón ──────────────────────
-- Una fila apuntando a un archivo que no está deja el reproductor pidiendo una
-- firma de algo que no existe: en pantalla se ve «cargando» para siempre.
select 'publicado pero el archivo no está en el cajón' as fallo, m.clave, m.path
  from public.medios_app m
 where not exists (
   select 1 from storage.objects o
    where o.bucket_id = 'medios-app' and o.name = m.path);

-- ── SEÑAL 4 · nada en el cajón que nadie pueda abrir ────────────────────────
-- No es un fallo de seguridad, es basura que ocupa: archivos subidos y nunca
-- publicados. Se listan para poder decidir si se borran.
select 'archivo en el cajón sin publicar' as fallo, o.name, o.created_at::text
  from storage.objects o
 where o.bucket_id = 'medios-app'
   and not exists (select 1 from public.medios_app m where m.path = o.name);
