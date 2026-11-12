-- H8: el aviso por fila no debe sobrevivir al COMMIT en una conexion reutilizada.
-- Ejecutar con psql, en UNA misma conexion, como dueno y con pruebas.afirmar disponible.
-- Requiere 0147 aplicada. No envolver en otra transaccion ni usar --single-transaction.
-- Se captura el resultado antes de limpiar; el aserto de fuga va DESPUES de la limpieza.
\set ON_ERROR_STOP on

begin;
select pruebas.afirmar(
  coalesce(nullif(current_setting('alpha.choque_bloqueado', true), ''), '[]') = '[]',
  'H8-SESION: la conexion debe empezar sin ids bloqueados'
);
select pruebas.afirmar(
  not exists (select 1 from auth.users where id = 'd2830000-0000-0000-0000-000000000001')
  and not exists (select 1 from public.usuarios_app where id = 'd2830000-0000-0000-0000-000000000001')
  and not exists (select 1 from public.microciclos
    where id in ('h8-r3-sesion-existente', 'h8-r3-sesion-propuesta')),
  'H8-SESION: los ids propios deben estar libres; no borrar datos ajenos'
);
-- Canal dueno, sin uid: aislar el candado de M2/0138, igual que en 216.
select set_config('request.jwt.claim.sub', '', true);
insert into auth.users (id, email)
values ('d2830000-0000-0000-0000-000000000001', 'h8-r3-sesion@ejemplo.test');
insert into public.usuarios_app (id, nombre, rol, avatar_iniciales)
values ('d2830000-0000-0000-0000-000000000001', 'H8 R3 sesion', 'asesorado', 'H8')
on conflict (id) do nothing; -- el trigger de auth.users puede haberlo creado.
insert into public.microciclos (id, usuario_id, numero, estado, origen, datos)
values ('h8-r3-sesion-existente', 'd2830000-0000-0000-0000-000000000001',
        8, 'cerrado', 'app', '{}'::jsonb);
insert into public.microciclos (id, usuario_id, numero, estado, origen, datos)
values ('h8-r3-sesion-propuesta', 'd2830000-0000-0000-0000-000000000001',
        8, 'activo', 'cadena', '{}'::jsonb);
select pruebas.afirmar(
  (select estado = 'propuesto' from public.microciclos where id = 'h8-r3-sesion-propuesta')
  and (select count(*) = 1 from public.microciclos_choques
    where propuesta_id = 'h8-r3-sesion-propuesta'
      and existente_id = 'h8-r3-sesion-existente' and estado = 'pendiente')
  and coalesce(nullif(current_setting('alpha.choque_bloqueado', true), ''), '[]') = '[]',
  'H8-SESION: debe bloquear y registrar el aviso, consumiendo el id en local'
);
commit;

begin;
-- PRIMERA lectura de la transaccion siguiente: no resetear ni escribir antes de capturar.
select coalesce(nullif(current_setting('alpha.choque_bloqueado', true), ''), '[]') = '[]'
  as sin_fuga
\gset h8_r3_
-- Limpiar incluso con el mutante: el resultado ya quedo guardado en una variable de psql.
delete from public.microciclos_choques
 where usuario_id = 'd2830000-0000-0000-0000-000000000001';
delete from public.microciclos
 where usuario_id = 'd2830000-0000-0000-0000-000000000001';
delete from public.usuarios_app where id = 'd2830000-0000-0000-0000-000000000001';
delete from auth.users where id = 'd2830000-0000-0000-0000-000000000001';
-- Dejar tambien el canal vacio si se esta ensayando la variante false.
reset alpha.choque_bloqueado;
commit;

select pruebas.afirmar(
  not exists (select 1 from auth.users where id = 'd2830000-0000-0000-0000-000000000001')
  and not exists (select 1 from public.usuarios_app where id = 'd2830000-0000-0000-0000-000000000001')
  and not exists (select 1 from public.microciclos
    where usuario_id = 'd2830000-0000-0000-0000-000000000001'
       or id in ('h8-r3-sesion-existente', 'h8-r3-sesion-propuesta'))
  and not exists (select 1 from public.microciclos_choques
    where usuario_id = 'd2830000-0000-0000-0000-000000000001'
       or propuesta_id in ('h8-r3-sesion-existente', 'h8-r3-sesion-propuesta')),
  'H8-SESION-LIMPIEZA: no deben quedar usuarios, microciclos ni avisos propios tras COMMIT'
);
select pruebas.afirmar(:'h8_r3_sin_fuga'::boolean,
  'H8-SESION-COMMIT: ningun id bloqueado debe filtrarse a la transaccion siguiente');
\unset h8_r3_sin_fuga
\echo 'OK - H8 sesion tras COMMIT (0147); datos propios borrados'
