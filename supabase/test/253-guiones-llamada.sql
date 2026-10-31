-- Los guiones de llamada (0151).
--
-- Se comprueba, con sesiones de verdad contra RLS:
--   1. Quien entra a la consola por `leer_entrenamiento` (Manuela: nutricionista sin
--      `puesto_de_coach`) LEE el guion. Es el fallo que tuvo la 0112: con `es_coach()` a secas
--      leería cero filas sin error.
--   2. El coach lee.
--   3. Una nutricionista SIN la capacidad no lee: la puerta es la capacidad, no el rol (lo que
--      distingue esta política de un `es_staff()`).
--   4. La persona de quien habla el guion no lo ve.
--   5. Nadie escribe desde el navegador: insert/update/delete de authenticated fallan (también el
--      coach); anon no tiene nada.
--   6. service_role escribe, y el upsert por (usuario_id, revision) es idempotente: reenviar la
--      misma revisión no duplica; una revisión nueva sí es otra fila.
--   7. Borrar a la persona borra sus guiones.
--
-- Bloque de UUID propio (f151…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('f1510000-0000-0000-0000-000000000001', 'gl-asesorada@ejemplo.test'),
  ('f1510000-0000-0000-0000-000000000002', 'gl-coach@ejemplo.test'),
  ('f1510000-0000-0000-0000-000000000003', 'gl-staff-con-consola@ejemplo.test'),
  ('f1510000-0000-0000-0000-000000000004', 'gl-staff-sin-consola@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('f1510000-0000-0000-0000-000000000001', 'Asesorada del guion', 'asesorado', 'AG'),
  ('f1510000-0000-0000-0000-000000000002', 'Coach del guion', 'coach', 'CG'),
  ('f1510000-0000-0000-0000-000000000003', 'Staff con consola', 'nutricionista', 'SC'),
  ('f1510000-0000-0000-0000-000000000004', 'Staff sin consola', 'nutricionista', 'SS')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('f1510000-0000-0000-0000-000000000003', 'leer_entrenamiento')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 6 · service_role escribe; el upsert por (usuario_id, revision) es idempotente
-- ════════════════════════════════════════════════════════════════════════
set role service_role;

insert into public.guiones_llamada (usuario_id, guion, revision, dia_preferido, franja_preferida)
values ('f1510000-0000-0000-0000-000000000001', '{"version": "guion-llamada-v1", "apertura": "Primera"}', 1, '2026-11-05', 'tarde')
on conflict (usuario_id, revision) do update set guion = excluded.guion;
-- El reenvío de la misma versión (reintento de red) reescribe, no duplica.
insert into public.guiones_llamada (usuario_id, guion, revision)
values ('f1510000-0000-0000-0000-000000000001', '{"version": "guion-llamada-v1", "apertura": "Primera, reenviada"}', 1)
on conflict (usuario_id, revision) do update set guion = excluded.guion;
insert into public.guiones_llamada (usuario_id, guion, revision)
values ('f1510000-0000-0000-0000-000000000001', '{"version": "guion-llamada-v1", "apertura": "Segunda"}', 2)
on conflict (usuario_id, revision) do update set guion = excluded.guion;

select pruebas.afirmar(
  (select count(*) from public.guiones_llamada where usuario_id = 'f1510000-0000-0000-0000-000000000001') = 2,
  'el upsert por (usuario_id, revision) duplicó la revisión reenviada, o no guardó la nueva'
);
select pruebas.afirmar(
  (select guion->>'apertura' = 'Primera, reenviada' and origen = 'landing' and creado_en > now() - interval '1 minute'
     from public.guiones_llamada where usuario_id = 'f1510000-0000-0000-0000-000000000001' and revision = 1),
  'el reenvío no reescribió la revisión, o el origen y la marca de tiempo no quedaron por omisión'
);
do $$
begin
  begin
    insert into public.guiones_llamada (usuario_id, guion, revision)
    values ('f1510000-0000-0000-0000-000000000001', '{}', 1);
    raise exception 'FALLO: se guardó dos veces la misma revisión para la misma persona';
  exception when unique_violation then null; end;
  begin
    insert into public.guiones_llamada (usuario_id, guion, revision)
    values ('f1510000-0000-0000-0000-0000000000ff', '{}', 1);
    raise exception 'FALLO: se guardó un guion para una persona que no existe';
  exception when foreign_key_violation then null; end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · Manuela (leer_entrenamiento, sin puesto de coach) lee
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f1510000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada where usuario_id = 'f1510000-0000-0000-0000-000000000001') = 2,
  'quien entra a la consola por leer_entrenamiento no lee los guiones (el fallo de la 0112)'
);

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Nadie escribe desde el navegador
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    insert into public.guiones_llamada (usuario_id, guion, revision)
    values ('f1510000-0000-0000-0000-000000000001', '{}', 9);
    raise exception 'FALLO: authenticated pudo escribir un guion';
  exception when insufficient_privilege then null; end;
  begin
    update public.guiones_llamada set guion = '{}';
    raise exception 'FALLO: authenticated pudo corregir un guion';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.guiones_llamada;
    raise exception 'FALLO: authenticated pudo borrar un guion';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · El coach lee (y tampoco escribe)
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f1510000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada where usuario_id = 'f1510000-0000-0000-0000-000000000001') = 2,
  'el coach no lee los guiones'
);
do $$
begin
  begin
    insert into public.guiones_llamada (usuario_id, guion, revision)
    values ('f1510000-0000-0000-0000-000000000001', '{}', 9);
    raise exception 'FALLO: el coach pudo escribir un guion desde el navegador';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Nutricionista sin la capacidad: cero filas
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f1510000-0000-0000-0000-000000000004');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada) = 0,
  'una nutricionista sin leer_entrenamiento lee los guiones: la puerta abrió por rol'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · La persona del guion no lo ve
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f1510000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada) = 0,
  'la persona de quien habla el guion puede leerlo'
);
reset role;

-- anon: ni privilegio de tabla.
select pruebas.afirmar(
  not has_table_privilege('anon', 'public.guiones_llamada', 'select, insert, update, delete, truncate'),
  'anon tiene algún privilegio sobre guiones_llamada'
);
select pruebas.afirmar(
  not has_table_privilege('authenticated', 'public.guiones_llamada', 'insert, update, delete, truncate'),
  'authenticated tiene algún privilegio de escritura sobre guiones_llamada'
);

-- ════════════════════════════════════════════════════════════════════════
-- 7 · Borrar a la persona borra sus guiones
-- ════════════════════════════════════════════════════════════════════════
delete from public.usuarios_app where id = 'f1510000-0000-0000-0000-000000000001';
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada where usuario_id = 'f1510000-0000-0000-0000-000000000001') = 0,
  'borrar a la persona dejó sus guiones huérfanos'
);

rollback;
