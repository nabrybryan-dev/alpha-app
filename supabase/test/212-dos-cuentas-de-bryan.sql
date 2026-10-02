-- Dos cuentas para Bryan (migración 0106).
--
-- Lo que se prueba:
--   1. El check de capacidades acepta `solo_tablero` y `puesto_de_coach`, conserva las anteriores y
--      rechaza una inventada.
--   2. `asignar_cuenta_personal_bryan(correo)`: solo la ejecuta service_role (anon y authenticated, no),
--      y nadie con sesión puede darse la capacidad a sí mismo (capacidades_staff no se escribe por la API).
--   3. La cuenta personal SIGUE SIENDO asesorado (su rol no cambia: entrena, está en la cartera) y recibe
--      las capacidades de la cuenta Alpha menos `solo_tablero`, más `puesto_de_coach`; es idempotente y
--      repetirla recoge una capacidad que la cuenta Alpha ganó después.
--   4. Falla sin cambiar nada: correo que no existe, correo de la cuenta Alpha, usuario sin fila en
--      usuarios_app.
--   5. es_coach() y es_staff() son ciertos para ella; para un asesorado cualquiera, no (y no ve a los
--      demás); `plan_dueno_actual()` dice «bryan» para las dos cuentas.
--   6. Sus propias filas de asesorado siguen siendo suyas (adherencias por usuario_id) y un asesorado
--      sin la capacidad no ve las de ella.
--   7. companeros_de_decision(): la cuenta personal ve a Manuela y NO a la cuenta Alpha (solo_tablero);
--      Manuela ve a la personal (puesto_de_coach).
--
-- La cuenta Alpha es la del uid real (28c3cfe8-…): la migración lo escribe, la prueba lo reproduce.
-- Bloque de UUID propio para el resto (e2…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce', 'alpha-cuenta@ejemplo.test'),
  ('e2000000-0000-0000-0000-000000000001', 'Alpha+Bryan@ejemplo.test'),
  ('e2000000-0000-0000-0000-000000000002', 'dc-manuela@ejemplo.test'),
  ('e2000000-0000-0000-0000-000000000003', 'dc-asesorado@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce', 'Alpha', 'coach', 'AL'),
  ('e2000000-0000-0000-0000-000000000001', 'Bryan personal', 'asesorado', 'BP'),
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

-- Una fila propia de la cuenta personal (como asesorado) y una de otro asesorado.
insert into public.adherencias (id, usuario_id, fecha, estado) values
  ('e2-adh-personal', 'e2000000-0000-0000-0000-000000000001', current_date, 'si'),
  ('e2-adh-otro', 'e2000000-0000-0000-0000-000000000003', current_date, 'si')
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

-- 2 · solo service_role ejecuta la función; nadie con sesión se da la capacidad
select set_config('request.jwt.claim.sub', '', false);
select pruebas.afirmar(
  not has_function_privilege('anon', 'public.asignar_cuenta_personal_bryan(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.asignar_cuenta_personal_bryan(text)', 'execute')
  and has_function_privilege('service_role', 'public.asignar_cuenta_personal_bryan(text)', 'execute'),
  'asignar_cuenta_personal_bryan tiene que ser ejecutable solo por service_role');

select pruebas.soy('e2000000-0000-0000-0000-000000000003');
set role authenticated;
do $$
begin
  begin
    perform public.asignar_cuenta_personal_bryan('alpha+bryan@ejemplo.test');
    raise exception 'FALLO: authenticated pudo asignar la cuenta personal';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.capacidades_staff (usuario_id, capacidad)
    values ('e2000000-0000-0000-0000-000000000003', 'puesto_de_coach');
    raise exception 'FALLO: un asesorado se dio a sí mismo puesto_de_coach';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pruebas.afirmar(
  not exists (select 1 from public.capacidades_staff
               where usuario_id = 'e2000000-0000-0000-0000-000000000003' and capacidad = 'puesto_de_coach'),
  'el asesorado quedó con puesto_de_coach');

-- Antes de asignar, la cuenta personal es un asesorado más.
select pruebas.soy('e2000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(not public.es_coach() and not public.es_staff(), 'antes de asignar, la cuenta personal ya era coach o staff');
reset role;

-- 3 · asignar (el correo se compara sin mayúsculas ni espacios)
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
select public.asignar_cuenta_personal_bryan('  alpha+bryan@EJEMPLO.test ');
select public.asignar_cuenta_personal_bryan('alpha+bryan@ejemplo.test');  -- idempotente
reset role;

select pruebas.afirmar(
  (select rol = 'asesorado' and nombre = 'Bryan personal'
     from public.usuarios_app where id = 'e2000000-0000-0000-0000-000000000001'),
  'la cuenta personal dejó de ser asesorado o cambió su nombre: su entreno, su cartera y su cadena dependen de eso');
select pruebas.afirmar(
  (select array_agg(capacidad order by capacidad) = array['decisiones_compartidas', 'leer_entrenamiento', 'organizar_plan', 'puesto_de_coach', 'ver_administracion']
     from public.capacidades_staff where usuario_id = 'e2000000-0000-0000-0000-000000000001'),
  'la cuenta personal no recibió las capacidades de la cuenta Alpha menos solo_tablero, más puesto_de_coach');
select pruebas.afirmar(
  exists (select 1 from public.capacidades_staff
           where usuario_id = '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce' and capacidad = 'solo_tablero')
  and not exists (select 1 from public.capacidades_staff
                   where usuario_id = '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce' and capacidad = 'puesto_de_coach'),
  'la cuenta Alpha perdió solo_tablero o ganó puesto_de_coach');

-- Repetir recoge lo que la cuenta Alpha ganó después, y quita solo_tablero si se coló.
insert into public.capacidades_staff (usuario_id, capacidad) values
  ('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce', 'revisar_creadores'),
  ('e2000000-0000-0000-0000-000000000001', 'solo_tablero');
set role service_role;
select public.asignar_cuenta_personal_bryan('alpha+bryan@ejemplo.test');
reset role;
select pruebas.afirmar(
  exists (select 1 from public.capacidades_staff
           where usuario_id = 'e2000000-0000-0000-0000-000000000001' and capacidad = 'revisar_creadores')
  and not exists (select 1 from public.capacidades_staff
                   where usuario_id = 'e2000000-0000-0000-0000-000000000001' and capacidad = 'solo_tablero'),
  'repetir la asignación no recogió la capacidad nueva o no quitó solo_tablero');

-- 4 · fallos sin cambios
insert into auth.users (id, email) values ('e2000000-0000-0000-0000-000000000009', 'sin-fila@ejemplo.test')
on conflict (id) do nothing;
delete from public.usuarios_app where id = 'e2000000-0000-0000-0000-000000000009';
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
  begin
    perform public.asignar_cuenta_personal_bryan('sin-fila@ejemplo.test');
    raise exception 'FALLO: asignó un usuario sin fila en usuarios_app';
  exception when no_data_found then null;
  end;
end $$;
reset role;
select pruebas.afirmar(
  not exists (select 1 from public.capacidades_staff where usuario_id = 'e2000000-0000-0000-0000-000000000009'),
  'una asignación fallida dejó capacidades escritas');

-- 5 · coach/staff por capacidad; «bryan» en las dos cuentas
select pruebas.soy('e2000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(public.es_coach() and public.es_staff(), 'la cuenta personal no cuenta como coach/staff');
select pruebas.afirmar(public.plan_dueno_actual() = 'bryan', 'la cuenta personal no es «bryan» en Mi plan');
-- ve a los demás asesorados (lo que hace un coach)...
select pruebas.afirmar(
  exists (select 1 from public.usuarios_app where id = 'e2000000-0000-0000-0000-000000000003'),
  'la cuenta personal no ve a los demás usuarios');
reset role;

select pruebas.soy('28c3cfe8-13ef-4f3e-95cc-f23c4f260bce');
set role authenticated;
select pruebas.afirmar(public.es_coach() and public.plan_dueno_actual() = 'bryan', 'la cuenta Alpha dejó de ser coach o «bryan»');
reset role;

select pruebas.soy('e2000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(not public.es_coach() and not public.es_staff(), 'un asesorado cualquiera pasó a ser coach o staff');
select pruebas.afirmar(
  not exists (select 1 from public.adherencias where usuario_id = 'e2000000-0000-0000-0000-000000000001'),
  'un asesorado cualquiera ve las adherencias de la cuenta personal');
reset role;

-- 6 · lo suyo de asesorado sigue siendo suyo
select pruebas.soy('e2000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar(
  exists (select 1 from public.adherencias where usuario_id = 'e2000000-0000-0000-0000-000000000001'),
  'la cuenta personal dejó de ver sus propias filas de asesorado');
reset role;

-- 7 · a quién se le pide la firma
select pruebas.soy('e2000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar(
  exists (select 1 from public.companeros_de_decision() where id = 'e2000000-0000-0000-0000-000000000002'),
  'la cuenta personal debería ver a Manuela como compañero de firma');
select pruebas.afirmar(
  not exists (select 1 from public.companeros_de_decision() where id = '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce'),
  'la cuenta Alpha (solo_tablero) aparece como compañero de firma');
reset role;

select pruebas.soy('e2000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.afirmar(
  exists (select 1 from public.companeros_de_decision() where id = 'e2000000-0000-0000-0000-000000000001'),
  'Manuela debería ver a la cuenta personal como compañero de firma');
reset role;

select pruebas.soy('e2000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.afirmar(not exists (select 1 from public.companeros_de_decision()), 'un asesorado no ve compañeros de firma');
reset role;

rollback;
