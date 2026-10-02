-- Dos cuentas para Bryan (migración 0106).
--
-- Lo que se prueba:
--   1. El check de capacidades acepta `solo_tablero`, conserva las anteriores y rechaza una inventada.
--   2. `asignar_cuenta_personal_bryan(correo)`: solo la ejecuta service_role (anon y authenticated, no).
--   3. Pone rol coach y copia las capacidades de la cuenta Alpha MENOS `solo_tablero`; es idempotente
--      y repetirla recoge una capacidad que la cuenta Alpha ganó después.
--   4. Falla sin cambiar nada: correo que no existe, correo de la cuenta Alpha.
--   5. «bryan» sale de es_coach(): las dos cuentas son el mismo dueño en Mi plan (plan_dueno_actual).
--   6. companeros_de_decision(): la cuenta personal ve a Manuela como compañero y NO a la cuenta Alpha
--      (solo_tablero).
--
-- La cuenta Alpha es la del uid real (28c3cfe8-…): la migración lo escribe, la prueba lo reproduce.
-- Bloque de UUID propio para el resto (e2…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce', 'alpha-cuenta@ejemplo.test'),
  ('e2000000-0000-0000-0000-000000000001', 'Bryan-Personal@ejemplo.test'),
  ('e2000000-0000-0000-0000-000000000002', 'dc-manuela@ejemplo.test'),
  ('e2000000-0000-0000-0000-000000000003', 'dc-asesorado@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce', 'Alpha', 'coach', 'AL'),
  ('e2000000-0000-0000-0000-000000000001', '', 'asesorado', ''),
  ('e2000000-0000-0000-0000-000000000002', 'Manuela de prueba', 'nutricionista', 'MP'),
  ('e2000000-0000-0000-0000-000000000003', 'Asesorado cualquiera', 'asesorado', 'AC')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- La cuenta Alpha tiene sus capacidades (como en producción) y la nueva.
insert into public.capacidades_staff (usuario_id, capacidad) values
  ('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce', 'leer_entrenamiento'),
  ('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce', 'ver_administracion'),
  ('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce', 'organizar_plan'),
  ('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce', 'decisiones_compartidas'),
  ('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce', 'solo_tablero'),
  ('e2000000-0000-0000-0000-000000000002', 'decisiones_compartidas'),
  ('e2000000-0000-0000-0000-000000000002', 'organizar_plan')
on conflict do nothing;

-- 1 · check de capacidades
do $$
begin
  begin
    insert into public.capacidades_staff (usuario_id, capacidad)
    values ('e2000000-0000-0000-0000-000000000003', 'capacidad_inventada');
    raise exception 'FALLO: el check de capacidades aceptó una capacidad inventada';
  exception when check_violation then null;
  end;
  -- las anteriores siguen valiendo
  insert into public.capacidades_staff (usuario_id, capacidad)
  values ('e2000000-0000-0000-0000-000000000003', 'responder_mercadeo');
end $$;
delete from public.capacidades_staff where usuario_id = 'e2000000-0000-0000-0000-000000000003';

-- 2 · solo service_role ejecuta la función
select set_config('request.jwt.claim.sub', '', false);
select pruebas.afirmar(
  not has_function_privilege('anon', 'public.asignar_cuenta_personal_bryan(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.asignar_cuenta_personal_bryan(text)', 'execute')
  and has_function_privilege('service_role', 'public.asignar_cuenta_personal_bryan(text)', 'execute'),
  'asignar_cuenta_personal_bryan tiene que ser ejecutable solo por service_role');

select pruebas.soy('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce');
set role authenticated;
do $$
begin
  begin
    perform public.asignar_cuenta_personal_bryan('bryan-personal@ejemplo.test');
    raise exception 'FALLO: authenticated pudo asignar la cuenta personal';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 3 · asignar (el correo se compara sin mayúsculas ni espacios)
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
select public.asignar_cuenta_personal_bryan('  bryan-personal@EJEMPLO.test ');
select public.asignar_cuenta_personal_bryan('bryan-personal@ejemplo.test');  -- idempotente
reset role;

select pruebas.afirmar(
  (select rol = 'coach' and nombre = 'Bryan' and avatar_iniciales = 'BR'
     from public.usuarios_app where id = 'e2000000-0000-0000-0000-000000000001'),
  'la cuenta personal no quedó como coach con su nombre');
select pruebas.afirmar(
  (select array_agg(capacidad order by capacidad) = array['decisiones_compartidas', 'leer_entrenamiento', 'organizar_plan', 'ver_administracion']
     from public.capacidades_staff where usuario_id = 'e2000000-0000-0000-0000-000000000001'),
  'la cuenta personal no recibió exactamente las capacidades de la cuenta Alpha menos solo_tablero');
select pruebas.afirmar(
  not exists (select 1 from public.capacidades_staff
               where usuario_id = 'e2000000-0000-0000-0000-000000000001' and capacidad = 'solo_tablero'),
  'la cuenta personal recibió solo_tablero');
select pruebas.afirmar(
  exists (select 1 from public.capacidades_staff
           where usuario_id = '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce' and capacidad = 'solo_tablero'),
  'la cuenta Alpha perdió solo_tablero');

-- Repetir recoge lo que la cuenta Alpha ganó después, y quita solo_tablero si se coló.
insert into public.capacidades_staff (usuario_id, capacidad) values
  ('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce', 'revisar_creadores'),
  ('e2000000-0000-0000-0000-000000000001', 'solo_tablero');
set role service_role;
select public.asignar_cuenta_personal_bryan('bryan-personal@ejemplo.test');
reset role;
select pruebas.afirmar(
  exists (select 1 from public.capacidades_staff
           where usuario_id = 'e2000000-0000-0000-0000-000000000001' and capacidad = 'revisar_creadores')
  and not exists (select 1 from public.capacidades_staff
                   where usuario_id = 'e2000000-0000-0000-0000-000000000001' and capacidad = 'solo_tablero'),
  'repetir la asignación no recogió la capacidad nueva o no quitó solo_tablero');

-- 4 · fallos sin cambios
set role service_role;
do $$
begin
  begin
    perform public.asignar_cuenta_personal_bryan('no-existe@ejemplo.test');
    raise exception 'FALLO: asignó un correo que no existe';
  exception when no_data_found then null;
  end;
  begin
    perform public.asignar_cuenta_personal_bryan('alpha-cuenta@ejemplo.test');
    raise exception 'FALLO: asignó la propia cuenta Alpha como personal';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- 5 · «bryan» sale de es_coach(): las dos cuentas son el mismo dueño del plan
select pruebas.soy('e2000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(public.plan_dueno_actual() = 'bryan', 'la cuenta personal no es «bryan» en Mi plan');
reset role;
select pruebas.soy('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce');
set role authenticated;
select pruebas.afirmar(public.plan_dueno_actual() = 'bryan', 'la cuenta Alpha dejó de ser «bryan» en Mi plan');
reset role;

-- 6 · a quién se le pide la firma
select pruebas.soy('e2000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar(
  exists (select 1 from public.companeros_de_decision() where id = 'e2000000-0000-0000-0000-000000000002'),
  'la cuenta personal debería ver a Manuela como compañero de firma');
select pruebas.afirmar(
  not exists (select 1 from public.companeros_de_decision() where id = '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce'),
  'la cuenta Alpha (solo_tablero) aparece como compañero de firma');
reset role;

select pruebas.soy('e2000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.afirmar(not exists (select 1 from public.companeros_de_decision()), 'un asesorado no ve compañeros de firma');
reset role;

rollback;
