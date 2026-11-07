-- Praxis: guardar el check-in confirmado (0170). Migración SIN APLICAR en producción; esta prueba corre en el CI
-- sobre una base vacía con todas las migraciones.
--
-- QUÉ SE COMPRUEBA (contra RLS y privilegios de verdad):
--   1. Sin fila de hoy: la crea con el id de la app, marca parcial y el libro guarda antes nulo.
--   2. La misma tarjeta dos veces = una (ya_aplicado, sin segunda escritura).
--   3. Completar los 8 quita la marca parcial y conserva lo que ya estaba; el antes por campo queda en el libro.
--   4. horasSueno entra a anotadoHoy una sola vez.
--   5. Valores fuera de escala, dolor distinto de 0, campos no permitidos y parche vacío: rechazados sin escribir.
--   6. Fila de hoy ya existente con otro id: se conserva el id y el valor previo queda como antes.
--   7. El coach escribe SU fila, nunca la de la asesorada.
--   8. anon y sin sesión se niegan.
--   9. El ranking del servidor no cuenta un check-in a medias.
-- Bloque de UUID propio (f9…). Termina en ROLLBACK.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('f9000000-0000-0000-0000-000000000001', 'checkin-praxis-asesorada@ejemplo.test'),
  ('f9000000-0000-0000-0000-000000000002', 'checkin-praxis-coach@ejemplo.test'),
  ('f9000000-0000-0000-0000-000000000003', 'checkin-praxis-otra@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('f9000000-0000-0000-0000-000000000001', 'Asesorada de prueba', 'asesorado', 'AS'),
  ('f9000000-0000-0000-0000-000000000002', 'Coach de prueba', 'coach', 'CO'),
  ('f9000000-0000-0000-0000-000000000003', 'Otra de prueba', 'asesorado', 'OT')
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- La otra asesorada ya tiene check-in de hoy, con un id que no es el de la app y un estrés marcado a mano.
insert into public.checkins (id, usuario_id, fecha, datos) values
  ('ck-a-mano', 'f9000000-0000-0000-0000-000000000003', (now() at time zone 'America/Bogota')::date,
   '{"id":"ck-a-mano","usuarioId":"f9000000-0000-0000-0000-000000000003","estres":"MUCHO","comentarios":"escrito a mano"}'::jsonb);

select pruebas.soy('f9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

do $$
declare
  r jsonb;
  hoy date := (now() at time zone 'America/Bogota')::date;
  uid text := auth.uid()::text;
  n int;
begin
  -- 1 · Sin fila de hoy
  r := public.praxis_aplicar_checkin('m1', 0, '{"calidadSueno":"MALA"}'::jsonb);
  perform pruebas.afirmar((r->>'ya_aplicado')::boolean = false and (r->>'parcial')::boolean = true, 'm1 no quedo parcial');
  perform pruebas.afirmar((select id from public.checkins where usuario_id = auth.uid() and fecha = hoy) = 'ck-' || uid || '-' || hoy::text,
    'la fila nueva no lleva el id de la app');
  perform pruebas.afirmar((select datos->>'calidadSueno' = 'MALA' and datos->>'parcial' = 'true' and datos->>'usuarioId' = uid
                             from public.checkins where usuario_id = auth.uid() and fecha = hoy), 'la fila nueva no trae lo esperado');
  perform pruebas.afirmar((select antes is null and tipo = 'checkin' from public.praxis_registros_aplicados where mensaje_id = 'm1'),
    'el libro de m1 debia tener antes nulo y tipo checkin');

  -- 2 · La misma tarjeta otra vez
  r := public.praxis_aplicar_checkin('m1', 0, '{"calidadSueno":"BUENA"}'::jsonb);
  perform pruebas.afirmar((r->>'ya_aplicado')::boolean, 'la misma tarjeta no dijo ya_aplicado');
  perform pruebas.afirmar((select datos->>'calidadSueno' from public.checkins where usuario_id = auth.uid() and fecha = hoy) = 'MALA',
    'la misma tarjeta escribio dos veces');

  -- 3 · Completar los 8
  r := public.praxis_aplicar_checkin('m2', 0,
    '{"rendimiento":"REGULAR","motivacion":"POCO","hambreEscala":5,"cansancio":"REGULAR","estres":"REGULAR","dolor":0,"alimentacion":"BUENA"}'::jsonb);
  perform pruebas.afirmar((r->>'parcial')::boolean = false, 'con los 8 seguia parcial');
  perform pruebas.afirmar((select not (datos ? 'parcial') and datos->>'calidadSueno' = 'MALA' and datos->>'hambreEscala' = '5'
                             from public.checkins where usuario_id = auth.uid() and fecha = hoy), 'completar no quito la marca o perdio lo anterior');
  perform pruebas.afirmar((select antes->'campos' ? 'rendimiento' and antes->'campos'->'rendimiento' = 'null'::jsonb and antes->>'parcial' = 'true'
                             from public.praxis_registros_aplicados where mensaje_id = 'm2'), 'el antes por campo de m2 no quedo');

  -- 4 · horasSueno a anotadoHoy, una sola vez
  perform public.praxis_aplicar_checkin('m3', 0, '{"horasSueno":6.5}'::jsonb);
  perform public.praxis_aplicar_checkin('m4', 0, '{"horasSueno":7}'::jsonb);
  perform pruebas.afirmar((select datos->'anotadoHoy' = '["horasSueno"]'::jsonb and datos->>'horasSueno' = '7'
                             from public.checkins where usuario_id = auth.uid() and fecha = hoy), 'anotadoHoy no quedo con horasSueno una sola vez');

  -- 5 · Rechazos sin escribir
  select count(*) into n from public.praxis_registros_aplicados where usuario_id = auth.uid();
  begin perform public.praxis_aplicar_checkin('x1', 0, '{"dolor":4}'::jsonb); raise exception 'FALLO: guardo dolor 4';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aplicar_checkin('x2', 0, '{"hambreEscala":11}'::jsonb); raise exception 'FALLO: guardo hambre 11';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aplicar_checkin('x3', 0, '{"hambreEscala":5.5}'::jsonb); raise exception 'FALLO: guardo hambre 5.5';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aplicar_checkin('x4', 0, '{"estres":"ALTO"}'::jsonb); raise exception 'FALLO: guardo estres ALTO';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aplicar_checkin('x5', 0, '{"pesoKg":70}'::jsonb); raise exception 'FALLO: guardo el peso por esta via';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aplicar_checkin('x6', 0, '{"horasSueno":14.5}'::jsonb); raise exception 'FALLO: guardo 14.5 horas';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aplicar_checkin('x7', 0, '{}'::jsonb); raise exception 'FALLO: guardo un parche vacio';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aplicar_checkin('x8', 0, '{"estres":"POCO","dolor":3}'::jsonb); raise exception 'FALLO: guardo medio parche';
  exception when invalid_parameter_value then null; end;
  perform pruebas.afirmar((select count(*) from public.praxis_registros_aplicados where usuario_id = auth.uid()) = n
                          and (select datos->>'estres' from public.checkins where usuario_id = auth.uid() and fecha = hoy) = 'REGULAR',
    'un rechazo escribio en el libro o en el check-in');
end $$;

-- 6 · Fila existente con otro id
reset role;
select pruebas.soy('f9000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
do $$
declare hoy date := (now() at time zone 'America/Bogota')::date;
begin
  perform public.praxis_aplicar_checkin('o1', 0, '{"estres":"REGULAR"}'::jsonb);
  perform pruebas.afirmar((select id = 'ck-a-mano' and datos->>'estres' = 'REGULAR' and datos->>'comentarios' = 'escrito a mano' and datos->>'parcial' = 'true'
                             from public.checkins where usuario_id = auth.uid() and fecha = hoy), 'cambio el id o perdio lo escrito a mano');
  perform pruebas.afirmar((select antes->'campos'->>'estres' = 'MUCHO' from public.praxis_registros_aplicados where mensaje_id = 'o1'),
    'el antes no guardo el estres previo');
end $$;

-- 7 · El coach escribe SU fila
reset role;
select pruebas.soy('f9000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
do $$
declare hoy date := (now() at time zone 'America/Bogota')::date;
begin
  perform public.praxis_aplicar_checkin('c1', 0, '{"estres":"POCO"}'::jsonb);
  perform pruebas.afirmar(exists (select 1 from public.checkins where usuario_id = auth.uid() and fecha = hoy), 'el coach no tiene su fila');
end $$;
reset role;
select pruebas.afirmar((select datos->>'estres' from public.checkins
                         where usuario_id = 'f9000000-0000-0000-0000-000000000001' and fecha = (now() at time zone 'America/Bogota')::date) = 'REGULAR',
  'el coach toco el check-in de la asesorada');

-- 8 · anon y sin sesión
set role anon;
do $$
begin
  begin perform public.praxis_aplicar_checkin('a', 0, '{"estres":"POCO"}'::jsonb); raise exception 'FALLO: anon guardo check-in';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
do $$
begin
  begin perform public.praxis_aplicar_checkin('s', 0, '{"estres":"POCO"}'::jsonb); raise exception 'FALLO: guardo check-in sin sesion';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 9 · Ranking: la asesorada tiene hoy un check-in completo; la otra, uno a medias.
select pruebas.afirmar((select checkins from public.ranking_disciplina_vivo() where usuario_id = 'f9000000-0000-0000-0000-000000000001') = 1,
  'el ranking no conto el check-in completo');
select pruebas.afirmar((select checkins from public.ranking_disciplina_vivo() where usuario_id = 'f9000000-0000-0000-0000-000000000003') = 0,
  'el ranking conto un check-in a medias');

\echo 'OK · guardar el check-in de Praxis: solo hoy, solo lo propio, escala del formulario, parcial y ranking sin medias (0170)'

rollback;
