-- Área administrativa (migración 0102): admin_tablero.
--
-- Lo que se prueba:
--   1. El check de capacidades acepta las anteriores MÁS `ver_administracion` y rechaza una inventada.
--   2. service_role carga; una sección desconocida, un `datos` que no es objeto o un corte repetido se rechazan.
--   3. Quien tiene la capacidad (Manuela, Bryan) lee todo; un staff sin ella y un asesorado no ven nada.
--   4. Nadie con sesión escribe (ni insert, ni update, ni delete); anon no toca nada.
--
-- Bloque de UUID propio (c2…/d2…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('c2000000-0000-0000-0000-000000000001', 'ad-asesorado@ejemplo.test'),
  ('d2000000-0000-0000-0000-000000000001', 'ad-manuela@ejemplo.test'),
  ('d2000000-0000-0000-0000-000000000002', 'ad-bryan@ejemplo.test'),
  ('d2000000-0000-0000-0000-000000000003', 'ad-otra@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('c2000000-0000-0000-0000-000000000001', 'Asesorado cualquiera', 'asesorado', 'AC'),
  ('d2000000-0000-0000-0000-000000000001', 'Manuela de prueba', 'nutricionista', 'MP'),
  ('d2000000-0000-0000-0000-000000000002', 'Bryan de prueba', 'coach', 'BP'),
  ('d2000000-0000-0000-0000-000000000003', 'Otra del equipo', 'nutricionista', 'OE')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('d2000000-0000-0000-0000-000000000001', 'ver_administracion'),
  ('d2000000-0000-0000-0000-000000000002', 'ver_administracion')
on conflict do nothing;

-- 1 · check de capacidades
do $$
begin
  begin
    insert into public.capacidades_staff (usuario_id, capacidad)
    values ('d2000000-0000-0000-0000-000000000003', 'capacidad_inventada');
    raise exception 'FALLO: el check de capacidades aceptó una capacidad inventada';
  exception when check_violation then null;
  end;
  -- las anteriores siguen valiendo
  insert into public.capacidades_staff (usuario_id, capacidad)
  values ('d2000000-0000-0000-0000-000000000003', 'organizar_plan');
end $$;
delete from public.capacidades_staff where usuario_id = 'd2000000-0000-0000-0000-000000000003';

-- 2 · carga como servidor
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.admin_tablero (seccion, corte, datos, fuente, huella) values
  ('finanzas', '2026-09-28', '{"tarjeta":{"titulo":"Finanzas","semaforo":"gris","frase":"x","cifra":"","cifra_etiqueta":""},"filas":[],"grafico":null}', 'finanzas.json', 'abc'),
  ('finanzas', '2026-09-21', '{"tarjeta":{"titulo":"Finanzas"},"filas":[]}', 'finanzas.json', 'abb'),
  ('plan', '2026-09-28', '{"tarjeta":{"titulo":"Plan"},"filas":[]}', 'PLAN-ESTRATEGICO-90-DIAS.md', 'abd');
do $$
begin
  begin
    insert into public.admin_tablero (seccion, corte, datos) values ('inventada', '2026-09-28', '{}');
    raise exception 'FALLO: aceptó una sección inventada';
  exception when check_violation then null;
  end;
  begin
    insert into public.admin_tablero (seccion, corte, datos) values ('desvios', '2026-09-28', '[1,2]');
    raise exception 'FALLO: aceptó un datos que no es un objeto';
  exception when check_violation then null;
  end;
  begin
    insert into public.admin_tablero (seccion, corte, datos) values ('plan', '2026-09-28', '{}');
    raise exception 'FALLO: aceptó dos filas de la misma sección y corte';
  exception when unique_violation then null;
  end;
end $$;
reset role;

-- 3 · lectura por rol
select pruebas.soy('d2000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar((select count(*) from public.admin_tablero) = 3, 'Manuela (con capacidad) no ve las 3 filas');
reset role;

select pruebas.soy('d2000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.afirmar((select count(*) from public.admin_tablero) = 3, 'Bryan (con capacidad) no ve las 3 filas');
reset role;

select pruebas.soy('d2000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.afirmar((select count(*) from public.admin_tablero) = 0, 'un staff sin la capacidad ve filas del tablero');
reset role;

select pruebas.soy('c2000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar((select count(*) from public.admin_tablero) = 0, 'un asesorado ve filas del tablero');
reset role;

-- 4 · nadie con sesión escribe
select pruebas.soy('d2000000-0000-0000-0000-000000000002');
set role authenticated;
do $$
begin
  begin
    insert into public.admin_tablero (seccion, corte, datos) values ('mercadeo', '2026-09-28', '{}');
    raise exception 'FALLO: Bryan insertó en admin_tablero';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.admin_tablero set fuente = 'manipulada';
    raise exception 'FALLO: Bryan actualizó admin_tablero';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.admin_tablero;
    raise exception 'FALLO: Bryan borró de admin_tablero';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- anon no toca nada
set role anon;
do $$
begin
  begin
    perform 1 from public.admin_tablero limit 1;
    raise exception 'FALLO: anon leyó admin_tablero';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
