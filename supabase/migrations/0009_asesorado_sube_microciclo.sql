-- ============ 0009: EL ASESORADO PUEDE SUBIR SU MICROCICLO ============
-- CRÍTICO (incidente 2026-07-21): las series que registran los asesorados no
-- llegaban al coach. Causa raíz: la app hace un UPSERT del microciclo, y un
-- upsert en Postgres es INSERT ... ON CONFLICT, así que aplica la política de
-- INSERT aunque la fila ya exista. La política de INSERT era solo-coach
-- (microciclos_crear_coach), de modo que la escritura del asesorado se
-- rechazaba por RLS y sus series nunca se sincronizaban.
--
-- Fix: permitir al dueño insertar/upsertar SU propio microciclo. La política de
-- UPDATE (microciclos_actualizar_propio) ya permitía al dueño; con esto el
-- upsert completo pasa. El coach sigue pudiendo crear para cualquiera (es_coach).

drop policy if exists microciclos_crear_coach on public.microciclos;
create policy microciclos_crear_propio on public.microciclos
  for insert with check (usuario_id = auth.uid() or public.es_coach());
