-- 0085 · La consola lee `perfiles` y `cribado` por CAPACIDAD, y solo lee.
--
-- Lo que se comprueba contra RLS de verdad:
--   1. Staff con `leer_entrenamiento` (el equivalente de Manuela) lee la ficha y el cribado
--      de otra persona, también por la vista `cribado_vigente` (security_invoker).
--   2. Staff sin la capacidad y un asesorado cualquiera NO los leen.
--   3. Nadie escribe gracias a esto: la staff con capacidad no puede actualizar ni borrar
--      la ficha ni el cribado ajenos, ni insertar un cribado a nombre de otro.
--
-- UUID propios (88/99/aa-…) y ROLLBACK al final: no deja nada para lo que corra después.

\set ON_ERROR_STOP on

begin;

-- 88 = asesorada dueña de los datos. 99 = staff CON leer_entrenamiento. aa = staff SIN
-- capacidades. bb = OTRO asesorado (el aislamiento entre asesorados no se debe romper).
insert into auth.users (id, email) values
  ('88888888-8888-8888-8888-888888888888', 'ficha-asesorada@ejemplo.test'),
  ('99999999-9999-9999-9999-999999999999', 'ficha-staff-con-capacidad@ejemplo.test'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ficha-staff-sin-capacidad@ejemplo.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ficha-otro-asesorado@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('88888888-8888-8888-8888-888888888888', 'Asesorada de la ficha', 'asesorado', 'AF'),
  ('99999999-9999-9999-9999-999999999999', 'Staff con capacidad', 'nutricionista', 'SC'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Staff sin capacidad', 'nutricionista', 'SS'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Otro asesorado', 'asesorado', 'OA')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('99999999-9999-9999-9999-999999999999', 'leer_entrenamiento')
on conflict do nothing;

insert into public.perfiles (usuario_id, datos) values
  ('88888888-8888-8888-8888-888888888888',
   '{"usuarioId": "88888888-8888-8888-8888-888888888888", "objetivos": "prueba", "edad": 30, "medidas": []}'::jsonb)
on conflict (usuario_id) do update set datos = excluded.datos;

-- `wiki` para no tener que rellenar los doce campos que exige una fila `app`.
insert into public.cribado (usuario_id, fecha, fuente, medicacion_cronica, detalle) values
  ('88888888-8888-8888-8888-888888888888', current_date, 'wiki', 'presente', '{}'::jsonb);

-- ════════════════════════════════════════════════════════════════════════
-- 1 · Con la capacidad, se lee (control positivo)
-- ════════════════════════════════════════════════════════════════════════

select pruebas.soy('99999999-9999-9999-9999-999999999999');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.perfiles where usuario_id = '88888888-8888-8888-8888-888888888888') = 1,
  'staff CON leer_entrenamiento no ve la ficha ajena'
);
select pruebas.afirmar(
  (select count(*) from public.cribado where usuario_id = '88888888-8888-8888-8888-888888888888') = 1,
  'staff CON leer_entrenamiento no ve el cribado ajeno'
);
select pruebas.afirmar(
  (select count(*) from public.cribado_vigente where usuario_id = '88888888-8888-8888-8888-888888888888') = 1,
  'staff CON leer_entrenamiento no ve el cribado por la vista cribado_vigente'
);

-- ════════════════════════════════════════════════════════════════════════
-- 3 · …pero no escribe: sin política de escritura para staff, update/delete no tocan filas
--     e insertar un cribado ajeno se rechaza.
-- ════════════════════════════════════════════════════════════════════════

update public.perfiles set datos = datos || '{"objetivos": "pisado"}'::jsonb
 where usuario_id = '88888888-8888-8888-8888-888888888888';
delete from public.cribado where usuario_id = '88888888-8888-8888-8888-888888888888';

do $$
begin
  begin
    insert into public.cribado (usuario_id, fecha, fuente, detalle)
    values ('88888888-8888-8888-8888-888888888888', current_date, 'wiki', '{}'::jsonb);
    raise exception 'FALLO: la staff con capacidad insertó un cribado ajeno';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

reset role;

select pruebas.afirmar(
  (select datos->>'objetivos' from public.perfiles where usuario_id = '88888888-8888-8888-8888-888888888888') = 'prueba',
  'la staff con capacidad modificó la ficha ajena'
);
select pruebas.afirmar(
  (select count(*) from public.cribado where usuario_id = '88888888-8888-8888-8888-888888888888') = 1,
  'la staff con capacidad borró o añadió cribados ajenos'
);

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Sin la capacidad, no se lee: ni staff sin capacidad ni otro asesorado
-- ════════════════════════════════════════════════════════════════════════

select pruebas.soy('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.perfiles where usuario_id = '88888888-8888-8888-8888-888888888888') = 0,
  'staff SIN leer_entrenamiento ve la ficha ajena'
);
select pruebas.afirmar(
  (select count(*) from public.cribado_vigente where usuario_id = '88888888-8888-8888-8888-888888888888') = 0,
  'staff SIN leer_entrenamiento ve el cribado ajeno'
);

reset role;

select pruebas.soy('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.perfiles where usuario_id = '88888888-8888-8888-8888-888888888888') = 0,
  'un asesorado ve la ficha de otro'
);
select pruebas.afirmar(
  (select count(*) from public.cribado where usuario_id = '88888888-8888-8888-8888-888888888888') = 0,
  'un asesorado ve el cribado de otro'
);

reset role;

rollback;

\echo 'OK · la consola lee ficha y cribado por capacidad, y solo lee (0085)'
