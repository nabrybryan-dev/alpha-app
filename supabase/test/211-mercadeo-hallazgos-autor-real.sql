-- Autor real de los comentarios de hallazgos (migración 0104).
--
-- Lo que se prueba:
--   1. Quien comenta con responder_mercadeo sin ser coach queda con SU nombre y SU id
--      (aunque el papel `autor` siga siendo 'manuela'): dos personas distintas, dos nombres.
--   2. El coach queda con su propio nombre.
--   3. Si el usuario no tiene nombre, se guarda el papel, nunca una cadena vacía.
--   4. La respuesta del agente (service_role) queda sin autor_nombre.
--
-- Bloque de UUID propio (a8…/b8…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('b8000000-0000-0000-0000-000000000001', 'ar-manuela@ejemplo.test'),
  ('b8000000-0000-0000-0000-000000000002', 'ar-bryan@ejemplo.test'),
  ('b8000000-0000-0000-0000-000000000003', 'ar-otra@ejemplo.test'),
  ('b8000000-0000-0000-0000-000000000004', 'ar-sinnombre@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('b8000000-0000-0000-0000-000000000001', 'Manuela de prueba', 'nutricionista', 'MP'),
  ('b8000000-0000-0000-0000-000000000002', 'Bryan de prueba', 'coach', 'BP'),
  ('b8000000-0000-0000-0000-000000000003', 'Otra del equipo', 'nutricionista', 'OE'),
  ('b8000000-0000-0000-0000-000000000004', '', 'nutricionista', 'SN')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('b8000000-0000-0000-0000-000000000001', 'responder_mercadeo'),
  ('b8000000-0000-0000-0000-000000000003', 'responder_mercadeo'),
  ('b8000000-0000-0000-0000-000000000004', 'responder_mercadeo')
on conflict do nothing;

select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.mercadeo_hallazgos (id, codigo, tipo, titulo, resumen) values
  ('a8111111-0000-0000-0000-000000000001', 'H-81', 'hook', 'Hook para el autor real',
   'Hallazgo de prueba para comprobar quién firma cada comentario.');
reset role;

-- 1 · Dos personas con la capacidad, dos nombres
select pruebas.soy('b8000000-0000-0000-0000-000000000001');
set role authenticated;
select public.comentar_hallazgo_mercadeo('a8111111-0000-0000-0000-000000000001', 'Comentario de Manuela');
reset role;

select pruebas.soy('b8000000-0000-0000-0000-000000000003');
set role authenticated;
select public.comentar_hallazgo_mercadeo('a8111111-0000-0000-0000-000000000001', 'Comentario de otra persona del equipo');
reset role;

select pruebas.afirmar(
  (select autor_nombre = 'Manuela de prueba' and autor_id = 'b8000000-0000-0000-0000-000000000001'
     from public.mercadeo_hallazgo_comentarios where texto = 'Comentario de Manuela'),
  'el comentario de Manuela no guardó su nombre real');
select pruebas.afirmar(
  (select autor_nombre = 'Otra del equipo' and autor_id = 'b8000000-0000-0000-0000-000000000003'
     from public.mercadeo_hallazgo_comentarios where texto = 'Comentario de otra persona del equipo'),
  'quien comenta con responder_mercadeo sin ser Manuela no quedó con su propio nombre');

-- 2 · El coach
select pruebas.soy('b8000000-0000-0000-0000-000000000002');
set role authenticated;
select public.comentar_hallazgo_mercadeo('a8111111-0000-0000-0000-000000000001', 'Comentario de Bryan');
reset role;
select pruebas.afirmar(
  (select autor = 'bryan' and autor_nombre = 'Bryan de prueba'
     from public.mercadeo_hallazgo_comentarios where texto = 'Comentario de Bryan'),
  'el coach no quedó con su nombre');

-- 3 · Sin nombre: el papel, no una cadena vacía
select pruebas.soy('b8000000-0000-0000-0000-000000000004');
set role authenticated;
select public.comentar_hallazgo_mercadeo('a8111111-0000-0000-0000-000000000001', 'Comentario sin nombre');
reset role;
select pruebas.afirmar(
  (select autor_nombre = 'Equipo de mercadeo' from public.mercadeo_hallazgo_comentarios where texto = 'Comentario sin nombre'),
  'sin nombre de staff no se guardó el papel');

-- 4 · El agente no lleva nombre de staff
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.mercadeo_hallazgo_comentarios (hallazgo_id, autor, autor_id, texto, en_respuesta_a)
select hallazgo_id, 'agente', null, 'Respuesta del agente', id
  from public.mercadeo_hallazgo_comentarios where texto = 'Comentario de Manuela';
reset role;
select pruebas.afirmar(
  (select autor_nombre is null from public.mercadeo_hallazgo_comentarios where texto = 'Respuesta del agente'),
  'la respuesta del agente quedó con un nombre de staff');

rollback;
