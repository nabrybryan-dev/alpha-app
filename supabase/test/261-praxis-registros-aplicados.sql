-- Praxis: el libro de lo guardado y la RPC del agua (0161). La migración está SIN APLICAR en producción; esta prueba
-- corre en el CI sobre una base vacía con todas las migraciones.
--
-- POR QUÉ EXISTE. El libro decide si una tarjeta de agua se suma una vez o dos, y guarda el `antes` con el que se
-- deshace. Se comprueba contra RLS y privilegios de verdad:
--   1. Suma en fila existente; antes/despues/delta quedan en el libro.
--   2. La MISMA tarjeta dos veces suma una sola vez (si el código sumara dos, falla).
--   3. Otra tarjeta (otro indice u otro mensaje) sí suma.
--   4. delta 0, negativo, 3001, indice fuera de rango, mensaje vacío: rechazados y sin rastro.
--   5. Total del día sobre 10000: rechazado y revierte también el libro.
--   6. Día en hora de Bogotá, no UTC.
--   7. Nadie escribe el libro directamente; cada quien lee solo el suyo; el coach suma solo en su fila.
--   8. anon no ejecuta ni lee; sin sesión la función se niega.
-- Bloque de UUID propio (f6…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('f6000000-0000-0000-0000-000000000001', 'libro-asesorada@ejemplo.test'),
  ('f6000000-0000-0000-0000-000000000002', 'libro-coach@ejemplo.test'),
  ('f6000000-0000-0000-0000-000000000003', 'libro-otra@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('f6000000-0000-0000-0000-000000000001', 'Asesorada de prueba', 'asesorado', 'AS'),
  ('f6000000-0000-0000-0000-000000000002', 'Coach de prueba', 'coach', 'CO'),
  ('f6000000-0000-0000-0000-000000000003', 'Otra de prueba', 'asesorado', 'OT')
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- La asesorada ya lleva 600 ml hoy (Bogotá); la otra persona, 500.
insert into public.hidratacion (id, usuario_id, fecha, ml) values
  ('hid-otra', 'f6000000-0000-0000-0000-000000000003', (now() at time zone 'America/Bogota')::date, 500),
  ('hid-asesorada-hoy', 'f6000000-0000-0000-0000-000000000001', (now() at time zone 'America/Bogota')::date, 600);

-- ════════════════════════════════════════════════════════════════════════
-- 1 a 6 · La asesorada
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f6000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

do $$
declare
  r jsonb;
  v int;
begin
  -- 1 · suma sobre la fila existente
  r := public.praxis_aplicar_agua('msg-1', 0, 250);
  perform pruebas.afirmar((r->>'total_ml')::int = 850 and (r->>'ya_aplicado')::boolean = false,
    'la primera tarjeta no dejo 850 (600 + 250) o dijo ya_aplicado');

  -- 2 · la misma tarjeta otra vez
  r := public.praxis_aplicar_agua('msg-1', 0, 250);
  perform pruebas.afirmar((r->>'total_ml')::int = 850 and (r->>'ya_aplicado')::boolean = true,
    'la MISMA tarjeta enviada dos veces volvio a sumar (o no dijo ya_aplicado)');
  perform pruebas.afirmar((select ml from public.hidratacion where id = 'hid-asesorada-hoy') = 850,
    'hidratacion no quedo en 850 tras enviar dos veces la misma tarjeta');
  perform pruebas.afirmar((select count(*) from public.praxis_registros_aplicados where mensaje_id = 'msg-1') = 1,
    'el libro tiene mas de una fila para una misma tarjeta');
  perform pruebas.afirmar((select (antes->>'ml')::int = 600 and (despues->>'ml')::int = 850 and (ref->>'delta_ml')::int = 250
                             from public.praxis_registros_aplicados where mensaje_id = 'msg-1'),
    'el libro no guardo antes=600, despues=850 y delta=250');

  -- 3 · otras tarjetas sí suman
  perform public.praxis_aplicar_agua('msg-1', 1, 100);
  perform public.praxis_aplicar_agua('msg-2', 0, 50);
  perform pruebas.afirmar((select ml from public.hidratacion where id = 'hid-asesorada-hoy') = 1000,
    'otra tarjeta (otro indice u otro mensaje) no sumo: esperado 850+100+50');

  -- 4 · valores inválidos
  foreach v in array array[0, -5, 3001] loop
    begin
      perform public.praxis_aplicar_agua('msg-malo-' || v, 0, v);
      raise exception 'FALLO: se acepto un delta de %', v;
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.praxis_aplicar_agua('msg-indice', 12, 100);
    raise exception 'FALLO: se acepto un indice 12';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.praxis_aplicar_agua('   ', 0, 100);
    raise exception 'FALLO: se acepto un mensaje_id vacio';
  exception when invalid_parameter_value then null; end;
  perform pruebas.afirmar((select count(*) from public.praxis_registros_aplicados
                            where mensaje_id like 'msg-malo-%' or mensaje_id in ('msg-indice', '   ')) = 0,
    'un valor rechazado dejo fila en el libro');
  perform pruebas.afirmar((select ml from public.hidratacion where id = 'hid-asesorada-hoy') = 1000,
    'un valor rechazado cambio el agua');

  -- 5 · techo del día: 1000 + 9000 = 10000 pasa; un mililitro más no, y revierte el libro
  perform public.praxis_aplicar_agua('msg-3', 0, 3000);
  perform public.praxis_aplicar_agua('msg-3', 1, 3000);
  perform public.praxis_aplicar_agua('msg-3', 2, 3000);
  begin
    perform public.praxis_aplicar_agua('msg-3', 3, 1);
    raise exception 'FALLO: el total paso de 10000 ml';
  exception when invalid_parameter_value then null; end;
  perform pruebas.afirmar((select ml from public.hidratacion where id = 'hid-asesorada-hoy') = 10000,
    'el techo no dejo el agua en 10000');
  perform pruebas.afirmar((select count(*) from public.praxis_registros_aplicados where mensaje_id = 'msg-3' and indice = 3) = 0,
    'el techo dejo la fila del libro sin su agua');

  -- 6 · el día es el de Bogotá
  perform pruebas.afirmar((select (ref->>'fecha')::date from public.praxis_registros_aplicados
                            where mensaje_id = 'msg-1' and indice = 0) = (now() at time zone 'America/Bogota')::date,
    'la fecha del libro no es la de Bogota');
end $$;

-- 7 · nadie escribe el libro directamente
do $$
begin
  begin
    insert into public.praxis_registros_aplicados (usuario_id, tipo, mensaje_id)
    values ('f6000000-0000-0000-0000-000000000001', 'agua', 'directo');
    raise exception 'FALLO: una sesion inserto directo en el libro';
  exception when insufficient_privilege then null; end;
  begin
    update public.praxis_registros_aplicados set antes = '{"ml": 0}';
    raise exception 'FALLO: una sesion actualizo el libro';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.praxis_registros_aplicados;
    raise exception 'FALLO: una sesion borro del libro';
  exception when insufficient_privilege then null; end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- Otra persona: no ve el libro ajeno; su misma clave (mensaje, indice) es suya
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('f6000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar((select count(*) from public.praxis_registros_aplicados) = 0,
  'otra persona ve el libro de la asesorada');
select pruebas.afirmar((public.praxis_aplicar_agua('msg-1', 0, 100)->>'total_ml')::int = 600,
  'la clave (msg-1, 0) de otra persona no sumo en SU fila (500 + 100) o se confundio con la de la asesorada');
select pruebas.afirmar((select count(*) from public.praxis_registros_aplicados) = 1,
  'otra persona no ve exactamente su propia fila del libro');

-- ════════════════════════════════════════════════════════════════════════
-- Coach: suma solo en su fila
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('f6000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select public.praxis_aplicar_agua('msg-c', 0, 200);
select pruebas.afirmar((select count(*) from public.praxis_registros_aplicados) = 1,
  'el coach ve libro ajeno o no ve el suyo');

reset role;
select pruebas.afirmar((select ml from public.hidratacion where usuario_id = 'f6000000-0000-0000-0000-000000000002') = 200,
  'el coach no sumo en su propia fila');
select pruebas.afirmar((select ml from public.hidratacion where id = 'hid-asesorada-hoy') = 10000
                       and (select ml from public.hidratacion where id = 'hid-otra') = 600,
  'una llamada toco la fila de otra persona');

-- ════════════════════════════════════════════════════════════════════════
-- 8 · anon y sin sesión
-- ════════════════════════════════════════════════════════════════════════
set role anon;
do $$
begin
  begin
    perform public.praxis_aplicar_agua('msg-anon', 0, 100);
    raise exception 'FALLO: anon ejecuto praxis_aplicar_agua';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.praxis_registros_aplicados;
    raise exception 'FALLO: anon leyo el libro';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
do $$
begin
  begin
    perform public.praxis_aplicar_agua('msg-sin-sesion', 0, 100);
    raise exception 'FALLO: la funcion sumo sin sesion';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

\echo 'OK · el libro de Praxis y el agua idempotente (0161)'

rollback;
