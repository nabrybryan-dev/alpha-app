-- Latidos de la cadena (0171): la nube avisa UNA vez cuando el ASUS calla y otra cuando vuelve.
--
-- Qué se prueba:
--   1. service_role registra un latido; un origen con forma rara se rechaza.
--   2. Un origen que nunca latió no aparece; uno reciente tampoco.
--   3. Con más de 30 min sin latido sale 'caido'; marcado como avisado, ya no sale (una vez).
--   4. Al volver a latir sale 'volvio'; marcado, ya no sale.
--   5. Ni anon ni authenticated ejecutan nada ni leen la tabla.
--   6. cadena_pedir_vigilancia sin Vault/pg_net (como aquí) no falla: devuelve null.
-- ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

set role service_role;

select public.cadena_latido('asus-n8n', '{"flujo":"alpha-latido"}'::jsonb);
select pruebas.afirmar(
  (select count(*) from public.latidos_cadena where origen = 'asus-n8n' and detalle ->> 'flujo' = 'alpha-latido') = 1,
  'el latido no quedó guardado con su detalle');

do $$
begin
  begin
    perform public.cadena_latido('ASUS; drop table x', '{}'::jsonb);
    raise exception 'FALLO: aceptó un origen con forma rara';
  exception when invalid_parameter_value then null;
  end;
end
$$;

select pruebas.afirmar(not exists (select 1 from public.cadena_latidos_por_avisar(30)),
  'un latido reciente no debe avisar nada');

-- 3 · Calla más de 30 min.
reset role;
update public.latidos_cadena set visto_en = clock_timestamp() - interval '41 minutes' where origen = 'asus-n8n';
set role service_role;

select pruebas.afirmar(
  (select cambio = 'caido' and minutos >= 40 from public.cadena_latidos_por_avisar(30) where origen = 'asus-n8n'),
  'tras 41 min sin latido no salió el aviso de caída');
select public.cadena_latido_avisado('asus-n8n', 'caido');
select pruebas.afirmar(not exists (select 1 from public.cadena_latidos_por_avisar(30)),
  'la caída ya avisada volvió a salir (avisaría cada 10 min)');

-- 4 · Vuelve.
select public.cadena_latido('asus-n8n', '{}'::jsonb);
select pruebas.afirmar(
  (select cambio = 'volvio' from public.cadena_latidos_por_avisar(30) where origen = 'asus-n8n'),
  'al volver a latir no salió el aviso de vuelta');
select public.cadena_latido_avisado('asus-n8n', 'vivo');
select pruebas.afirmar(not exists (select 1 from public.cadena_latidos_por_avisar(30)),
  'la vuelta ya avisada volvió a salir');

-- 6 · Sin Vault ni pg_net no revienta.
select pruebas.afirmar(
  to_regnamespace('net') is not null or public.cadena_pedir_vigilancia() is null,
  'cadena_pedir_vigilancia sin pg_net debió devolver null');

reset role;

-- 5 · Nadie más.
select pruebas.afirmar(
  not has_function_privilege('anon', 'public.cadena_latido(text,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.cadena_latido(text,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.cadena_latidos_por_avisar(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.cadena_latido_avisado(text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.cadena_pedir_vigilancia()', 'execute')
  and not has_table_privilege('authenticated', 'public.latidos_cadena', 'select')
  and not has_table_privilege('anon', 'public.latidos_cadena', 'select'),
  'anon o authenticated tienen acceso a los latidos');

rollback;
