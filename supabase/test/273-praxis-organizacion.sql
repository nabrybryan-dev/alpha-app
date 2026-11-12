-- Praxis: organización de la app por persona (0179). Corre en el CI sobre una base vacía con todas las migraciones.
-- ESCRITA el 11-nov sin poder ejecutarse en un Postgres local: si falla en el CI, leer el fallo antes de tocar nada.
--
-- QUÉ SE COMPRUEBA (contra RLS y privilegios de verdad):
--   1. Esconder una pieza libre sube la versión y deja el cambio en el historial; esconder peso marca avisa_coach.
--   2. Rechazos: pieza fija o asignada, id inventado, repetir, pasar el tope de 6, mover el núcleo, tipo desconocido.
--   3. Choque entre aparatos: con una versión vieja no se toca nada.
--   4. «Solo lo importante» salta el tope; deshacer devuelve UN cambio cada vez; restablecer limpia y se deshace.
--   5. Nadie escribe directo en las tablas.
--   6. La otra persona no ve nada ajeno; el coach ve todo (para soporte y para el aviso de peso), sin frases.
--   7. anon y sin sesión se niegan.
-- Bloque de UUID propio (fc…). Termina en ROLLBACK.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('fc000000-0000-0000-0000-000000000001', 'org-asesorada@ejemplo.test'),
  ('fc000000-0000-0000-0000-000000000002', 'org-coach@ejemplo.test'),
  ('fc000000-0000-0000-0000-000000000003', 'org-otra@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('fc000000-0000-0000-0000-000000000001', 'Asesorada de prueba', 'asesorado', 'AS'),
  ('fc000000-0000-0000-0000-000000000002', 'Coach de prueba', 'coach', 'CO'),
  ('fc000000-0000-0000-0000-000000000003', 'Otra de prueba', 'asesorado', 'OT')
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- Las listas generadas deben traer lo que esta prueba usa (si el catálogo cambia, esta prueba se ajusta).
select pruebas.afirmar(public.praxis_organizacion_es_ocultable('progreso.medidas'), 'progreso.medidas no se puede esconder');
select pruebas.afirmar(public.praxis_organizacion_esconde_peso('progreso.medidas'), 'progreso.medidas no avisa al coach');
select pruebas.afirmar(not public.praxis_organizacion_es_ocultable('hoy.sesion'), 'la sesion asignada se puede esconder');
select pruebas.afirmar(not public.praxis_organizacion_es_ocultable('hoy.cuestionario-de-salud'), 'el cuestionario de salud (fijo) se puede esconder');
select pruebas.afirmar(not public.praxis_organizacion_es_organizable('pantalla:/'), 'Hoy (nucleo) se puede mover');
select pruebas.afirmar((select count(*) from unnest(array['hoy.cifras','hoy.carteles']) x where public.praxis_organizacion_es_ocultable(x)) = 2,
  'las tarjetas libres de Hoy de la prueba no se pueden esconder');

select pruebas.soy('fc000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

do $$
declare r jsonb; v int; libres text[];
begin
  -- 1 · Esconder
  r := public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"ocultar","pieza":"hoy.cifras"}', 0);
  perform pruebas.afirmar(r->>'resultado' = 'aplicado' and (r->>'version')::int = 1, 'esconder hoy.cifras no quedo aplicado en la version 1');
  perform pruebas.afirmar((select ocultas from public.praxis_organizacion) = array['hoy.cifras'], 'hoy.cifras no quedo escondida');
  perform pruebas.afirmar((select count(*) from public.praxis_organizacion_cambios where not avisa_coach) = 1, 'el cambio no quedo en el historial sin aviso');
  r := public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"ocultar","pieza":"progreso.medidas"}', 1);
  perform pruebas.afirmar((select count(*) from public.praxis_organizacion_cambios where avisa_coach and piezas = array['progreso.medidas']) = 1,
    'esconder las medidas no marco el aviso al coach');

  -- 2 · Rechazos (no cambian nada)
  begin perform public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"ocultar","pieza":"hoy.sesion"}'); raise exception 'FALLO: escondio lo asignado';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"ocultar","pieza":"hoy.cuestionario-de-salud"}'); raise exception 'FALLO: escondio lo fijo';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"ocultar","pieza":"no.existe"}'); raise exception 'FALLO: escondio un id inventado';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"ocultar","pieza":"hoy.cifras"}'); raise exception 'FALLO: escondio dos veces';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"mover_arriba","pieza":"pantalla:/"}'); raise exception 'FALLO: movio Hoy';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_organizacion_aplicar('{"tipo":"borrar_todo"}'); raise exception 'FALLO: tipo desconocido';
  exception when invalid_parameter_value then null; end;
  perform pruebas.afirmar((select version from public.praxis_organizacion) = 2, 'un rechazo cambio la version');

  -- 3 · Choque: con la versión vieja no se toca nada.
  r := public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"ocultar","pieza":"hoy.carteles"}', 0);
  perform pruebas.afirmar(r->>'resultado' = 'choque', 'una version vieja no dio choque');
  perform pruebas.afirmar(not ('hoy.carteles' = any((select ocultas from public.praxis_organizacion))), 'el choque cambio algo');

  -- 4 · Deshacer devuelve UN cambio cada vez
  r := public.praxis_organizacion_deshacer();
  perform pruebas.afirmar(r->>'resultado' = 'aplicado' and (select ocultas from public.praxis_organizacion) = array['hoy.cifras'], 'deshacer no devolvio las medidas');
  r := public.praxis_organizacion_deshacer();
  perform pruebas.afirmar(r->>'resultado' = 'aplicado' and cardinality((select ocultas from public.praxis_organizacion)) = 0, 'el segundo deshacer no volvio al inicio');
  r := public.praxis_organizacion_deshacer();
  perform pruebas.afirmar(r->>'resultado' = 'nada', 'deshacer sin cambios no dijo nada');

  -- Mover y fijar
  select version into v from public.praxis_organizacion;
  r := public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"mover_arriba","pieza":"hoy.cifras"}', v);
  r := public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"fijar","pieza":"hoy.cifras"}', (r->>'version')::int);
  perform pruebas.afirmar((select movidas->>'hoy.cifras' from public.praxis_organizacion) = '-1' and (select fijadas from public.praxis_organizacion) = array['hoy.cifras'],
    'mover y fijar no quedaron guardados');

  -- «Solo lo importante» con más de 6 salta el tope; el servidor lo valida pieza por pieza.
  select array_agg(x) into libres from (select x from unnest(array[
    'hoy.cifras', 'hoy.carteles', 'progreso.medidas', 'bienestar.medidas']) x) s;
  r := public.praxis_organizacion_aplicar(jsonb_build_object('tipo', 'solo_lo_importante', 'piezas', to_jsonb(libres)), null);
  perform pruebas.afirmar(r->>'resultado' = 'aplicado' and cardinality((select ocultas from public.praxis_organizacion)) = 4, 'solo lo importante no escondio las 4');
  perform pruebas.afirmar((select avisa_coach from public.praxis_organizacion_cambios order by id desc limit 1), 'solo lo importante con medidas no aviso al coach');
  begin perform public.praxis_organizacion_aplicar('{"tipo":"solo_lo_importante","piezas":["hoy.cifras","hoy.sesion"]}'); raise exception 'FALLO: solo lo importante escondio lo asignado';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"ocultar","pieza":"hoy.carteles"}'); raise exception 'FALLO: escondio de nuevo';
  exception when invalid_parameter_value then null; end;

  -- Tope de 6: con 4 escondidas entran 2 más y la séptima se rechaza.
  r := public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"ocultar","pieza":"hoy.album"}');
  r := public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"ocultar","pieza":"hoy.bloque"}');
  perform pruebas.afirmar(cardinality((select ocultas from public.praxis_organizacion)) = 6, 'no se pudo llegar a 6 escondidas');
  begin perform public.praxis_organizacion_aplicar('{"tipo":"pieza","accion":"ocultar","pieza":"contenidos.lista"}'); raise exception 'FALLO: paso el tope de 6';
  exception when invalid_parameter_value then null; end;
  r := public.praxis_organizacion_deshacer();
  r := public.praxis_organizacion_deshacer();

  -- Restablecer limpia todo y se deshace
  r := public.praxis_organizacion_aplicar('{"tipo":"restablecer"}');
  perform pruebas.afirmar(cardinality((select ocultas from public.praxis_organizacion)) = 0 and (select movidas from public.praxis_organizacion) = '{}'::jsonb, 'restablecer no limpio');
  r := public.praxis_organizacion_deshacer();
  perform pruebas.afirmar(cardinality((select ocultas from public.praxis_organizacion)) = 4, 'deshacer el restablecer no devolvio lo escondido');

  -- 5 · Nadie escribe directo
  begin insert into public.praxis_organizacion (usuario_id) values ('fc000000-0000-0000-0000-000000000003'); raise exception 'FALLO: insert directo';
  exception when insufficient_privilege then null; end;
  begin update public.praxis_organizacion set ocultas = '{}'; raise exception 'FALLO: update directo';
  exception when insufficient_privilege then null; end;
  begin delete from public.praxis_organizacion_cambios; raise exception 'FALLO: delete directo del historial';
  exception when insufficient_privilege then null; end;
end $$;

-- 6 · La otra persona no ve lo ajeno; el coach ve todo
reset role;
select pruebas.soy('fc000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar((select count(*) from public.praxis_organizacion) = 0, 'la otra ve la organizacion ajena');
select pruebas.afirmar((select count(*) from public.praxis_organizacion_cambios) = 0, 'la otra ve el historial ajeno');

reset role;
select pruebas.soy('fc000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar((select count(*) from public.praxis_organizacion) = 1, 'el coach no ve la organizacion de la asesorada');
select pruebas.afirmar((select count(*) from public.praxis_organizacion_cambios where avisa_coach) >= 2, 'el coach no ve los avisos de peso');

-- 7 · anon y sin sesión
reset role;
set role anon;
do $$
begin
  begin perform public.praxis_organizacion_aplicar('{"tipo":"restablecer"}'); raise exception 'FALLO: anon aplico';
  exception when insufficient_privilege then null; end;
  begin perform public.praxis_organizacion_deshacer(); raise exception 'FALLO: anon deshizo';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.praxis_organizacion; raise exception 'FALLO: anon leyo';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
do $$
begin
  begin perform public.praxis_organizacion_aplicar('{"tipo":"restablecer"}'); raise exception 'FALLO: sin sesion aplico';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
