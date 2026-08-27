-- Las políticas de escritura dejan de dispararse en cada lectura.
--
-- Una política `for all` cubre TAMBIÉN el SELECT. Cinco de las nuestras se
-- escribieron así en la 0001 -«escribir_coach»- y llevan desde entonces
-- evaluándose en cada consulta de lectura, aunque no tengan nada que decir
-- sobre quién puede leer. Como las políticas permisivas se combinan con OR,
-- cada SELECT pagaba una llamada extra a `es_coach()` que no cambiaba el
-- resultado.
--
-- Es lo que hay detrás de los 92 avisos `multiple_permissive_policies` del
-- linter de Supabase, y de buena parte de los 364 scans de `usuarios_app` que
-- quedaron medidos DESPUÉS de la 0045: aquélla quitó la evaluación por fila,
-- ésta quita la segunda evaluación por consulta.
--
-- ── Por qué no cambia quién ve qué ───────────────────────────────────────────
--
-- Las permisivas se unen con OR, así que quitarle el SELECT a una política
-- solo importa si aportaba lectura que ninguna otra daba. En las cinco, lo que
-- aportaba ya estaba cubierto:
--
--   perfiles       leer = (usuario_id = uid OR es_coach())
--                  escribir = es_coach()                      ⊆ leer
--
--   planes_nutric. leer = (usuario_id = uid OR es_staff())
--                  escribir = es_coach()                      ⊆ leer
--                  porque es_staff() es rol in ('coach','nutricionista'):
--                  todo coach es staff, luego es_coach() ⟹ es_staff()
--
--   contenidos     leer = (uid is not null)
--                  escribir = es_coach()                      ⊆ leer
--                  porque es_coach() busca `id = auth.uid()` y `id` es not
--                  null: sin sesión no puede ser cierto
--
--   cuestionarios  leer = (uid = any(asignado_a) OR es_coach())
--                  escribir = es_coach()                      ⊆ leer
--
--   premiaciones   leer = (usuario_id = uid OR es_coach())
--                  escribir = es_coach()                      ⊆ leer
--
-- En las cinco, `leer OR escribir` = `leer`. El SELECT queda igual, byte a
-- byte, para todos los roles.
--
-- ── Las que NO se tocan, y por qué ───────────────────────────────────────────
--
-- `adherencias_todo_propio`, `checkins_todo_propio` e `hidratacion_todo_propio`
-- también son `for all`, pero ahí el `for all` ES la política de lectura del
-- dueño: `(usuario_id = auth.uid() OR es_coach())`. La única otra permisiva de
-- SELECT en esas tablas es la de staff. Acotarlas a escritura dejaría a cada
-- asesorada SIN PODER LEER sus propios check-ins, su hidratación y su
-- adherencia. Se quedan como están.
--
-- `fichas_escribir_staff` tampoco: `fichas_leer` es `using (publicada)`, así
-- que el `for all` es lo único que deja al staff ver una ficha sin publicar.
-- Quitárselo cambiaría el comportamiento de verdad.
--
-- ── Nota de forma ────────────────────────────────────────────────────────────
--
-- El `cmd` de una política no se puede cambiar con `alter policy`: hay que
-- soltarla y recrearla. Va todo en una transacción, así que no existe un
-- instante en que la tabla se quede sin política.
--
-- No se les pone `to authenticated` porque las originales de la 0001 no lo
-- tenían y por defecto son PUBLIC. Mantenerlo idéntico evita cambiar de paso
-- algo que nadie pidió; para `anon` da igual, la 0013 ya le revocó el execute
-- sobre `es_coach()`.

begin;

-- ── perfiles ─────────────────────────────────────────────────────────────────
drop policy if exists perfiles_escribir_coach on public.perfiles;

create policy perfiles_escribir_coach_insertar on public.perfiles
  for insert with check ((select public.es_coach()));
create policy perfiles_escribir_coach_actualizar on public.perfiles
  for update using ((select public.es_coach()))
              with check ((select public.es_coach()));
create policy perfiles_escribir_coach_borrar on public.perfiles
  for delete using ((select public.es_coach()));

-- ── planes_nutricionales ─────────────────────────────────────────────────────
drop policy if exists planes_escribir_coach on public.planes_nutricionales;

create policy planes_escribir_coach_insertar on public.planes_nutricionales
  for insert with check ((select public.es_coach()));
create policy planes_escribir_coach_actualizar on public.planes_nutricionales
  for update using ((select public.es_coach()))
              with check ((select public.es_coach()));
create policy planes_escribir_coach_borrar on public.planes_nutricionales
  for delete using ((select public.es_coach()));

-- ── contenidos ───────────────────────────────────────────────────────────────
drop policy if exists contenidos_escribir_coach on public.contenidos;

create policy contenidos_escribir_coach_insertar on public.contenidos
  for insert with check ((select public.es_coach()));
create policy contenidos_escribir_coach_actualizar on public.contenidos
  for update using ((select public.es_coach()))
              with check ((select public.es_coach()));
create policy contenidos_escribir_coach_borrar on public.contenidos
  for delete using ((select public.es_coach()));

-- ── cuestionarios ────────────────────────────────────────────────────────────
drop policy if exists cuestionarios_escribir_coach on public.cuestionarios;

create policy cuestionarios_escribir_coach_insertar on public.cuestionarios
  for insert with check ((select public.es_coach()));
create policy cuestionarios_escribir_coach_actualizar on public.cuestionarios
  for update using ((select public.es_coach()))
              with check ((select public.es_coach()));
create policy cuestionarios_escribir_coach_borrar on public.cuestionarios
  for delete using ((select public.es_coach()));

-- ── premiaciones ─────────────────────────────────────────────────────────────
drop policy if exists premiaciones_escribir_coach on public.premiaciones;

create policy premiaciones_escribir_coach_insertar on public.premiaciones
  for insert with check ((select public.es_coach()));
create policy premiaciones_escribir_coach_actualizar on public.premiaciones
  for update using ((select public.es_coach()))
              with check ((select public.es_coach()));
create policy premiaciones_escribir_coach_borrar on public.premiaciones
  for delete using ((select public.es_coach()));

commit;

-- ── Comprobación, que el «Success» no prueba nada ────────────────────────────
--
-- 1) Que ninguna de las cinco tablas tenga ya más de UNA permisiva de SELECT.
--    Debe devolver 0 filas:
--
--   select tablename, count(*) as permisivas_select
--   from pg_policies
--   where schemaname='public'
--     and tablename in ('perfiles','planes_nutricionales','contenidos',
--                       'cuestionarios','premiaciones')
--     and cmd in ('SELECT','ALL')
--   group by tablename
--   having count(*) > 1;
--
-- 2) Que la escritura siga intacta: 3 políticas por tabla (insert/update/
--    delete). Debe devolver 5 filas, todas con 3:
--
--   select tablename, count(*) as politicas_de_escritura
--   from pg_policies
--   where schemaname='public'
--     and tablename in ('perfiles','planes_nutricionales','contenidos',
--                       'cuestionarios','premiaciones')
--     and policyname like '%escribir_coach_%'
--   group by tablename order by tablename;
--
-- 3) El trabajo real. Anotar, usar la app, y volver a mirar. La marca tras la
--    0045 fue 3.493.331 scans con ~10 hidrataciones. Debería bajar el ritmo
--    por hidratación, no el número absoluto:
--
--   select seq_scan, seq_tup_read from pg_stat_user_tables
--   where relname='usuarios_app';
