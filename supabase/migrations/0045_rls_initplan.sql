-- Las políticas RLS dejan de llamarse una vez por fila.
--
-- `es_coach()` y `es_staff()` son funciones `stable security definer` que
-- consultan `usuarios_app`. Escritas desnudas dentro de un USING, Postgres las
-- evalúa **por cada fila** que examina. Envueltas en `(select ...)` pasan a ser
-- un InitPlan: se calculan UNA vez por consulta. Lo mismo con `auth.uid()`.
--
-- Lo que se midió antes de este cambio, en pg_stat_user_tables:
--
--   usuarios_app   seq_scan 3.492.050   seq_tup_read 76.459.275   filas: 26
--   microciclos    seq_scan    17.969   seq_tup_read  1.057.457
--   checkins       seq_scan    16.124   seq_tup_read    662.601
--
-- 76 millones de filas leídas de una tabla de 26. Ninguna otra tabla pasa de
-- 18.000 scans: `usuarios_app` recibía 200 veces la carga de cualquier otra,
-- y no por lo que guarda sino por cuántas veces se le pregunta quién eres.
--
-- Las políticas de nutrición (0015 en adelante) ya nacieron con este patrón.
-- Esta migración lo lleva a las de 0001, 0003, 0006 y 0010, que se quedaron
-- atrás. NO cambia quién ve qué: `(select f())` y `f()` devuelven lo mismo.
--
-- `alter policy` y no `drop`+`create`: no abre una ventana sin política y no
-- se puede perder un WITH CHECK por descuido al reescribirlo.
--
-- Aviso aparte, para otra migración: las políticas `for all` de escritura
-- (`perfiles_escribir_coach`, `planes_escribir_coach`, `contenidos_escribir_coach`,
-- `cuestionarios_escribir_coach`, `premiaciones_escribir_coach`) también se
-- evalúan en cada SELECT, porque ALL incluye lectura. Por eso el linter de
-- Supabase da 92 avisos de políticas permisivas múltiples: cada lectura paga
-- `es_coach()` dos veces. Acotarlas a insert/update/delete es el paso 2.

begin;

alter policy usuarios_leer on public.usuarios_app
  using (id = (select auth.uid())
      or (select public.es_staff())
      or ((select auth.uid()) is not null
          and rol = any (array['coach'::text, 'nutricionista'::text])));

alter policy perfiles_leer on public.perfiles
  using (usuario_id = (select auth.uid()) or (select public.es_coach()));
alter policy perfiles_escribir_coach on public.perfiles
  using ((select public.es_coach())) with check ((select public.es_coach()));

alter policy microciclos_leer on public.microciclos
  using (usuario_id = (select auth.uid()) or (select public.es_coach()));

alter policy checkins_todo_propio on public.checkins
  using (usuario_id = (select auth.uid()) or (select public.es_coach()))
  with check (usuario_id = (select auth.uid()) or (select public.es_coach()));
alter policy checkins_lee_staff on public.checkins
  using ((select public.es_coach()));

alter policy adherencias_todo_propio on public.adherencias
  using (usuario_id = (select auth.uid()) or (select public.es_coach()))
  with check (usuario_id = (select auth.uid()) or (select public.es_coach()));
alter policy adherencias_lee_staff on public.adherencias
  using ((select public.es_staff()));

alter policy planes_leer on public.planes_nutricionales
  using (usuario_id = (select auth.uid()) or (select public.es_staff()));
alter policy planes_escribir_coach on public.planes_nutricionales
  using ((select public.es_coach())) with check ((select public.es_coach()));

alter policy mensajes_leer on public.mensajes
  using (de_id = (select auth.uid()) or para_id = (select auth.uid()));

alter policy cuestionarios_leer on public.cuestionarios
  using ((select auth.uid()) = any (asignado_a) or (select public.es_coach()));
alter policy cuestionarios_escribir_coach on public.cuestionarios
  using ((select public.es_coach())) with check ((select public.es_coach()));

alter policy respuestas_leer on public.respuestas
  using (usuario_id = (select auth.uid()) or (select public.es_coach()));

alter policy contenidos_leer on public.contenidos
  using ((select auth.uid()) is not null);
alter policy contenidos_escribir_coach on public.contenidos
  using ((select public.es_coach())) with check ((select public.es_coach()));

alter policy premiaciones_leer on public.premiaciones
  using (usuario_id = (select auth.uid()) or (select public.es_coach()));
alter policy premiaciones_escribir_coach on public.premiaciones
  using ((select public.es_coach())) with check ((select public.es_coach()));

alter policy hidratacion_todo_propio on public.hidratacion
  using (usuario_id = (select auth.uid()) or (select public.es_coach()))
  with check (usuario_id = (select auth.uid()) or (select public.es_coach()));
alter policy hidratacion_lee_staff on public.hidratacion
  using ((select public.es_staff()));

alter policy consultas_leer_propias on public.consultas_chat
  using (usuario_id = (select auth.uid()) or (select public.es_coach()));

commit;

-- ── Comprobación (no basta con el «Success») ─────────────────────────────────
-- 1) Que no quede ninguna llamada desnuda en estas 21. Debe devolver 0 filas:
--
--   select tablename, policyname from pg_policies
--   where schemaname='public'
--     and (qual ~ '[^(]auth\.uid\(\)' or qual ~ '[^(]es_(coach|staff)\(\)'
--       or qual ~ '^(auth\.uid|es_coach|es_staff)\(\)');
--
-- 2) Que el trabajo real baje. Anotar, usar la app un rato, y volver a mirar:
--    tiene que crecer en decenas, no en miles.
--
--   select seq_scan, seq_tup_read from pg_stat_user_tables
--   where relname='usuarios_app';
