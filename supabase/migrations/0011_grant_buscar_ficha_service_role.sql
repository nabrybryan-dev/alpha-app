-- 0011_grant_buscar_ficha_service_role.sql
-- La 0010 revoco execute de public para cerrar el acceso anonimo, pero eso
-- deja tambien sin privilegio a service_role, que es con quien llama la Edge
-- Function responder-chat. Se concede explicitamente.

grant execute on function public.buscar_ficha(extensions.vector, int) to service_role;

-- Comprobacion: anon NO debe poder ejecutarla, service_role SI.
-- select has_function_privilege('anon', 'public.buscar_ficha(extensions.vector, int)', 'execute') as anon_ejecuta,
--        has_function_privilege('service_role', 'public.buscar_ficha(extensions.vector, int)', 'execute') as service_ejecuta;
