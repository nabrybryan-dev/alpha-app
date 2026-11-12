-- 0131: la lectura de contexto_clinico_firmado vuelve a limitarse al COACH ASIGNADO.
-- CAMBIO DE POLITICA DE LECTURA DE SALUD: requiere visto bueno de Bryan. Propuesta, NO APLICADA (I-16).
-- Hallazgo medido (base desechable, cadena 0001..0130): 0119 estrecha contexto_clinico_leer a es_coach_asignado, pero 0122 (posterior)
-- la reemplaza por usuario_id = auth.uid() OR es_coach() OR leer_entrenamiento; es_coach() es CUALQUIER coach, asi que un coach AJENO
-- leia el contexto de salud de una persona que no es suya. Esta migracion NUEVA (0122 no se edita) conserva lo que 0122 queria
-- (la persona lee su propia ficha) y devuelve a 0119 lo que 0119 queria (coach asignado o capacidad leer_entrenamiento).
-- DECISION DE BRYAN (16-oct): la capacidad leer_entrenamiento la tienen SOLO Bryan y Manuela y no se concede a nadie mas.
-- Esta migracion no concede ninguna capacidad (es un dato, no un cambio de esquema); la prueba 234 comprueba que ninguna migracion la concede.
begin;

drop policy if exists contexto_clinico_leer on public.contexto_clinico_firmado;
create policy contexto_clinico_leer on public.contexto_clinico_firmado
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.es_coach_asignado(usuario_id))
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

commit;
