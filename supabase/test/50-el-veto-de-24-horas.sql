-- 50 · El veto de 24 horas (NNNN)
--
-- Cinco casos que no pueden quedar a medias, porque son las cinco formas
-- en que esta bandeja puede hacer daño:
--
--   1. Publica una vencida sin parada y con id_anterior correcto.
--   2. No publica si se marcó parada (estado parado).
--   3. No publica si trae_parada aunque no esté parada.
--   4. No publica si el activo actual ya no es id_anterior (marca fallido).
--   5. Repetir no duplica (idempotente).
--
-- Además, la limpieza: el microciclo publicado no puede llevar fósiles
-- (hechoEn/testPost/fecha) aunque el JSON de la bandeja los trajera.

\set ON_ERROR_STOP on
\i supabase/test/00-suplantar-supabase.sql
\i supabase/migrations/NNNN_el_veto_de_24_horas.sql

-- ── Montar usuarios y microciclos mínimos ──────────────────────────────
-- Nota: 0001 crea el trigger de usuarios_app; aquí se insertan directo.

-- Usuarios de prueba
insert into auth.users (id) values
  ('aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa1'),
  ('aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa2'),
  ('aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa3'),
  ('aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa4'),
  ('aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa5')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol) values
  ('aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa1', 'Veto Uno', 'asesorado'),
  ('aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa2', 'Veto Dos', 'asesorado'),
  ('aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa3', 'Veto Tres', 'asesorado'),
  ('aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa4', 'Veto Cuatro', 'asesorado'),
  ('aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa5', 'Veto Cinco', 'asesorado')
on conflict (id) do update set nombre = excluded.nombre;

-- Cada uno con un activo M1
insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('m-veto-1-1', 'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa1', 1, 'activo', '{"numero":1,"sesiones":[]}'::jsonb),
  ('m-veto-2-1', 'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa2', 1, 'activo', '{"numero":1,"sesiones":[]}'::jsonb),
  ('m-veto-3-1', 'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa3', 1, 'activo', '{"numero":1,"sesiones":[]}'::jsonb),
  ('m-veto-4-1', 'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa4', 1, 'activo', '{"numero":1,"sesiones":[]}'::jsonb),
  ('m-veto-5-1', 'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa5', 1, 'activo', '{"numero":1,"sesiones":[]}'::jsonb)
on conflict (id) do update set estado='activo', datos='{"numero":1,"sesiones":[]}'::jsonb;

-- ── 1 · Vencida sin parada → se publica ────────────────────────────────
insert into public.publicaciones_pendientes
  (id, usuario_id, microciclo_id, id_anterior, datos, avisos, trae_parada, creado_en, estado)
values
  ('11111111-1111-4000-8000-111111111111',
   'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa1', 'm-veto-1-2', 'm-veto-1-1',
   '{"numero":2,"sesiones":[{"id":"s1","ejercicios":[{"id":"e1","nombre":"Prensa","series":[{"reps":10}]}]}]}'::jsonb,
   '[]'::jsonb, false, now() - interval '25 hours', 'pendiente');

select public.publicar_pendientes();

do $$
declare ok boolean;
begin
  select exists(select 1 from public.microciclos where id='m-veto-1-2' and estado='activo') into ok;
  perform pruebas.afirmar(ok, '1 publica vencida: el microciclo no se publico');
  select exists(select 1 from public.microciclos where id='m-veto-1-1' and estado='cerrado') into ok;
  perform pruebas.afirmar(ok, '1 publica vencida: anterior no se cerro');
  select (estado='publicado') into ok from public.publicaciones_pendientes where id='11111111-1111-4000-8000-111111111111';
  perform pruebas.afirmar(ok, '1 publica vencida: estado no paso a publicado');
end $$;

-- ── 2 · Parada no se publica ───────────────────────────────────────────
insert into public.publicaciones_pendientes
  (id, usuario_id, microciclo_id, id_anterior, datos, avisos, trae_parada, creado_en, estado)
values
  ('22222222-2222-4000-8000-222222222222',
   'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa2', 'm-veto-2-2', 'm-veto-2-1',
   '{"numero":2,"sesiones":[]}'::jsonb, '[]'::jsonb, false, now() - interval '25 hours', 'pendiente');

-- Parar requiere es_staff(). Suplantamos a bryan (staff).
select pruebas.soy('00000000-0000-4000-8000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select public.parar_publicacion('22222222-2222-4000-8000-222222222222', 'revisar');
reset role;
select pruebas.soy('00000000-0000-0000-0000-000000000000'::uuid);

select public.publicar_pendientes();

do $$
declare ok boolean;
begin
  select not exists(select 1 from public.microciclos where id='m-veto-2-2') into ok;
  perform pruebas.afirmar(ok, '2 parada no publica: se coló');
  select (estado='parado') into ok from public.publicaciones_pendientes where id='22222222-2222-4000-8000-222222222222';
  perform pruebas.afirmar(ok, '2 parada: estado no es parado');
end $$;

-- ── 3 · trae_parada nunca publica sola ─────────────────────────────────
insert into public.publicaciones_pendientes
  (id, usuario_id, microciclo_id, id_anterior, datos, avisos, trae_parada, creado_en, estado)
values
  ('33333333-3333-4000-8000-333333333333',
   'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa3', 'm-veto-3-2', 'm-veto-3-1',
   '{"numero":2,"sesiones":[]}'::jsonb, '[]'::jsonb, true, now() - interval '48 hours', 'pendiente');

select public.publicar_pendientes();

do $$
declare ok boolean;
begin
  select not exists(select 1 from public.microciclos where id='m-veto-3-2') into ok;
  perform pruebas.afirmar(ok, '3 trae_parada: se publico sola');
  select (estado='pendiente') into ok from public.publicaciones_pendientes where id='33333333-3333-4000-8000-333333333333';
  perform pruebas.afirmar(ok, '3 trae_parada: no quedo pendiente');
end $$;

-- ── 4 · activo actual != id_anterior → fallido, no publica ─────────────
-- Veto Cuatro tiene activo m-veto-4-1, pero la bandeja dice id_anterior = otro.
insert into public.publicaciones_pendientes
  (id, usuario_id, microciclo_id, id_anterior, datos, avisos, trae_parada, creado_en, estado)
values
  ('44444444-4444-4000-8000-444444444444',
   'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa4', 'm-veto-4-2', 'm-veto-4-999',
   '{"numero":2,"sesiones":[]}'::jsonb, '[]'::jsonb, false, now() - interval '25 hours', 'pendiente');

select public.publicar_pendientes();

do $$
declare ok boolean;
begin
  select not exists(select 1 from public.microciclos where id='m-veto-4-2') into ok;
  perform pruebas.afirmar(ok, '4 activo distinto: se publico igual');
  select (estado='fallido' and motivo like '%activo distinto%') into ok from public.publicaciones_pendientes where id='44444444-4444-4000-8000-444444444444';
  perform pruebas.afirmar(ok, '4 activo distinto: no quedo fallido con motivo');
end $$;

-- ── 5 · Idempotencia: repetir no duplica ────────────────────────────────
-- La 1 ya está publicada; repetir no debe crear otro ni cambiar estado.
select public.publicar_pendientes();
select public.publicar_pendientes();

do $$
declare n int;
begin
  select count(*) into n from public.microciclos where usuario_id='aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa1' and estado='activo';
  perform pruebas.afirmar(n = 1, '5 idempotencia: duplico activo');
  perform pruebas.afirmar((select estado='publicado' from public.publicaciones_pendientes where id='11111111-1111-4000-8000-111111111111'), '5 idempotencia: estado cambio');
end $$;

-- ── 6 · Limpieza: fósiles no se heredan aunque vengan en el JSON ───────
insert into public.publicaciones_pendientes
  (id, usuario_id, microciclo_id, id_anterior, datos, avisos, trae_parada, creado_en, estado)
values
  ('55555555-5555-4000-8000-555555555555',
   'aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaa5', 'm-veto-5-2', 'm-veto-5-1',
   '{"numero":2,"sesiones":[{"id":"s1","fecha":"2026-09-01","empezadaEn":"2026-09-01T10:00:00Z","ultimaMarcaEn":"2026-09-01T10:30:00Z","testPost":{"rpeSesion":8},"preparacion":[{"id":"p1","hechoEn":"2026-09-01T10:00:00Z"}],"bloquesCardio":[{"id":"c1","hechoEn":"2026-09-01T10:05:00Z"}],"ejercicios":[{"id":"e1","nombre":"Prensa","series":[{"reps":10,"rir":2}]}]}]}'::jsonb,
   '[]'::jsonb, false, now() - interval '25 hours', 'pendiente');

select public.publicar_pendientes();

do $$
declare d jsonb;
begin
  select datos into d from public.microciclos where id='m-veto-5-2';
  perform pruebas.afirmar(
    (d->'sesiones'->0 ? 'fecha') = false and
    (d->'sesiones'->0 ? 'empezadaEn') = false and
    (d->'sesiones'->0 ? 'ultimaMarcaEn') = false and
    (d->'sesiones'->0 ? 'testPost') = false,
    '6 limpieza sesion: quedaron fecha/empezadaEn/ultimaMarcaEn/testPost'
  );
  perform pruebas.afirmar(
    (d->'sesiones'->0->'preparacion'->0 ? 'hechoEn') = false and
    (d->'sesiones'->0->'bloquesCardio'->0 ? 'hechoEn') = false,
    '6 limpieza preparacion/cardio: quedo hechoEn'
  );
  perform pruebas.afirmar(
    jsonb_array_length(coalesce(d->'sesiones'->0->'ejercicios'->0->'series','[]'::jsonb)) = 0,
    '6 limpieza series: no se reseteo a []'
  );
  perform pruebas.afirmar(
    not jsonb_exists(d, 'estado'),
    '6 limpieza estado en blob: quedo la clave'
  );
end $$;
