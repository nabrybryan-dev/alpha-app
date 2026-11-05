-- Praxis: series y adherencia llenan el libro, y deshacer (0162). Migración SIN APLICAR en producción; esta prueba
-- corre en el CI sobre una base vacía con todas las migraciones.
--
-- QUÉ SE COMPRUEBA (contra RLS y privilegios de verdad):
--   1. Series: guarda, anota antes/despues; la MISMA tarjeta dos veces = una fila y una sola escritura.
--   2. Entradas inválidas (lista vacía, orden repetido, ejercicio inexistente, microciclo ajeno): rechazadas sin rastro.
--   3. Adherencia: hoy y ayer sí, hace 2 días y estado raro no; misma tarjeta dos veces = una fila; conserva comentario.
--   4. Deshacer: sin confirmación rechaza; revierte series y adherencia (con y sin antes); dos veces = una.
--   5. Si lo guardado cambió después, NO deshace ('cambio_despues') y no marca nada.
--   6. Solo el mismo día de Bogotá: un registro de 23:59:59 de ayer (Bogotá) se rechaza.
--   7. Ajeno rechazado (otra persona y el coach); el equipo LEE el libro pero no deshace.
--   8. anon sin acceso; sin sesión se niega; el ayudante interno no lo ejecuta nadie con sesión.
-- Bloque de UUID propio (f7…). Termina en ROLLBACK.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('f7000000-0000-0000-0000-000000000001', 'libro2-asesorada@ejemplo.test'),
  ('f7000000-0000-0000-0000-000000000002', 'libro2-coach@ejemplo.test'),
  ('f7000000-0000-0000-0000-000000000003', 'libro2-otra@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('f7000000-0000-0000-0000-000000000001', 'Asesorada de prueba', 'asesorado', 'AS'),
  ('f7000000-0000-0000-0000-000000000002', 'Coach de prueba', 'coach', 'CO'),
  ('f7000000-0000-0000-0000-000000000003', 'Otra de prueba', 'asesorado', 'OT')
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('lc-a', 'f7000000-0000-0000-0000-000000000001', 1, 'activo',
   '{"sesiones":[{"id":"s1","ejercicios":[{"id":"e1","series":[{"orden":1,"cargaKg":40},{"orden":2,"cargaKg":40}]}]}]}'::jsonb),
  ('lc-o', 'f7000000-0000-0000-0000-000000000003', 1, 'activo',
   '{"sesiones":[{"id":"s9","ejercicios":[{"id":"e9","series":[{"orden":1,"cargaKg":10}]}]}]}'::jsonb);

-- La asesorada ya tenía marcada AYER «parcial» con un comentario.
insert into public.adherencias (id, usuario_id, fecha, estado, comentario) values
  ('ad-previa', 'f7000000-0000-0000-0000-000000000001', (now() at time zone 'America/Bogota')::date - 1, 'parcial', 'nota previa');

-- ════════════════════════════════════════════════════════════════════════
-- La asesorada
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f7000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

do $$
declare
  r jsonb;
  hoy date := (now() at time zone 'America/Bogota')::date;
  nuevas jsonb := '[{"orden":1,"cargaKg":45},{"orden":2,"cargaKg":45},{"orden":3,"cargaKg":45}]';
  reg uuid;
begin
  -- 1 · series
  r := public.praxis_aplicar_series('m1', 0, 'lc-a', 'e1', nuevas);
  perform pruebas.afirmar((r->>'ya_aplicado')::boolean = false, 'la primera tarjeta de series dijo ya_aplicado');
  perform pruebas.afirmar((select datos #> '{sesiones,0,ejercicios,0,series}' from public.microciclos where id = 'lc-a') = nuevas,
    'las series no quedaron escritas en el microciclo');
  perform pruebas.afirmar((select antes #>> '{series,0,cargaKg}' = '40' and despues #>> '{series,2,cargaKg}' = '45'
                             from public.praxis_registros_aplicados where mensaje_id = 'm1' and tipo = 'series'),
    'el libro no guardo antes (40) y despues (45)');

  r := public.praxis_aplicar_series('m1', 0, 'lc-a', 'e1', '[{"orden":1,"cargaKg":99}]');
  perform pruebas.afirmar((r->>'ya_aplicado')::boolean = true, 'la MISMA tarjeta de series no dijo ya_aplicado');
  perform pruebas.afirmar((select datos #> '{sesiones,0,ejercicios,0,series}' from public.microciclos where id = 'lc-a') = nuevas,
    'la MISMA tarjeta de series volvio a escribir');
  perform pruebas.afirmar((select count(*) from public.praxis_registros_aplicados where mensaje_id = 'm1') = 1,
    'la misma tarjeta de series dejo mas de una fila en el libro');

  -- 2 · inválidos
  begin perform public.praxis_aplicar_series('m-x', 0, 'lc-a', 'e1', '[]'); raise exception 'FALLO: lista vacia';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aplicar_series('m-x', 0, 'lc-a', 'e1', '[{"orden":1},{"orden":1}]'); raise exception 'FALLO: orden repetido';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aplicar_series('m-x', 0, 'lc-a', 'e1', '{"orden":1}'); raise exception 'FALLO: no era lista';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aplicar_series('m-x', 0, 'lc-a', 'no-existe', '[{"orden":1}]'); raise exception 'FALLO: ejercicio inexistente';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aplicar_series('m-x', 0, 'lc-o', 'e9', '[{"orden":1,"cargaKg":999}]'); raise exception 'FALLO: microciclo ajeno';
  exception when insufficient_privilege then null; end;
  perform pruebas.afirmar((select count(*) from public.praxis_registros_aplicados where mensaje_id = 'm-x') = 0,
    'una entrada invalida de series dejo fila en el libro');

  -- 3 · adherencia
  r := public.praxis_aplicar_adherencia('m2', 0, hoy, 'si');
  perform pruebas.afirmar((r->>'ya_aplicado')::boolean = false
    and (select estado from public.adherencias where fecha = hoy and usuario_id = auth.uid()) = 'si',
    'la adherencia de hoy no quedo en si');
  perform pruebas.afirmar((select antes is null from public.praxis_registros_aplicados where mensaje_id = 'm2'),
    'sin fila previa, el antes debia ser nulo');
  r := public.praxis_aplicar_adherencia('m2', 0, hoy, 'no');
  perform pruebas.afirmar((r->>'ya_aplicado')::boolean = true
    and (select estado from public.adherencias where fecha = hoy and usuario_id = auth.uid()) = 'si',
    'la MISMA tarjeta de adherencia volvio a escribir');
  perform pruebas.afirmar((select count(*) from public.praxis_registros_aplicados where mensaje_id = 'm2') = 1,
    'la misma tarjeta de adherencia dejo mas de una fila');

  perform public.praxis_aplicar_adherencia('m3', 0, hoy - 1, 'no');
  perform pruebas.afirmar((select estado = 'no' and comentario = 'nota previa' from public.adherencias
                            where fecha = hoy - 1 and usuario_id = auth.uid()),
    'la adherencia de ayer no cambio el estado o piso el comentario');
  perform pruebas.afirmar((select antes->>'estado' = 'parcial' and antes->>'comentario' = 'nota previa'
                             from public.praxis_registros_aplicados where mensaje_id = 'm3'),
    'el libro no guardo el antes de la adherencia de ayer');

  begin perform public.praxis_aplicar_adherencia('m-x', 0, hoy - 2, 'si'); raise exception 'FALLO: hace 2 dias';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aplicar_adherencia('m-x', 0, hoy + 1, 'si'); raise exception 'FALLO: manana';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aplicar_adherencia('m-x', 0, hoy, 'tal'); raise exception 'FALLO: estado raro';
  exception when invalid_parameter_value then null; end;
  perform pruebas.afirmar((select count(*) from public.praxis_registros_aplicados where mensaje_id = 'm-x') = 0,
    'una adherencia invalida dejo fila en el libro');

  -- 4 · deshacer
  select id into reg from public.praxis_registros_aplicados where mensaje_id = 'm1';
  begin perform public.praxis_deshacer(reg, 'd0', false); raise exception 'FALLO: deshizo sin confirmacion';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_deshacer(reg, 'd0', null); raise exception 'FALLO: deshizo con confirmacion nula';
  exception when invalid_parameter_value then null; end;
  perform pruebas.afirmar((select deshecho_en is null from public.praxis_registros_aplicados where id = reg),
    'un deshacer rechazado marco el registro');

  r := public.praxis_deshacer(reg, 'd1', true);
  perform pruebas.afirmar((r->>'deshecho')::boolean = true, 'deshacer series no dijo deshecho');
  perform pruebas.afirmar((select datos #>> '{sesiones,0,ejercicios,0,series,0,cargaKg}' = '40'
                              and jsonb_array_length(datos #> '{sesiones,0,ejercicios,0,series}') = 2
                             from public.microciclos where id = 'lc-a'),
    'deshacer no repuso las dos series de 40 kg');
  perform pruebas.afirmar((select deshecho_en is not null and deshecho_mensaje_id = 'd1'
                             from public.praxis_registros_aplicados where id = reg),
    'no marco deshecho_en / deshecho_mensaje_id');
  r := public.praxis_deshacer(reg, 'd2', true);
  perform pruebas.afirmar((r->>'ya_deshecho')::boolean = true and (r->>'deshecho')::boolean = false,
    'deshacer dos veces no dijo ya_deshecho');
  perform pruebas.afirmar((select deshecho_mensaje_id = 'd1' from public.praxis_registros_aplicados where id = reg),
    'deshacer dos veces cambio deshecho_mensaje_id');

  -- adherencia sin antes: se borra la fila que creó Praxis
  r := public.praxis_deshacer((select id from public.praxis_registros_aplicados where mensaje_id = 'm2'), 'd3', true);
  perform pruebas.afirmar((r->>'deshecho')::boolean and not exists (select 1 from public.adherencias where fecha = hoy and usuario_id = auth.uid()),
    'deshacer una adherencia sin antes no borro la fila');
  -- adherencia con antes: se repone estado y comentario
  r := public.praxis_deshacer((select id from public.praxis_registros_aplicados where mensaje_id = 'm3'), 'd4', true);
  perform pruebas.afirmar((select estado = 'parcial' and comentario = 'nota previa' from public.adherencias
                            where fecha = hoy - 1 and usuario_id = auth.uid()),
    'deshacer una adherencia con antes no repuso parcial + comentario');

  -- 5 · cambió después: no se toca
  perform public.praxis_aplicar_series('m4', 0, 'lc-a', 'e1', '[{"orden":1,"cargaKg":50}]');
  perform public.fijar_series_ejercicio('lc-a', 'e1', '[{"orden":1,"cargaKg":55}]');   -- la app cambia después
  r := public.praxis_deshacer((select id from public.praxis_registros_aplicados where mensaje_id = 'm4'), 'd5', true);
  perform pruebas.afirmar((r->>'deshecho')::boolean = false and r->>'motivo' = 'cambio_despues', 'no avisó cambio_despues');
  perform pruebas.afirmar((select datos #>> '{sesiones,0,ejercicios,0,series,0,cargaKg}' = '55' from public.microciclos where id = 'lc-a'),
    'deshacer piso un cambio posterior');
  perform pruebas.afirmar((select deshecho_en is null from public.praxis_registros_aplicados where mensaje_id = 'm4'),
    'cambio_despues marco el registro como deshecho');
  perform public.praxis_aplicar_adherencia('m5', 0, hoy, 'parcial');
  update public.adherencias set estado = 'no' where usuario_id = auth.uid() and fecha = hoy;
  r := public.praxis_deshacer((select id from public.praxis_registros_aplicados where mensaje_id = 'm5'), 'd6', true);
  perform pruebas.afirmar(r->>'motivo' = 'cambio_despues', 'adherencia cambiada despues: no avisó cambio_despues');
end $$;

-- 6 · otro día: un registro creado a las 23:59:59 de ayer en Bogotá
reset role;
update public.praxis_registros_aplicados
   set creado_en = ((date_trunc('day', now() at time zone 'America/Bogota')) at time zone 'America/Bogota') - interval '1 second'
 where mensaje_id = 'm5';
select set_config('lc.reg_ayer', (select id::text from public.praxis_registros_aplicados where mensaje_id = 'm5'), false);
select set_config('lc.reg_ajeno', (select id::text from public.praxis_registros_aplicados where mensaje_id = 'm4'), false);

select pruebas.soy('f7000000-0000-0000-0000-000000000001');
set role authenticated;
do $$
begin
  begin
    perform public.praxis_deshacer(current_setting('lc.reg_ayer')::uuid, 'd7', true);
    raise exception 'FALLO: deshizo un registro de otro dia de Bogota';
  exception when invalid_parameter_value then
    if sqlerrm not like '%otro dia%' then raise; end if;
  end;
  perform pruebas.afirmar((select deshecho_en is null from public.praxis_registros_aplicados where id = current_setting('lc.reg_ayer')::uuid),
    'el rechazo por otro dia marco el registro');
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 7 · Ajeno: otra persona y el coach (el equipo LEE pero no deshace)
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('f7000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
do $$
begin
  perform pruebas.afirmar((select count(*) from public.praxis_registros_aplicados) = 0, 'otra persona ve el libro de la asesorada');
  begin
    perform public.praxis_deshacer(current_setting('lc.reg_ajeno')::uuid, 'dx', true);
    raise exception 'FALLO: otra persona deshizo un registro ajeno';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select pruebas.soy('f7000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
do $$
begin
  perform pruebas.afirmar(exists (select 1 from public.praxis_registros_aplicados where id = current_setting('lc.reg_ajeno')::uuid),
    'el equipo no lee el libro ajeno');
  begin
    perform public.praxis_deshacer(current_setting('lc.reg_ajeno')::uuid, 'dy', true);
    raise exception 'FALLO: el coach deshizo un registro ajeno';
  exception when insufficient_privilege then null; end;
  begin
    perform public.praxis_aplicar_series('mc', 0, 'lc-a', 'e1', '[{"orden":1,"cargaKg":1}]');
    raise exception 'FALLO: el coach guardo series en un microciclo ajeno';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select pruebas.afirmar((select deshecho_en is null from public.praxis_registros_aplicados where id = current_setting('lc.reg_ajeno')::uuid)
                       and (select datos #>> '{sesiones,0,ejercicios,0,series,0,cargaKg}' from public.microciclos where id = 'lc-a') = '55',
  'un intento ajeno cambio el registro o el microciclo');

-- ════════════════════════════════════════════════════════════════════════
-- 8 · anon y sin sesión
-- ════════════════════════════════════════════════════════════════════════
set role anon;
do $$
begin
  begin perform public.praxis_aplicar_series('a', 0, 'lc-a', 'e1', '[{"orden":1}]'); raise exception 'FALLO: anon ejecuto aplicar_series';
  exception when insufficient_privilege then null; end;
  begin perform public.praxis_aplicar_adherencia('a', 0, current_date, 'si'); raise exception 'FALLO: anon ejecuto aplicar_adherencia';
  exception when insufficient_privilege then null; end;
  begin perform public.praxis_deshacer(gen_random_uuid(), 'a', true); raise exception 'FALLO: anon ejecuto deshacer';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
do $$
begin
  begin perform public.praxis_aplicar_series('s', 0, 'lc-a', 'e1', '[{"orden":1}]'); raise exception 'FALLO: series sin sesion';
  exception when insufficient_privilege then null; end;
  begin perform public.praxis_aplicar_adherencia('s', 0, current_date, 'si'); raise exception 'FALLO: adherencia sin sesion';
  exception when insufficient_privilege then null; end;
  begin perform public.praxis_deshacer(gen_random_uuid(), 's', true); raise exception 'FALLO: deshacer sin sesion';
  exception when insufficient_privilege then null; end;
  begin perform public.praxis_series_actuales('lc-a', 'e1'); raise exception 'FALLO: el ayudante interno es ejecutable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

\echo 'OK · series y adherencia en el libro, y deshacer del mismo dia (0162)'

rollback;
