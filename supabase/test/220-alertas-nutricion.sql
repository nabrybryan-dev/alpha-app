-- Las alertas nutricionales (0148): no se encienden sin firma de Manuela.
--
-- POR QUÉ ESTA PRUEBA EXISTE. Las dos alertas nacen APAGADAS y solo Manuela decide encenderlas, al
-- firmar la hoja. Esa regla vive en un check de la base, y una regla de la base se prueba contra la base:
--   1. No se enciende sin firmada_por ni firmada_en (cada una por separado y las dos ausentes).
--   2. No se enciende con firmada_por vacío o de solo espacios.
--   3. Control positivo: con las dos firmas SÍ se enciende (si no, los rechazos no prueban nada).
--   4. Las dos alertas existen y nacen apagadas.
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

rollback;
