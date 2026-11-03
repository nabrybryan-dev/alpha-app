-- El trigger versionar_revision_semanal de la 0150: quién pidió la corrección y por qué subió la versión.
--
-- POR QUÉ ESTA PRUEBA EXISTE. La 0150 solo tenía un comprobar-0150.sql que mira el TEXTO de la función
-- (que mencione 'republicacion_tecnica'), no lo que HACE. El semáforo de firma por firmante depende de
-- dos columnas que solo el trigger escribe; si el trigger cambia de criterio, nada se enteraba.
-- Se prueba el comportamiento con dos coaches de prueba (Manuela y Bryan) llamando a
-- decidir_revision_semanal, que es la única vía de pedir una corrección:
--
--   a. Manuela pide corrección y luego la pide Bryan: queda a nombre de Bryan (gana el último).
--   b. Republicación técnica (versión nueva SIN corrección pendiente): motivo 'republicacion_tecnica'
--      y correccion_pedida_por nulo.
--   c. Una edición suelta que no pide corrección no cambia el solicitante (ni por otro usuario ni
--      intentando escribir la columna a mano con otro id).
--   d. Fila ya corregida que se republica: LO QUE HACE HOY (documentado, no es una decisión nueva):
--      la primera republicación convierte la corrección pendiente en motivo 'correccion' con el mismo
--      solicitante; una republicación técnica posterior CONSERVA 'correccion' y a ese solicitante
--      (la versión sube, el motivo no se vuelve 'republicacion_tecnica'). Una corrección nueva de
--      otro coach sobre esa fila la pasa a su nombre.
--
-- Bloque de UUID propio (f252…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('f2520000-0000-0000-0000-000000000001', 'rq-asesorada@ejemplo.test'),
  ('f2520000-0000-0000-0000-000000000002', 'rq-manuela@ejemplo.test'),
  ('f2520000-0000-0000-0000-000000000003', 'rq-bryan@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('f2520000-0000-0000-0000-000000000001', 'Asesorada de la revision', 'asesorado', 'AR'),
  ('f2520000-0000-0000-0000-000000000002', 'Coach Manuela de prueba', 'coach', 'CM'),
  ('f2520000-0000-0000-0000-000000000003', 'Coach Bryan de prueba', 'coach', 'CB')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- Una fila por caso (semanas distintas). Como dueño de la tabla, igual que lo hace la app al publicar.
insert into public.videos_semanales (usuario_id, semana, path, guion) values
  ('f2520000-0000-0000-0000-000000000001', '2026-01-05', 'a/v1.mp4', 'guion a'),
  ('f2520000-0000-0000-0000-000000000001', '2026-01-12', 'b/v1.mp4', 'guion b'),
  ('f2520000-0000-0000-0000-000000000001', '2026-01-19', 'c/v1.mp4', 'guion c'),
  ('f2520000-0000-0000-0000-000000000001', '2026-01-26', 'd/v1.mp4', 'guion d');

-- Control positivo: las filas entraron como versión 1, sin solicitante ni motivo.
select pruebas.afirmar(
  (select count(*) from public.videos_semanales
    where usuario_id = 'f2520000-0000-0000-0000-000000000001'
      and version = 1 and correccion_pedida_por is null and motivo_version is null) = 4,
  'las cuatro filas de prueba no entraron como version 1 sin solicitante ni motivo');

-- ════════ a · gana el último que pide ════════
select pruebas.soy('f2520000-0000-0000-0000-000000000002');
select public.decidir_revision_semanal('f2520000-0000-0000-0000-000000000001', '2026-01-05', 1, false, 'Manuela pide esto');
select pruebas.afirmar(
  (select correccion_pedida_por from public.videos_semanales
    where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-05')
    = 'f2520000-0000-0000-0000-000000000002',
  'a: tras pedirla Manuela, el solicitante no es Manuela');
select pruebas.soy('f2520000-0000-0000-0000-000000000003');
select public.decidir_revision_semanal('f2520000-0000-0000-0000-000000000001', '2026-01-05', 1, false, 'Bryan pide otra cosa');
select pruebas.afirmar(
  (select correccion_pedida_por from public.videos_semanales
    where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-05')
    = 'f2520000-0000-0000-0000-000000000003',
  'a: Manuela pidio y luego Bryan: tiene que quedar a nombre de Bryan (gana el ultimo)');

-- ════════ b · republicación técnica ════════
update public.videos_semanales set path = 'b/v2.mp4'
  where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-12';
select pruebas.afirmar(
  (select version = 2 and motivo_version = 'republicacion_tecnica' and correccion_pedida_por is null
          and correccion_solicitada is null
     from public.videos_semanales
    where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-12'),
  'b: version nueva sin correccion pendiente tiene que ser republicacion_tecnica y sin solicitante');

-- ════════ c · edición suelta ════════
select pruebas.soy('f2520000-0000-0000-0000-000000000002');
select public.decidir_revision_semanal('f2520000-0000-0000-0000-000000000001', '2026-01-19', 1, false, 'Manuela pide en c');
-- c1: otro usuario toca la fila sin pedir nada (update sin cambios de archivo)
select pruebas.soy('f2520000-0000-0000-0000-000000000003');
update public.videos_semanales set aprobado_por = aprobado_por
  where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-19';
select pruebas.afirmar(
  (select correccion_pedida_por = 'f2520000-0000-0000-0000-000000000002' and version = 1
     from public.videos_semanales
    where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-19'),
  'c1: una edicion suelta de Bryan cambio el solicitante de Manuela o la version');
-- c2: Manuela intenta escribir la columna a mano con el id de Bryan
select pruebas.soy('f2520000-0000-0000-0000-000000000002');
update public.videos_semanales set correccion_pedida_por = 'f2520000-0000-0000-0000-000000000003'
  where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-19';
select pruebas.afirmar(
  (select correccion_pedida_por = 'f2520000-0000-0000-0000-000000000002'
     from public.videos_semanales
    where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-19'),
  'c2: escribir la columna a mano con otro id tuvo efecto');
-- c3: sin correccion pendiente, una edicion suelta no inventa solicitante
update public.videos_semanales set correccion_pedida_por = 'f2520000-0000-0000-0000-000000000002'
  where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-12';
select pruebas.afirmar(
  (select correccion_pedida_por is null from public.videos_semanales
    where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-12'),
  'c3: sin correccion pendiente se pudo poner un solicitante a mano');

-- ════════ d · fila ya corregida que se republica (comportamiento de hoy) ════════
select public.decidir_revision_semanal('f2520000-0000-0000-0000-000000000001', '2026-01-26', 1, false, 'Manuela pide en d');
update public.videos_semanales set path = 'd/v2.mp4'
  where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-26';
select pruebas.afirmar(
  (select version = 2 and motivo_version = 'correccion'
          and correccion_pedida_por = 'f2520000-0000-0000-0000-000000000002'
          and correccion_solicitada is null
     from public.videos_semanales
    where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-26'),
  'd1: la republicacion que atiende una correccion pendiente debe quedar como correccion de Manuela');
update public.videos_semanales set path = 'd/v3.mp4'
  where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-26';
select pruebas.afirmar(
  (select version = 3 and motivo_version = 'correccion'
          and correccion_pedida_por = 'f2520000-0000-0000-0000-000000000002'
     from public.videos_semanales
    where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-26'),
  'd2 (hoy): una republicacion tecnica posterior conserva motivo correccion y a su solicitante');
select pruebas.soy('f2520000-0000-0000-0000-000000000003');
select public.decidir_revision_semanal('f2520000-0000-0000-0000-000000000001', '2026-01-26', 3, false, 'Bryan pide sobre la ya corregida');
select pruebas.afirmar(
  (select correccion_pedida_por = 'f2520000-0000-0000-0000-000000000003'
     from public.videos_semanales
    where usuario_id = 'f2520000-0000-0000-0000-000000000001' and semana = '2026-01-26'),
  'd3: una correccion nueva sobre una fila ya corregida tiene que pasar a nombre de quien la pide');

rollback;
