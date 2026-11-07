-- Praxis: deshacer el AGUA (0163). Migración SIN APLICAR en producción; esta prueba corre en el CI sobre una base
-- vacía con todas las migraciones.
--
-- QUÉ SE COMPRUEBA (contra RLS y privilegios de verdad):
--   1. Agua propia del día con fila previa: vuelve al `antes`; marca deshecho_en y deshecho_mensaje_id.
--   2. Agua que creó la fila (antes nulo): el día queda en 0 y la fila sigue ahí.
--   3. Dos veces = una (ya_deshecho, sin segunda escritura).
--   4. Sin confirmación rechaza. Cambió el total después -> 'cambio_despues', sin tocar nada ni marcar.
--   5. De otro día de Bogotá (23:59:59 de ayer) rechazada.
--   6. Ajena rechazada (otra persona y el coach).
--   7. Series y adherencia siguen deshaciéndose igual que en la 0162; el tope de 10000 mL sigue en pie.
--   8. anon y sin sesión se niegan.
-- Bloque de UUID propio (f8…). Termina en ROLLBACK.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('f8000000-0000-0000-0000-000000000001', 'agua-deshacer-asesorada@ejemplo.test'),
  ('f8000000-0000-0000-0000-000000000002', 'agua-deshacer-coach@ejemplo.test'),
  ('f8000000-0000-0000-0000-000000000003', 'agua-deshacer-otra@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('f8000000-0000-0000-0000-000000000001', 'Asesorada de prueba', 'asesorado', 'AS'),
  ('f8000000-0000-0000-0000-000000000002', 'Coach de prueba', 'coach', 'CO'),
  ('f8000000-0000-0000-0000-000000000003', 'Otra de prueba', 'asesorado', 'OT')
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('ad-a', 'f8000000-0000-0000-0000-000000000001', 1, 'activo',
   '{"sesiones":[{"id":"s1","ejercicios":[{"id":"e1","series":[{"orden":1,"cargaKg":40},{"orden":2,"cargaKg":40}]}]}]}'::jsonb);

-- La asesorada tiene 500 mL de AYER (otro día de Bogotá); no debe afectar el agua de hoy.
insert into public.hidratacion (id, usuario_id, fecha, ml) values
  ('hid-previa-ayer', 'f8000000-0000-0000-0000-000000000001', (now() at time zone 'America/Bogota')::date - 1, 500);

select pruebas.soy('f8000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

do $$
declare
  r jsonb;
  hoy date := (now() at time zone 'America/Bogota')::date;
  reg uuid;
begin
  -- Hoy: la primera tarjeta crea la fila (antes nulo); la segunda suma sobre 250 (antes 250).
  perform public.praxis_aplicar_agua('w1', 0, 250);
  perform public.praxis_aplicar_agua('w2', 0, 600);
  perform pruebas.afirmar((select ml from public.hidratacion where fecha = hoy and usuario_id = auth.uid()) = 850, 'el agua de hoy no quedo en 850');
  perform pruebas.afirmar((select antes is null from public.praxis_registros_aplicados where mensaje_id = 'w1'), 'w1 debia tener antes nulo');
  perform pruebas.afirmar((select antes->>'ml' = '250' and despues->>'ml' = '850' from public.praxis_registros_aplicados where mensaje_id = 'w2'),
    'w2 debia ser 250 -> 850');

  -- Sin confirmar
  select id into reg from public.praxis_registros_aplicados where mensaje_id = 'w2';
  begin perform public.praxis_deshacer(reg, 'dw0', false); raise exception 'FALLO: deshizo agua sin confirmacion';
  exception when invalid_parameter_value then null; end;
  perform pruebas.afirmar((select ml from public.hidratacion where fecha = hoy and usuario_id = auth.uid()) = 850
                          and (select deshecho_en is null from public.praxis_registros_aplicados where id = reg),
    'un rechazo sin confirmacion cambio el agua o marco el registro');

  -- 4 · cambio_despues: w1 ya no es la ultima (w2 sumo despues): el total (850) no es su despues (250)
  r := public.praxis_deshacer((select id from public.praxis_registros_aplicados where mensaje_id = 'w1'), 'dw1', true);
  perform pruebas.afirmar((r->>'deshecho')::boolean = false and r->>'motivo' = 'cambio_despues', 'w1 con w2 encima no avisó cambio_despues');
  perform pruebas.afirmar((select ml from public.hidratacion where fecha = hoy and usuario_id = auth.uid()) = 850
                          and (select deshecho_en is null from public.praxis_registros_aplicados where mensaje_id = 'w1'),
    'cambio_despues toco el agua o marco el registro');

  -- 1 · deshacer w2 (con antes): vuelve a 250
  r := public.praxis_deshacer(reg, 'dw2', true);
  perform pruebas.afirmar((r->>'deshecho')::boolean = true and r->>'tipo' = 'agua', 'deshacer agua no dijo deshecho');
  perform pruebas.afirmar((select ml from public.hidratacion where fecha = hoy and usuario_id = auth.uid()) = 250, 'el agua no volvio a 250');
  -- La app fija su total local con esto: si no, al sumar agua después subiría el total viejo y el agua deshecha «reviviría».
  perform pruebas.afirmar((r->>'total_ml')::int = 250 and r->>'fecha' = hoy::text, 'deshacer agua no devolvio el total y la fecha que quedaron');
  perform pruebas.afirmar((select deshecho_en is not null and deshecho_mensaje_id = 'dw2' from public.praxis_registros_aplicados where id = reg),
    'no marco deshecho_en / deshecho_mensaje_id');

  -- 3 · dos veces = una
  r := public.praxis_deshacer(reg, 'dw3', true);
  perform pruebas.afirmar((r->>'ya_deshecho')::boolean = true and (r->>'deshecho')::boolean = false, 'deshacer agua dos veces no dijo ya_deshecho');
  perform pruebas.afirmar((select ml from public.hidratacion where fecha = hoy and usuario_id = auth.uid()) = 250
                          and (select deshecho_mensaje_id = 'dw2' from public.praxis_registros_aplicados where id = reg),
    'deshacer dos veces volvio a escribir o cambio deshecho_mensaje_id');

  -- 2 · ahora w1 (antes nulo) es la ultima: el dia queda en 0 y la fila sigue
  r := public.praxis_deshacer((select id from public.praxis_registros_aplicados where mensaje_id = 'w1'), 'dw4', true);
  perform pruebas.afirmar((r->>'deshecho')::boolean = true and (r->>'total_ml')::int = 0, 'deshacer el agua sin antes no dijo deshecho con total 0');
  perform pruebas.afirmar((select ml from public.hidratacion where fecha = hoy and usuario_id = auth.uid()) = 0,
    'el dia no quedo en 0 o la fila desaparecio');

  -- 7 · series y adherencia siguen igual (0162)
  perform public.praxis_aplicar_series('s1', 0, 'ad-a', 'e1', '[{"orden":1,"cargaKg":45}]');
  r := public.praxis_deshacer((select id from public.praxis_registros_aplicados where mensaje_id = 's1'), 'ds1', true);
  perform pruebas.afirmar((r->>'deshecho')::boolean and r->>'tipo' = 'series'
    and jsonb_array_length((select datos #> '{sesiones,0,ejercicios,0,series}' from public.microciclos where id = 'ad-a')) = 2,
    'deshacer series dejo de funcionar');
  perform public.praxis_aplicar_adherencia('a1', 0, hoy, 'si');
  r := public.praxis_deshacer((select id from public.praxis_registros_aplicados where mensaje_id = 'a1'), 'da1', true);
  perform pruebas.afirmar((r->>'deshecho')::boolean and r->>'tipo' = 'adherencia'
    and not exists (select 1 from public.adherencias where fecha = hoy and usuario_id = auth.uid()),
    'deshacer adherencia dejo de funcionar');

  -- El techo de 10000 mL sigue en pie: la tarjeta que lo pasa no deja rastro
  perform public.praxis_aplicar_agua('w3', 0, 3000);
  perform public.praxis_aplicar_agua('w3', 1, 3000);
  perform public.praxis_aplicar_agua('w3', 2, 3000);
  begin perform public.praxis_aplicar_agua('w3', 3, 2000); raise exception 'FALLO: paso de 10000';
  exception when invalid_parameter_value then null; end;
  perform pruebas.afirmar((select ml from public.hidratacion where fecha = hoy and usuario_id = auth.uid()) = 9000,
    'el tope de 10000 dejo agua de mas');
end $$;

-- 5 · otro día: un registro de la asesorada creado a las 23:59:59 de ayer (Bogotá)
reset role;
update public.praxis_registros_aplicados
   set creado_en = ((date_trunc('day', now() at time zone 'America/Bogota')) at time zone 'America/Bogota') - interval '1 second'
 where mensaje_id = 'w3' and indice = 0;
select set_config('ad.reg_ayer', (select id::text from public.praxis_registros_aplicados where mensaje_id = 'w3' and indice = 0), false);
select set_config('ad.reg_ajeno', (select id::text from public.praxis_registros_aplicados where mensaje_id = 'w3' and indice = 2), false);

select pruebas.soy('f8000000-0000-0000-0000-000000000001');
set role authenticated;
do $$
begin
  begin
    perform public.praxis_deshacer(current_setting('ad.reg_ayer')::uuid, 'dw5', true);
    raise exception 'FALLO: deshizo agua de otro dia de Bogota';
  exception when invalid_parameter_value then
    if sqlerrm not like '%otro dia%' then raise; end if;
  end;
  perform pruebas.afirmar((select deshecho_en is null from public.praxis_registros_aplicados where id = current_setting('ad.reg_ayer')::uuid)
                          and (select ml from public.hidratacion where usuario_id = auth.uid() and fecha = (now() at time zone 'America/Bogota')::date) = 9000,
    'el rechazo por otro dia marco el registro o cambio el agua');
end $$;

-- 6 · Ajena: otra persona y el coach no deshacen el agua de la asesorada
reset role;
select pruebas.soy('f8000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
do $$
begin
  begin
    perform public.praxis_deshacer(current_setting('ad.reg_ajeno')::uuid, 'dx', true);
    raise exception 'FALLO: otra persona deshizo agua ajena';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select pruebas.soy('f8000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
do $$
begin
  begin
    perform public.praxis_deshacer(current_setting('ad.reg_ajeno')::uuid, 'dy', true);
    raise exception 'FALLO: el coach deshizo agua ajena';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select pruebas.afirmar((select deshecho_en is null from public.praxis_registros_aplicados where id = current_setting('ad.reg_ajeno')::uuid)
                       and (select ml from public.hidratacion where usuario_id = 'f8000000-0000-0000-0000-000000000001'
                              and fecha = (now() at time zone 'America/Bogota')::date) = 9000,
  'un intento ajeno cambio el registro o el agua');

-- 8 · anon y sin sesión
set role anon;
do $$
begin
  begin perform public.praxis_deshacer(current_setting('ad.reg_ajeno')::uuid, 'a', true); raise exception 'FALLO: anon ejecuto deshacer';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
do $$
begin
  begin perform public.praxis_deshacer(current_setting('ad.reg_ajeno')::uuid, 's', true); raise exception 'FALLO: deshacer agua sin sesion';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

\echo 'OK · deshacer el agua: propia del dia, ajena y de otro dia rechazadas, cambio_despues, dos veces = una (0163)'

rollback;
