-- ¿Puede el asesorado escribir de verdad lo que la app le manda escribir?
--
-- Estas son las MISMAS sentencias que arma `src/data/nube/sync.ts`, incluido el
-- `on conflict (cliente_id)`. Ahí estaba el fallo que costó semanas: el índice
-- era único pero PARCIAL, PostgreSQL no puede inferirlo para un ON CONFLICT y
-- cada comida moría con 42P10, se reintentaba ocho veces y se descartaba en
-- silencio. Ningún test podía verlo porque todos corren en modo demo.
--
-- Se ejecuta como `authenticated` con un uid puesto a mano, así que las
-- políticas RLS se evalúan igual que en producción.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla mínima ───────────────────
-- Dos asesorados y un coach: hace falta la segunda persona para poder probar
-- que el aislamiento aguanta (20-aislamiento.sql).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@ejemplo.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@ejemplo.test'),
  ('33333333-3333-3333-3333-333333333333', 'coach@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('11111111-1111-1111-1111-111111111111', 'Asesorada A', 'asesorado', 'AA'),
  ('22222222-2222-2222-2222-222222222222', 'Asesorado B', 'asesorado', 'AB'),
  ('33333333-3333-3333-3333-333333333333', 'Coach', 'coach', 'CO')
on conflict (id) do nothing;

-- Un alimento, porque `registro_item.alimento_id` lo referencia. Todas las
-- columnas de abajo son obligatorias y con CHECK: `estado` existe porque 100 g
-- de arroz crudo no son 100 g de arroz cocido, y `creado_por` tiene que quedar
-- nulo cuando la confianza es 'verificado'.
insert into public.alimentos (id, nombre, grupo, estado, confianza, origen)
values ('alimento-prueba', 'Arroz de prueba', 'cereales', 'cocido', 'verificado', 'tcac')
on conflict (id) do nothing;

-- ─────────────────── Como la asesorada A ───────────────────
select pruebas.soy('11111111-1111-1111-1111-111111111111');
set role authenticated;
select pruebas.exigir_rls();

-- 1. Abrir una comida. Es el upsert que fallaba: si el índice de `cliente_id`
--    vuelve a ser parcial, esta sentencia revienta con 42P10 y el CI se cae.
insert into public.registro_comida
  (cliente_id, asesorado_id, momento, comida, cocinado_por_el, aceite_g, sal_g, confianza, borrado)
values
  ('comida-cliente-1', '11111111-1111-1111-1111-111111111111', now(), 'desayuno', true, null, null, 'estimado', false)
on conflict (cliente_id) do update set momento = excluded.momento;

select pruebas.afirmar(
  (select count(*) from public.registro_comida where cliente_id = 'comida-cliente-1') = 1,
  'la comida no se guardó'
);

-- 2. Reintentar la MISMA operación no puede duplicar. La cola reintenta hasta
--    ocho veces: sin un upsert que resuelva de verdad, un día con mala señal
--    dejaría ocho desayunos.
insert into public.registro_comida
  (cliente_id, asesorado_id, momento, comida, cocinado_por_el, aceite_g, sal_g, confianza, borrado)
values
  ('comida-cliente-1', '11111111-1111-1111-1111-111111111111', now(), 'desayuno', true, null, null, 'estimado', false)
on conflict (cliente_id) do update set momento = excluded.momento;

select pruebas.afirmar(
  (select count(*) from public.registro_comida where cliente_id = 'comida-cliente-1') = 1,
  'el reintento duplicó la comida en vez de actualizarla'
);

-- 3. Añadir un alimento. El móvil no conoce el id de la comida —lo genera el
--    servidor—, así que apunta por `comida_cliente_id` y un trigger lo traduce.
insert into public.registro_item
  (cliente_id, comida_cliente_id, alimento_id, gramos, fue_pesado, estado_asumido, borrado)
values
  ('item-cliente-1', 'comida-cliente-1', 'alimento-prueba', 100, false, 'cocido', false)
on conflict (cliente_id) do update set gramos = excluded.gramos;

select pruebas.afirmar(
  (select registro_id from public.registro_item where cliente_id = 'item-cliente-1') =
  (select id from public.registro_comida where cliente_id = 'comida-cliente-1'),
  'el trigger no ató el alimento a su comida'
);

-- 4. Un alimento que apunta a una comida inexistente tiene que ser rechazado.
--    Si pasara, quedarían alimentos huérfanos que nadie vería.
do $$
begin
  begin
    insert into public.registro_item
      (cliente_id, comida_cliente_id, alimento_id, gramos, fue_pesado, estado_asumido, borrado)
    values
      ('item-huerfano', 'comida-que-no-existe', 'alimento-prueba', 50, false, 'cocido', false);
    raise exception 'FALLO: se aceptó un alimento sin comida';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- 5. Check-in y adherencia: el resto de escrituras diarias de la app.
insert into public.checkins (id, usuario_id, fecha, datos)
values ('checkin-1', '11111111-1111-1111-1111-111111111111', current_date, '{"pesoKg": 60}'::jsonb)
on conflict (id) do update set datos = excluded.datos;

insert into public.adherencias (id, usuario_id, fecha, estado)
values ('adh-1', '11111111-1111-1111-1111-111111111111', current_date, 'si')
on conflict (id) do update set estado = excluded.estado;

select pruebas.afirmar(
  (select count(*) from public.checkins where id = 'checkin-1') = 1
  and (select count(*) from public.adherencias where id = 'adh-1') = 1,
  'el check-in o la adherencia no se guardaron'
);

-- 6. Prueba de calibración: la tercera tabla que usaba el índice parcial.
insert into public.prueba_calibracion
  (cliente_id, asesorado_id, fecha, alimento_id, gramos_estimados, gramos_reales)
values
  ('calib-cliente-1', '11111111-1111-1111-1111-111111111111', current_date, 'alimento-prueba', 90, 100)
on conflict (cliente_id) do update set gramos_reales = excluded.gramos_reales;

select pruebas.afirmar(
  (select count(*) from public.prueba_calibracion where cliente_id = 'calib-cliente-1') = 1,
  'la prueba de calibración no se guardó'
);

reset role;

commit;

\echo 'OK · las escrituras del asesorado funcionan'
