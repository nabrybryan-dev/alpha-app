-- App Alpha Athletics · Migración 0013 · Acotar a la nutricionista a lo nutricional
-- Pegar completo en: Supabase → SQL Editor → New query → Run
--
-- POR QUÉ
-- `es_staff()` iguala a la nutricionista con el coach en la capa de datos, y la
-- 0006 y la 0010 la usaron para dar acceso a tablas que contienen mucho más que
-- nutrición. La interfaz sí la limita (`layouts.tsx` la saca de /coach/*), pero
-- ESA NO ES LA FRONTERA: la app habla con Supabase directamente desde el
-- navegador, así que la frontera real es RLS. Con su propia sesión, desde la
-- consola del navegador, podía:
--
--   (1) leer el texto literal de TODAS las consultas del chat de TODOS los
--       asesorados —incluidas las de salud íntima— y marcarlas como revisadas,
--       sacándolas de la cola del coach sin que él las viera nunca;
--   (2) recibir en su teléfono, cada 45 s, el check-in completo de los 19:
--       ánimo, estrés, horas de sueño y comentarios de texto libre.
--
-- QUÉ CAMBIA
-- Lo nutricional (adherencias, planes, hidratación) se queda como está: es su
-- trabajo. Las consultas del chat pasan a ser solo del coach. De los check-ins
-- se le da una vista con las TRES columnas nutricionales y nada más.
--
-- Lo suyo propio no se toca: Manuela entrena con el plan de Alpha, así que
-- sigue viendo y escribiendo sus propios check-ins y consultas como cualquier
-- asesorada (esas políticas van por `usuario_id = auth.uid()`).

-- ===== (1) Consultas del chat: solo el coach =====

drop policy if exists consultas_leer_propias on public.consultas_chat;
create policy consultas_leer_propias on public.consultas_chat
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_coach());

drop policy if exists consultas_actualizar_staff on public.consultas_chat;
create policy consultas_actualizar_staff on public.consultas_chat
  for update to authenticated
  using (public.es_coach())
  with check (public.es_coach());

-- ===== (2) Check-ins: la nutricionista deja de leer la fila entera =====

drop policy if exists checkins_lee_staff on public.checkins;
create policy checkins_lee_staff on public.checkins
  for select to authenticated
  using (public.es_coach());

-- Vista con lo nutricional del check-in y NADA más. Deliberadamente no expone
-- `datos` completo: ahí viven motivación, cansancio, estrés, horas y calidad de
-- sueño y el campo de comentarios libres, que no son asunto de nutrición.
--
-- Va con `security_invoker = false` (el de por defecto) a propósito: RLS filtra
-- FILAS, no columnas, así que la única forma de recortar el jsonb es que la
-- vista lea la tabla con sus propios permisos. El control de acceso es el
-- `where` de abajo, no la RLS de `checkins`.
drop view if exists public.checkins_nutricion;
create view public.checkins_nutricion as
select
  c.id,
  c.usuario_id,
  c.fecha,
  (c.datos ->> 'pesoKg')::numeric as peso_kg,
  c.datos ->> 'hambre'            as hambre,
  c.datos ->> 'alimentacion'      as alimentacion
from public.checkins c
where public.es_staff() or c.usuario_id = auth.uid();

revoke all on public.checkins_nutricion from anon;
grant select on public.checkins_nutricion to authenticated;

-- ===== (3) Fichas de respuesta: las escribe el coach, no cualquier staff =====
-- Son los textos con los que Alpha le contesta a los 19: profundidad de
-- sentadilla, banderas de dolor, ciclo menstrual. Redactarlos es criterio de
-- entrenamiento. No rompe nada: la app solo las LEE (`consultasNube.ts:85`) y
-- quien las publica es `scripts/publicar-fichas.mjs` con `service_role`, que se
-- salta RLS por completo.

drop policy if exists fichas_escribir_staff on public.fichas_respuesta;
create policy fichas_escribir_coach on public.fichas_respuesta
  for all to authenticated using (public.es_coach()) with check (public.es_coach());

-- ===== (4) Higiene: las funciones de rol no las ejecuta el público =====
-- No es explotable (ambas evalúan `auth.uid()`, que es NULL para `anon`), pero
-- Supabase concede `execute` a `anon` por defecto y ya se revocó en
-- `ranking_disciplina` y `buscar_ficha`. Se deja igual de cerrado aquí.

revoke execute on function public.es_coach() from anon;
revoke execute on function public.es_staff() from anon;

-- ===== Comprobación =====
-- Con la sesión de Manuela (alpha+manu@gmail.com), esto debe devolver SOLO sus
-- propias filas, no las de los 19:
--   select count(*) from public.consultas_chat;
--   select count(*) from public.checkins;
-- Y esto sí debe devolver a todo el equipo, con tres columnas:
--   select * from public.checkins_nutricion;
