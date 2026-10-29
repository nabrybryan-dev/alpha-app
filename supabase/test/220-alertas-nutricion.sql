-- Las alertas nutricionales (0148): no se encienden sin firma de Manuela.
--
-- POR QUÉ ESTA PRUEBA EXISTE. Las dos alertas nacen APAGADAS y solo Manuela decide encenderlas, al
-- firmar la hoja. Esa regla vive en un check de la base, y una regla de la base se prueba contra la base:
--   1. No se enciende sin firmada_por ni firmada_en (cada una por separado y las dos ausentes).
--   2. No se enciende con firmada_por vacío o de solo espacios.
--   3. Control positivo: con las dos firmas SÍ se enciende (si no, los rechazos no prueban nada).
--   4. Las dos alertas existen y nacen apagadas.
--   5. El detalle (alertas_nutricion y los ajustes) lo lee la nutricionista y NO un coach (Bryan, 29-oct).
--
-- Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

select pruebas.afirmar(
  (select count(*) from public.alertas_nutricion_ajustes where not encendida) = 2
  and (select count(*) from public.alertas_nutricion_ajustes) = 2,
  'las dos alertas deben existir y nacer apagadas'
);

do $$
begin
  begin
    update public.alertas_nutricion_ajustes set encendida = true where clave = 'hambre_sostenida';
    raise exception 'FALLO: la base dejó encender una alerta sin firma';
  exception when check_violation then null; end;
  begin
    update public.alertas_nutricion_ajustes set encendida = true, firmada_por = 'Manuela' where clave = 'hambre_sostenida';
    raise exception 'FALLO: la base dejó encender una alerta sin firmada_en';
  exception when check_violation then null; end;
  begin
    update public.alertas_nutricion_ajustes set encendida = true, firmada_en = now() where clave = 'hambre_sostenida';
    raise exception 'FALLO: la base dejó encender una alerta sin firmada_por';
  exception when check_violation then null; end;
  begin
    update public.alertas_nutricion_ajustes set encendida = true, firmada_por = '', firmada_en = now() where clave = 'hambre_sostenida';
    raise exception 'FALLO: la base dejó encender una alerta con firmada_por vacío';
  exception when check_violation then null; end;
  begin
    update public.alertas_nutricion_ajustes set encendida = true, firmada_por = '   ', firmada_en = now() where clave = 'objetivo_insuficiente';
    raise exception 'FALLO: la base dejó encender una alerta con firmada_por de solo espacios';
  exception when check_violation then null; end;
  -- Control positivo.
  update public.alertas_nutricion_ajustes set encendida = true, firmada_por = 'Manuela', firmada_en = now() where clave = 'hambre_sostenida';
end $$;

select pruebas.afirmar(
  (select encendida from public.alertas_nutricion_ajustes where clave = 'hambre_sostenida'),
  'con las dos firmas la alerta debía poder encenderse'
);

-- 5 · Lectura: solo la nutricionista. Se siembra como dueño; después cada sesión corre como authenticated.
reset role;
insert into auth.users (id, email) values
  ('f2200000-0000-0000-0000-000000000001', 'an-asesorada@ejemplo.test'),
  ('f2200000-0000-0000-0000-000000000002', 'an-coach@ejemplo.test'),
  ('f2200000-0000-0000-0000-000000000003', 'an-nutricionista@ejemplo.test')
on conflict (id) do nothing;
insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('f2200000-0000-0000-0000-000000000001', 'Asesorada de las alertas', 'asesorado', 'AA'),
  ('f2200000-0000-0000-0000-000000000002', 'Coach de las alertas', 'coach', 'CA'),
  ('f2200000-0000-0000-0000-000000000003', 'Nutricionista de las alertas', 'nutricionista', 'NA')
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;
insert into public.alertas_nutricion (asesorado_id, clave, detalle)
values ('f2200000-0000-0000-0000-000000000001', 'hambre_sostenida', 'detalle de prueba');

select pruebas.soy('f2200000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.alertas_nutricion) = 1 and (select count(*) from public.alertas_nutricion_ajustes) = 2,
  'la nutricionista debía leer la alerta y los dos ajustes'
);

reset role;
select pruebas.soy('f2200000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.alertas_nutricion) = 0 and (select count(*) from public.alertas_nutricion_ajustes) = 0,
  'un coach NO debía leer las alertas ni sus ajustes'
);

reset role;
rollback;
