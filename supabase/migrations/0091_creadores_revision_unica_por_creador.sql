-- ============================================================================
-- 0091 · creadores_revisiones: la unicidad incluye al CREADOR
-- ============================================================================
--
-- Fallo de la 0090, cazado al cargar los datos reales el 28-sep: el `unique` era
-- (revision_id, revisor, rol_reel), así que el «reciente_1» de un creador chocaba con el
-- «reciente_1» de otro en la misma vuelta y el importador (`on conflict do nothing`) lo
-- descartaba EN SILENCIO: de 30 notas entraron 10. La prueba 110 no lo vio porque solo
-- sembraba un creador; ahora siembra dos con el mismo rol.
--
-- Arreglo: el unique pasa a (revision_id, creador_id, revisor, rol_reel). Las 10 filas que
-- ya hay no se tocan; el importador vuelve a correr y añade las 20 que faltan.
-- ============================================================================

begin;

alter table public.creadores_revisiones
  drop constraint if exists creadores_revisiones_revision_id_revisor_rol_reel_key;

alter table public.creadores_revisiones
  add constraint creadores_revisiones_unica_por_creador
  unique (revision_id, creador_id, revisor, rol_reel);

commit;
