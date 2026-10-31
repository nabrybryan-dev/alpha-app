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
--   6. service_role escribe, y el upsert por (person_id, revision) es idempotente: reenviar la
--      misma revisión no duplica; una revisión nueva sí es otra fila. El guion entra SIN cuenta y
--      el enlace (update por person_id) ata todas las revisiones a la cuenta que llega después.
--   7. Borrar la cuenta borra sus guiones (on delete cascade); el prospecto de otra persona queda.
--   8. Un prospecto SIN cuenta (usuario_id null, solo person_id): lo leen el coach y Manuela; ni la
--      nutricionista sin la capacidad ni un asesorado.
--
-- Bloque de UUID propio (f151…). Los person_id (…a1, …a2) imitan ids de la landing: no hay FK.
-- Termina en ROLLBACK: no deja nada detrás.

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
-- 6 · service_role escribe; upsert por (person_id, revision) idempotente; el enlace llega después
-- ════════════════════════════════════════════════════════════════════════
set role service_role;

-- La persona reserva: el guion llega SIN cuenta, atado a su person_id de la landing.
insert into public.guiones_llamada (person_id, guion, revision, dia_preferido, franja_preferida)
values ('f1510000-0000-0000-0000-0000000000a1', '{"version": "guion-llamada-v1", "apertura": "Primera"}', 1, '2026-11-05', 'tarde')
on conflict (person_id, revision) do update set guion = excluded.guion;
-- El reenvío de la misma versión (reintento de red) reescribe, no duplica.
insert into public.guiones_llamada (person_id, guion, revision)
values ('f1510000-0000-0000-0000-0000000000a1', '{"version": "guion-llamada-v1", "apertura": "Primera, reenviada"}', 1)
on conflict (person_id, revision) do update set guion = excluded.guion;
insert into public.guiones_llamada (person_id, guion, revision)
values ('f1510000-0000-0000-0000-0000000000a1', '{"version": "guion-llamada-v1", "apertura": "Segunda"}', 2)
on conflict (person_id, revision) do update set guion = excluded.guion;
-- Otro prospecto, que nunca llega a tener cuenta.
insert into public.guiones_llamada (person_id, guion, revision, dia_preferido)
values ('f1510000-0000-0000-0000-0000000000a2', '{"version": "guion-llamada-v1", "apertura": "Prospecto"}', 1, '2026-11-06');

select pruebas.afirmar(
  (select count(*) from public.guiones_llamada where person_id = 'f1510000-0000-0000-0000-0000000000a1') = 2,
  'el upsert por (person_id, revision) duplicó la revisión reenviada, o no guardó la nueva'
);
select pruebas.afirmar(
  (select guion->>'apertura' = 'Primera, reenviada' and origen = 'landing' and usuario_id is null
          and creado_en > now() - interval '1 minute'
     from public.guiones_llamada where person_id = 'f1510000-0000-0000-0000-0000000000a1' and revision = 1),
  'el reenvío no reescribió la revisión, o el origen, la marca de tiempo o la cuenta nula no quedaron por omisión'
);

-- Llega la cuenta (alta-cliente): el enlace por person_id ata TODAS las revisiones; repetirlo deja lo mismo.
update public.guiones_llamada set usuario_id = 'f1510000-0000-0000-0000-000000000001'
 where person_id = 'f1510000-0000-0000-0000-0000000000a1';
update public.guiones_llamada set usuario_id = 'f1510000-0000-0000-0000-000000000001'
 where person_id = 'f1510000-0000-0000-0000-0000000000a1';
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada where usuario_id = 'f1510000-0000-0000-0000-000000000001') = 2
  and (select count(*) from public.guiones_llamada
        where person_id = 'f1510000-0000-0000-0000-0000000000a2' and usuario_id is null) = 1,
  'el enlace no ató todas las revisiones de la persona, o tocó las de otra'
);
do $$
begin
  begin
    insert into public.guiones_llamada (person_id, guion, revision)
    values ('f1510000-0000-0000-0000-0000000000a1', '{}', 1);
    raise exception 'FALLO: se guardó dos veces la misma revisión para la misma persona';
  exception when unique_violation then null; end;
  begin
    insert into public.guiones_llamada (person_id, usuario_id, guion, revision)
    values ('f1510000-0000-0000-0000-0000000000a1', 'f1510000-0000-0000-0000-0000000000ff', '{}', 7);
    raise exception 'FALLO: se enlazó un guion a una cuenta que no existe';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.guiones_llamada (guion, revision) values ('{}', 8);
    raise exception 'FALLO: se guardó un guion sin person_id';
  exception when not_null_violation then null; end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · Manuela (leer_entrenamiento, sin puesto de coach) lee, también a quien no tiene cuenta
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f1510000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada where usuario_id = 'f1510000-0000-0000-0000-000000000001') = 2,
  'quien entra a la consola por leer_entrenamiento no lee los guiones (el fallo de la 0112)'
);
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada
    where usuario_id is null and person_id = 'f1510000-0000-0000-0000-0000000000a2') = 1,
  'Manuela no lee los guiones de quien todavía no tiene cuenta: Llamadas por hacer saldría vacío'
);

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Nadie escribe desde el navegador
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    insert into public.guiones_llamada (person_id, guion, revision)
    values ('f1510000-0000-0000-0000-0000000000a2', '{}', 9);
    raise exception 'FALLO: authenticated pudo escribir un guion';
  exception when insufficient_privilege then null; end;
  begin
    update public.guiones_llamada set usuario_id = null;
    raise exception 'FALLO: authenticated pudo des-enlazar un guion';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.guiones_llamada;
    raise exception 'FALLO: authenticated pudo borrar un guion';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · El coach lee (también prospectos) y tampoco escribe
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f1510000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada where usuario_id = 'f1510000-0000-0000-0000-000000000001') = 2,
  'el coach no lee los guiones'
);
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada where usuario_id is null) = 1,
  'el coach no lee los guiones de los prospectos sin cuenta'
);
do $$
begin
  begin
    insert into public.guiones_llamada (person_id, guion, revision)
    values ('f1510000-0000-0000-0000-0000000000a2', '{}', 9);
    raise exception 'FALLO: el coach pudo escribir un guion desde el navegador';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · 8 · Nutricionista sin la capacidad: cero filas, ni de clientes ni de prospectos
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f1510000-0000-0000-0000-000000000004');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada) = 0,
  'una nutricionista sin leer_entrenamiento lee los guiones: la puerta abrió por rol'
);
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada where usuario_id is null) = 0,
  'una nutricionista sin leer_entrenamiento lee los prospectos sin cuenta'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · 8 · La persona del guion no lo ve, ni ve los de los prospectos
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f1510000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada) = 0,
  'la persona de quien habla el guion puede leerlo, o un asesorado lee los prospectos'
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
-- 7 · Borrar la cuenta borra sus guiones; el prospecto de otra persona no se toca
-- ════════════════════════════════════════════════════════════════════════
delete from public.usuarios_app where id = 'f1510000-0000-0000-0000-000000000001';
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada where person_id = 'f1510000-0000-0000-0000-0000000000a1') = 0,
  'borrar la cuenta dejó sus guiones (con nombre y contacto) detrás'
);
select pruebas.afirmar(
  (select count(*) from public.guiones_llamada where person_id = 'f1510000-0000-0000-0000-0000000000a2') = 1,
  'borrar una cuenta se llevó el guion de otro prospecto'
);

rollback;
