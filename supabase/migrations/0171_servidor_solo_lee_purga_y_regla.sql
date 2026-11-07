-- 0171 · La clave del servidor solo LEE el recibo de purgas y la regla de ventana.
--
-- POR QUÉ. 0139 y 0141 dicen «service_role solo lee» y hacen `grant select ... to
-- service_role`, pero nunca le revocan lo que Supabase le da por defecto al crear una tabla
-- (insert, update, delete, truncate...). En la CI no se ve (Postgres limpio, sin esos
-- privilegios por defecto); en la base real sí: lo detectó la consulta de señales del 7-nov.
--
-- QUÉ CAMBIA. Se le quita a service_role todo menos SELECT en las cuatro tablas. Quien escribe
-- en ellas sigue igual: ejecutar_purga_texto_libre, encender_regla_ventana y
-- activar_por_regla_ventana son security definer de postgres (comprobado el 7-nov) y no usan
-- los privilegios de service_role. Ningún código de la app ni de las funciones de borde
-- escribe en estas tablas.
--
-- APLICADA el 7-nov-2026 por orden escrita de Bryan («ve con esto»).

revoke all on public.purgas_texto_libre from service_role;
grant select on public.purgas_texto_libre to service_role;

revoke all on public.regla_ventana_primer_plan from service_role;
grant select on public.regla_ventana_primer_plan to service_role;

revoke all on public.activaciones_regla_ventana from service_role;
grant select on public.activaciones_regla_ventana to service_role;

revoke all on public.avisos_regla_ventana from service_role;
grant select on public.avisos_regla_ventana to service_role;

-- DESHACER (si una tarea del servidor deja de funcionar):
--   grant all on public.purgas_texto_libre, public.regla_ventana_primer_plan,
--     public.activaciones_regla_ventana, public.avisos_regla_ventana to service_role;
