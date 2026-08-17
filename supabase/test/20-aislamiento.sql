-- El aislamiento entre asesorados, comprobado contra RLS de verdad.
--
-- Es la propiedad más importante de la app y **ya se rompió dos veces**: una por
-- una política tautológica (`rol = rol`, migración 0008) y otra por mirar el rol
-- en vez de la fila. Hasta hoy solo la protegían tests en modo demo, que no
-- evalúan ni una sola política: comprobaban que el CÓDIGO filtra, no que la BASE
-- lo impida. Si alguien se salta el código —o cambia una política— el demo sigue
-- verde.
--
-- Depende de la semilla de `10-escrituras-del-asesorado.sql`.

\set ON_ERROR_STOP on

begin;

-- ─────────────── Primero: que haya algo que esconder ───────────────
-- Sin esto, el test entero podría pasar con las tablas vacías y no probaría
-- nada. Se comprueba como dueño, que no sufre RLS: las filas EXISTEN. Todo el
-- cero que venga después es cosa de las políticas, no de la falta de datos.
select pruebas.afirmar(
  (select count(*) from public.registro_comida where cliente_id = 'comida-cliente-1') = 1
  and (select count(*) from public.checkins where id = 'checkin-1') = 1,
  'la semilla de 10-escrituras no está: el aislamiento no se puede probar sobre una base vacía'
);

-- ─────────────────── B no ve lo de A ───────────────────
select pruebas.soy('22222222-2222-2222-2222-222222222222');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.registro_comida where cliente_id = 'comida-cliente-1') = 0,
  'un asesorado ve las comidas de otro'
);

select pruebas.afirmar(
  (select count(*) from public.registro_item where cliente_id = 'item-cliente-1') = 0,
  'un asesorado ve los alimentos de otro'
);

select pruebas.afirmar(
  (select count(*) from public.checkins where id = 'checkin-1') = 0,
  'un asesorado ve los check-ins de otro'
);

select pruebas.afirmar(
  (select count(*) from public.prueba_calibracion where cliente_id = 'calib-cliente-1') = 0,
  'un asesorado ve las pruebas de calibración de otro'
);

-- ─────────────────── B no puede escribir como A ───────────────────
-- Leer de menos es un fallo de privacidad; escribir en nombre de otro es peor:
-- mete datos falsos en el historial con el que se le programa.
do $$
begin
  begin
    insert into public.registro_comida
      (cliente_id, asesorado_id, momento, comida, cocinado_por_el, confianza, borrado)
    values
      ('comida-suplantada', '11111111-1111-1111-1111-111111111111', now(), 'cena', true, 'estimado', false);
    raise exception 'FALLO: un asesorado escribió una comida en nombre de otro';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- ─────────────────── B no puede ascenderse ───────────────────
-- El fallo exacto de la 0008: una política tautológica dejaba auto-promoverse a
-- coach, y con eso se veía a todo el mundo.
do $$
begin
  begin
    update public.usuarios_app
      set rol = 'coach'
      where id = '22222222-2222-2222-2222-222222222222';
    if (select rol from public.usuarios_app where id = '22222222-2222-2222-2222-222222222222') = 'coach' then
      raise exception 'FALLO: un asesorado se ascendió a coach';
    end if;
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

reset role;

-- ─────────────────── El staff sí ve ───────────────────
-- La otra mitad: si el coach NO viera, el panel de salud de datos y el de
-- adherencia estarían vacíos y nadie sabría por qué.
select pruebas.soy('33333333-3333-3333-3333-333333333333');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.registro_comida where cliente_id = 'comida-cliente-1') = 1,
  'el coach no ve el registro de sus asesorados'
);

select pruebas.afirmar(
  (select count(*) from public.checkins where id = 'checkin-1') = 1,
  'el coach no ve los check-ins de sus asesorados'
);

reset role;

commit;

\echo 'OK · el aislamiento entre asesorados aguanta'
