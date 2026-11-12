-- Praxis: cuaderno de anotaciones por persona (0176). Migración SIN APLICAR en producción; esta prueba corre en el CI sobre
-- una base vacía con todas las migraciones. ESCRITA el 8-nov sin poder ejecutarse en un Postgres local: si falla en el CI,
-- el fallo es de la prueba o de la migración, y hay que leerlo antes de tocar nada.
--
-- QUÉ SE COMPRUEBA (contra RLS y privilegios de verdad):
--   1. Anotar una recuperación de zona y una reacción a comida; repetir la misma clave no duplica.
--   2. Rechazos: tipo desconocido, día futuro (Bogotá), recuperación sin zona, reacción sin momento, cita vacía o de más de 300.
--   3. Nadie escribe directo en la tabla.
--   4. Cada persona lee SOLO lo suyo; el coach tampoco ve las anotaciones de la asesorada.
--   5. Olvidar borra todo lo propio y nada ajeno.
--   6. anon y sin sesión se niegan.
-- Bloque de UUID propio (fb…). Termina en ROLLBACK.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('fb000000-0000-0000-0000-000000000001', 'anot-asesorada@ejemplo.test'),
  ('fb000000-0000-0000-0000-000000000002', 'anot-coach@ejemplo.test'),
  ('fb000000-0000-0000-0000-000000000003', 'anot-otra@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('fb000000-0000-0000-0000-000000000001', 'Asesorada de prueba', 'asesorado', 'AS'),
  ('fb000000-0000-0000-0000-000000000002', 'Coach de prueba', 'coach', 'CO'),
  ('fb000000-0000-0000-0000-000000000003', 'Otra de prueba', 'asesorado', 'OT')
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

select pruebas.soy('fb000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

do $$
declare r jsonb; r2 jsonb;
begin
  -- 1 · Anotar e idempotencia
  r := public.praxis_anotar_patron('recuperacion_zona', 'piernas', null, null, 'estoy molida de las piernas', 'msg-1');
  perform pruebas.afirmar((r->>'repetida')::boolean = false, 'la primera anotacion salio como repetida');
  r2 := public.praxis_anotar_patron('recuperacion_zona', 'piernas', null, null, 'estoy molida de las piernas', 'msg-1');
  perform pruebas.afirmar((r2->>'repetida')::boolean = true and r2->>'id' = r->>'id', 'la misma clave no devolvio la misma fila');
  perform public.praxis_anotar_patron('reaccion_comida', null, 'almuerzo', 'frijoles', 'me senti pesada despues del almuerzo', 'msg-2');
  perform pruebas.afirmar((select count(*) from public.praxis_anotaciones_persona) = 2, 'no hay 2 anotaciones tras repetir una clave');

  -- 2 · Rechazos
  begin perform public.praxis_anotar_patron('dolor_rodilla', 'rodilla', null, null, 'x', 'msg-3'); raise exception 'FALLO: tipo desconocido';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_anotar_patron('reaccion_comida', null, 'almuerzo', null, 'x', 'msg-4', ((now() at time zone 'America/Bogota')::date + 1));
    raise exception 'FALLO: anoto un dia futuro';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_anotar_patron('recuperacion_zona', null, null, null, 'molida', 'msg-5'); raise exception 'FALLO: recuperacion sin zona';
  exception when check_violation then null; end;
  begin perform public.praxis_anotar_patron('reaccion_comida', null, null, null, 'pesada', 'msg-6'); raise exception 'FALLO: reaccion sin momento';
  exception when check_violation then null; end;
  begin perform public.praxis_anotar_patron('reaccion_comida', null, 'brunch', null, 'pesada', 'msg-7'); raise exception 'FALLO: momento fuera de la lista';
  exception when check_violation then null; end;
  begin perform public.praxis_anotar_patron('reaccion_comida', null, 'cena', null, '   ', 'msg-8'); raise exception 'FALLO: cita vacia';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_anotar_patron('reaccion_comida', null, 'cena', null, repeat('a', 301), 'msg-9'); raise exception 'FALLO: cita de 301';
  exception when invalid_parameter_value then null; end;

  -- 3 · Nadie escribe directo
  begin insert into public.praxis_anotaciones_persona (usuario_id, dia, tipo, zona, cita, clave)
    values (auth.uid(), current_date, 'recuperacion_zona', 'espalda', 'x', 'directo'); raise exception 'FALLO: insert directo';
  exception when insufficient_privilege then null; end;
  begin update public.praxis_anotaciones_persona set cita = 'otra'; raise exception 'FALLO: update directo';
  exception when insufficient_privilege then null; end;
  begin delete from public.praxis_anotaciones_persona; raise exception 'FALLO: delete directo';
  exception when insufficient_privilege then null; end;

  perform pruebas.afirmar((select count(*) from public.praxis_anotaciones_persona) = 2, 'la asesorada no ve sus 2 anotaciones');
end $$;

-- 4 · La otra persona y el coach no ven lo de la asesorada
reset role;
select pruebas.soy('fb000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
do $$
begin
  perform public.praxis_anotar_patron('recuperacion_zona', 'espalda', null, null, 'molida de la espalda', 'msg-1');
  perform pruebas.afirmar((select count(*) from public.praxis_anotaciones_persona) = 1, 'la otra ve anotaciones ajenas (o la clave choco entre personas)');
end $$;

reset role;
select pruebas.soy('fb000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar((select count(*) from public.praxis_anotaciones_persona) = 0, 'el coach ve las anotaciones de alguien');

-- 5 · Olvidar
reset role;
select pruebas.soy('fb000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar(public.praxis_olvidar_mis_anotaciones() = 2, 'olvidar no borro las 2 anotaciones propias');
reset role;
select pruebas.afirmar((select count(*) from public.praxis_anotaciones_persona where usuario_id = 'fb000000-0000-0000-0000-000000000003') = 1,
  'olvidar borro anotaciones ajenas');

-- 6 · anon y sin sesión
set role anon;
do $$
begin
  begin perform public.praxis_anotar_patron('reaccion_comida', null, 'cena', null, 'x', 'anon-1'); raise exception 'FALLO: anon anoto';
  exception when insufficient_privilege then null; end;
  begin perform public.praxis_olvidar_mis_anotaciones(); raise exception 'FALLO: anon olvido';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
do $$
begin
  begin perform public.praxis_anotar_patron('reaccion_comida', null, 'cena', null, 'x', 'sin-sesion'); raise exception 'FALLO: anoto sin sesion';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

\echo 'OK · cuaderno de anotaciones: idempotente, valida tipo/dia/campos, solo lo propio, olvidar (0176)'

rollback;
