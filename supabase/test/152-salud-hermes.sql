-- La salud de Hermes en la consola (0152).
--
-- POR QUE ESTA PRUEBA EXISTE. La tabla la escribe el vigia del minipc (service_role) y la lee el
-- puesto de coach. El riesgo: que un asesorado o anon la lea o la escriba, que quepa un texto libre
-- (una frase de una persona) o que se pueda inventar una pieza. Contra RLS de verdad:
--   1. El coach lee las filas.
--   2. Una asesorada no ve ninguna (RLS filtra) y no puede escribir.
--   3. El coach tampoco escribe: solo service_role / SQL Editor.
--   4. anon no tiene nada.
--   5. Solo caben las tres piezas y los tres estados de la lista.
--   6. La tabla no tiene columna de persona ni de texto libre.
-- Bloque de UUID propio (ac...). Termina en ROLLBACK.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('ac000000-0000-0000-0000-000000000001', 'salud-asesorada@ejemplo.test'),
  ('bc000000-0000-0000-0000-000000000001', 'salud-coach@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('ac000000-0000-0000-0000-000000000001', 'Asesorada de prueba', 'asesorado', 'AS'),
  ('bc000000-0000-0000-0000-000000000001', 'Coach de prueba', 'coach', 'CO')
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol,
  avatar_iniciales = excluded.avatar_iniciales;

-- 6 · sin dato de personas ni texto libre (solo pieza y estado son text)
select pruebas.afirmar(
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'salud_hermes'
      and data_type in ('text', 'character varying', 'jsonb', 'json')) = 2
  and not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'salud_hermes' and column_name like '%usuario%'),
  'salud_hermes tiene mas texto que pieza/estado, o una columna de persona'
);

-- Escribe el servicio (el dueno de la prueba hace de service_role)
insert into public.salud_hermes (pieza, estado, visto_en) values
  ('puerta', 'arriba', now()),
  ('hermes', 'caido', now()),
  ('custodio', 'desconocido', now());

-- 5 · listas cerradas
do $$ begin
  begin
    insert into public.salud_hermes (pieza, estado) values ('otra', 'arriba');
    raise exception 'FALLO: entro una pieza fuera de la lista';
  exception when check_violation then null; end;
  begin
    update public.salud_hermes set estado = 'me duele la rodilla' where pieza = 'puerta';
    raise exception 'FALLO: entro un estado de texto libre';
  exception when check_violation then null; end;
end $$;

-- upsert del vigia (mismo SQL que genera vigia.sql_salud_consola)
insert into public.salud_hermes (pieza, estado, visto_en) values
  ('puerta', 'caido', now()), ('hermes', 'arriba', now()), ('custodio', 'arriba', now())
on conflict (pieza) do update set estado = excluded.estado, visto_en = excluded.visto_en;
select pruebas.afirmar((select count(*) from public.salud_hermes) = 3
  and (select estado from public.salud_hermes where pieza = 'puerta') = 'caido',
  'el upsert del vigia no deja 3 filas con el estado nuevo');

-- 1 · el coach lee
select pruebas.soy('bc000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar((select count(*) from public.salud_hermes) = 3, 'el coach no ve las 3 filas');

-- 3 · el coach no escribe
do $$ begin
  begin
    update public.salud_hermes set estado = 'arriba';
    if found then raise exception 'FALLO: el coach pudo actualizar'; end if;
  exception when insufficient_privilege then null; end;
  begin
    insert into public.salud_hermes (pieza, estado) values ('puerta', 'arriba') on conflict do nothing;
    raise exception 'FALLO: el coach pudo insertar';
  exception when insufficient_privilege then null; end;
end $$;

-- 2 · la asesorada no ve nada y no escribe
reset role;
select pruebas.soy('ac000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar((select count(*) from public.salud_hermes) = 0, 'una asesorada ve la salud de Hermes');
do $$ begin
  begin
    insert into public.salud_hermes (pieza, estado) values ('puerta', 'arriba');
    raise exception 'FALLO: la asesorada pudo insertar';
  exception when insufficient_privilege then null; end;
end $$;

-- 4 · anon no tiene nada
reset role;
set role anon;
do $$ begin
  begin
    perform 1 from public.salud_hermes;
    raise exception 'FALLO: anon pudo leer';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
rollback;
