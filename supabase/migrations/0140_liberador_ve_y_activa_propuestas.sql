-- 0140: PROPUESTA APARTE (NO APLICADA, I-16; decision D-17-05 de Bryan). Quien tiene `liberar_prescripcion` debe poder LEER y ACTUALIZAR propuestas de microciclo para que
-- activar_microciclo (SECURITY INVOKER) funcione, SIN darle `puesto_de_coach`. Motivo medido: es_coach() aparece en 75 politicas de 44 tablas y en 20 funciones;
-- dar `puesto_de_coach` a Manuela le abre todo eso (p.ej. lee las capacidades de todo el staff). Esta migracion solo toca las dos politicas de `microciclos`.
-- NO se mezcla con 0135/0138: se aplica despues de ellas y solo si Bryan elige este camino (la alternativa es conceder `puesto_de_coach`, un dato).
-- Reversa: volver a las dos politicas de 0135 (en reversa-0116-0140).
begin;

alter policy microciclos_leer on public.microciclos
  using ((usuario_id = (select auth.uid()) and estado <> 'propuesto') or (select public.es_coach()) or (select public.tiene_capacidad('liberar_prescripcion')));
alter policy microciclos_actualizar_propio on public.microciclos
  using ((usuario_id = (select auth.uid()) and estado <> 'propuesto') or (select public.es_coach()) or (select public.tiene_capacidad('liberar_prescripcion')))
  with check ((usuario_id = (select auth.uid()) and estado <> 'propuesto') or (select public.es_coach()) or (select public.tiene_capacidad('liberar_prescripcion')));

commit;
