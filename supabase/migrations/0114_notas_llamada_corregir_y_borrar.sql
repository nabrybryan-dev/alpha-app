-- 0114: quien anotó una llamada puede corregirla y borrarla. Solo la suya.
--
-- POR QUÉ. La 0112/0113 dejaron las notas sin `update` ni `delete`: una nota guardada en la
-- persona o el día equivocados, o duplicada por un reintento, solo se arreglaba entrando a la
-- base con SQL. Bryan pidió resolverlo el 9-oct-2026.
--
-- LA REGLA. Corrige y borra quien la ESCRIBIÓ (`coach_id = auth.uid()`), y además sigue
-- teniendo que pasar la puerta de la consola (`es_coach()` o `leer_entrenamiento`): quien
-- pierde el acceso a la consola pierde también el de sus notas viejas. Nadie toca la nota de
-- otro, tampoco el coach: una bitácora en la que cualquiera reescribe lo que dijo el otro deja
-- de servir como bitácora.
--
-- QUÉ SE PUEDE CORREGIR. El privilegio de `update` es POR COLUMNA: fecha, hora, conclusiones,
-- tareas y próxima reunión. No se concede sobre `usuario_id`, `coach_id` ni `creado_en`: una
-- corrección no cambia de quién es la llamada, ni quién la anotó, ni cuándo se anotó. Así no
-- depende de que el `with check` lo vigile: la base rechaza la sentencia antes.
--
-- LO QUE NO CAMBIA. Leer y anotar siguen como en la 0113. `anon` sigue sin nada. No hay
-- `truncate`.

create policy notas_llamada_corregir on public.notas_llamada
  for update to authenticated
  using (
    coach_id = (select auth.uid())
    and (
      (select public.es_coach())
      or (select public.tiene_capacidad('leer_entrenamiento'))
    )
  )
  with check (
    coach_id = (select auth.uid())
    and (
      (select public.es_coach())
      or (select public.tiene_capacidad('leer_entrenamiento'))
    )
  );

create policy notas_llamada_borrar on public.notas_llamada
  for delete to authenticated
  using (
    coach_id = (select auth.uid())
    and (
      (select public.es_coach())
      or (select public.tiene_capacidad('leer_entrenamiento'))
    )
  );

grant update (fecha, hora, conclusiones, tareas, proxima_reunion) on public.notas_llamada to authenticated;
grant delete on public.notas_llamada to authenticated;
