-- Las notas de llamada (0112 + 0113).
--
-- POR QUÉ ESTA PRUEBA EXISTE. La 0112 se aplicó a producción con las notas detrás de `es_coach()`
-- y con un comentario que afirmaba que esa puerta «ya cubre a Manuela». No la cubría: Manuela es
-- `nutricionista` sin `puesto_de_coach`, y la bitácora que se hizo para ella no la podía leer ni
-- escribir. Nadie lo vio porque el `select` bajo RLS no falla: devuelve cero filas, y la pantalla
-- decía «todavía no hay llamadas anotadas». Una sesión como la de ella contra RLS de verdad lo
-- habría mostrado en segundos; esta es esa sesión. Se comprueba:
--
--   1. Quien entra a la consola por `leer_entrenamiento` (Manuela) anota y lee, y la nota queda a
--      SU nombre, con sus tareas y su hora.
--   2. Nadie anota a nombre de otro.
--   3. Nadie corrige ni borra una nota (no hay privilegio de tabla para ello).
--   4. El coach lee lo que anotó Manuela y anota lo suyo.
--   5. La cuenta personal (asesorado con `puesto_de_coach`) también lee y anota.
--   6. Una nutricionista SIN la capacidad ni lee ni anota: la puerta es la capacidad, no el rol.
--      Es el control que distingue la 0113 de un `es_staff()`.
--   7. La asesorada de quien hablan las notas ni las lee ni puede escribirlas.
--   8. anon no tiene nada; `authenticated` solo `select` e `insert`.
--
-- Bloque de UUID propio (f113…). Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('f1130000-0000-0000-0000-000000000001', 'nl-asesorada@ejemplo.test'),
  ('f1130000-0000-0000-0000-000000000002', 'nl-coach@ejemplo.test'),
  ('f1130000-0000-0000-0000-000000000003', 'nl-staff-con-consola@ejemplo.test'),
  ('f1130000-0000-0000-0000-000000000004', 'nl-staff-sin-consola@ejemplo.test'),
  ('f1130000-0000-0000-0000-000000000005', 'nl-cuenta-personal@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('f1130000-0000-0000-0000-000000000001', 'Asesorada de las notas', 'asesorado', 'AN'),
  ('f1130000-0000-0000-0000-000000000002', 'Coach de las notas', 'coach', 'CN'),
  ('f1130000-0000-0000-0000-000000000003', 'Staff con consola', 'nutricionista', 'SC'),
  ('f1130000-0000-0000-0000-000000000004', 'Staff sin consola', 'nutricionista', 'SS'),
  ('f1130000-0000-0000-0000-000000000005', 'Cuenta personal', 'asesorado', 'CP')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- …03 es Manuela: nutricionista que entra a la consola por capacidad. …04 es el control negativo:
-- mismo rol, sin la capacidad. …05 es la cuenta personal de Bryan: asesorado con el puesto de coach.
insert into public.capacidades_staff (usuario_id, capacidad) values
  ('f1130000-0000-0000-0000-000000000003', 'leer_entrenamiento'),
  ('f1130000-0000-0000-0000-000000000005', 'puesto_de_coach')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · Quien entra a la consola por capacidad anota y lee; la base pone quién
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('f1130000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();

insert into public.notas_llamada (usuario_id, fecha, hora, conclusiones, tareas, proxima_reunion)
values ('f1130000-0000-0000-0000-000000000001', '2026-10-08', '18:30',
        'Hablamos del desayuno.', 'Tres comidas con proteína.', 'En dos semanas');

select pruebas.afirmar(
  (select count(*) from public.notas_llamada
    where usuario_id = 'f1130000-0000-0000-0000-000000000001') = 1,
  'quien entra a la consola por leer_entrenamiento no pudo anotar la llamada, o no puede leer su propia nota'
);
select pruebas.afirmar(
  (select coach_id = 'f1130000-0000-0000-0000-000000000003'
          and tareas = 'Tres comidas con proteína.'
          and hora = '18:30'::time
          and creado_en > now() - interval '1 minute'
     from public.notas_llamada where usuario_id = 'f1130000-0000-0000-0000-000000000001'),
  'la nota no quedó a nombre de quien la escribió, o perdió las tareas, la hora o la marca de tiempo'
);

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Nadie anota a nombre de otro   ·   3 · Nadie corrige ni borra
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    insert into public.notas_llamada (usuario_id, coach_id, conclusiones)
    values ('f1130000-0000-0000-0000-000000000001', 'f1130000-0000-0000-0000-000000000002', 'A nombre del coach');
    raise exception 'FALLO: se pudo anotar una llamada a nombre de otra persona';
  exception when insufficient_privilege then null; end;
  begin
    update public.notas_llamada set conclusiones = 'otra cosa';
    raise exception 'FALLO: se pudo corregir una nota ya guardada';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.notas_llamada;
    raise exception 'FALLO: se pudo borrar una nota';
  exception when insufficient_privilege then null; end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · El coach lee lo de Manuela y anota lo suyo
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('f1130000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.notas_llamada
    where usuario_id = 'f1130000-0000-0000-0000-000000000001'
      and coach_id = 'f1130000-0000-0000-0000-000000000003') = 1,
  'el coach no lee la nota que anotó la nutricionista'
);
-- Sin fecha ni hora: la fecha la pone la base, la hora queda vacía.
insert into public.notas_llamada (usuario_id, conclusiones)
values ('f1130000-0000-0000-0000-000000000001', 'Segunda llamada.');
select pruebas.afirmar(
  (select count(*) from public.notas_llamada
    where coach_id = 'f1130000-0000-0000-0000-000000000002'
      and fecha = current_date and hora is null and tareas is null) = 1,
  'el coach no pudo anotar, o la nota sin fecha/hora/tareas no quedó con sus valores por omisión'
);

-- ════════════════════════════════════════════════════════════════════════
-- 5 · La cuenta personal (asesorado con el puesto de coach) lee y anota
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('f1130000-0000-0000-0000-000000000005');
set role authenticated;
select pruebas.exigir_rls();

insert into public.notas_llamada (usuario_id, conclusiones)
values ('f1130000-0000-0000-0000-000000000001', 'Tercera llamada.');
select pruebas.afirmar(
  (select count(*) from public.notas_llamada
    where usuario_id = 'f1130000-0000-0000-0000-000000000001') = 3,
  'la cuenta personal con puesto_de_coach no pudo anotar o no lee las notas de los demás'
);

-- ════════════════════════════════════════════════════════════════════════
-- 6 · Mismo rol que Manuela, SIN la capacidad: ni lee ni anota
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('f1130000-0000-0000-0000-000000000004');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.notas_llamada) = 0,
  'una nutricionista sin acceso a la consola lee las notas: la puerta volvió a ser el rol y no la capacidad'
);
do $$
begin
  begin
    insert into public.notas_llamada (usuario_id, conclusiones)
    values ('f1130000-0000-0000-0000-000000000001', 'Sin permiso');
    raise exception 'FALLO: una nutricionista sin acceso a la consola anotó una llamada';
  exception when insufficient_privilege then null; end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 7 · La asesorada de quien hablan las notas: ni las lee ni las escribe
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.soy('f1130000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.notas_llamada) = 0,
  'una asesorada lee las notas internas que el equipo escribió sobre ella'
);
do $$
begin
  begin
    insert into public.notas_llamada (usuario_id, conclusiones)
    values ('f1130000-0000-0000-0000-000000000001', 'Me anoto yo');
    raise exception 'FALLO: una asesorada escribió en la bitácora del equipo';
  exception when insufficient_privilege then null; end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 8 · anon no tiene nada; authenticated solo lee y anota
-- ════════════════════════════════════════════════════════════════════════
reset role;
select pruebas.afirmar(
  not has_table_privilege('anon', 'public.notas_llamada', 'select')
  and not has_table_privilege('anon', 'public.notas_llamada', 'insert')
  and not has_table_privilege('anon', 'public.notas_llamada', 'update')
  and not has_table_privilege('anon', 'public.notas_llamada', 'delete')
  and not has_table_privilege('anon', 'public.notas_llamada', 'truncate'),
  'anon tiene algún privilegio sobre las notas de llamada'
);
select pruebas.afirmar(
  has_table_privilege('authenticated', 'public.notas_llamada', 'select')
  and has_table_privilege('authenticated', 'public.notas_llamada', 'insert')
  and not has_table_privilege('authenticated', 'public.notas_llamada', 'update')
  and not has_table_privilege('authenticated', 'public.notas_llamada', 'delete')
  and not has_table_privilege('authenticated', 'public.notas_llamada', 'truncate'),
  'authenticated tiene de más o de menos sobre las notas de llamada: debe ser solo select e insert'
);

rollback;
