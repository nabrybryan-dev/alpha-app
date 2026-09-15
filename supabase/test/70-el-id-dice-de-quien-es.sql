-- ¿El id de un microciclo nuevo dice de quién es, y los viejos se siguen registrando?
--
-- POR QUÉ ESTA PRUEBA EXISTE. La 0081 pone un trigger BEFORE INSERT en `microciclos` que
-- exige `id = 'm-' || usuarios_app.slug || '-' || numero`. Tiene dos maneras de romper la app
-- sin que nadie lo vea, y las dos se prueban aquí:
--   · dejar pasar un id mal formado (el `-prop` de la app vieja, un slug ajeno) — entonces la
--     regla no es una regla;
--   · parar lo que NO es un microciclo nuevo: registrar una serie (`fijar_series_ejercicio`,
--     un UPDATE) o volver a subir uno viejo (`subirMicrociclo`, un upsert). Un CHECK ... NOT
--     VALID habría roto el registro de series de los 170 ids que ya existen.
-- Y la plantilla de carga (`plantilla-carga-microciclo.sql`), que desde la 0081 lee el slug
-- de la base en vez de recibirlo.
--
-- Uuids propios (a1a1a1a1-0081-…) para no chocar con las otras pruebas. Nombres ficticios.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
-- Con el nombre en los metadatos: el trigger de la 0001 crea la fila y el de la 0081 le da
-- slug desde ese nombre. Así se prueba también la alta, no solo el relleno.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1a1a1a1-0081-4000-8000-000000000001', 'slug-a@ejemplo.test', '{"nombre": "Íñigo Ñúñez Prueba"}'),
  ('a1a1a1a1-0081-4000-8000-000000000002', 'slug-b@ejemplo.test', '{"nombre": "Olga Peña Prueba"}'),
  ('a1a1a1a1-0081-4000-8000-000000000003', 'slug-c@ejemplo.test', '{"nombre": "Coach Del Slug"}'),
  -- «Íñigo Ñúñez» da `inigo-nunez`, prefijo con guion del de A: no puede tener ese slug.
  ('a1a1a1a1-0081-4000-8000-000000000004', 'slug-d@ejemplo.test', '{"nombre": "Íñigo Ñúñez"}')
on conflict (id) do nothing;

update public.usuarios_app set rol = 'coach' where id = 'a1a1a1a1-0081-4000-8000-000000000003';

-- ─────────────────── 1. El slug ───────────────────
select pruebas.afirmar(
  (select slug from public.usuarios_app where id = 'a1a1a1a1-0081-4000-8000-000000000001') = 'inigo-nunez-prueba',
  'el slug no quita las tildes antes de la regex (sale con guiones donde había letras)'
);
select pruebas.afirmar(
  (select slug from public.usuarios_app where id = 'a1a1a1a1-0081-4000-8000-000000000002') = 'olga-pena-prueba',
  'la alta no le dio slug a B'
);
-- La alta NO se bloquea por un choque: entra sin slug.
select pruebas.afirmar(
  (select slug from public.usuarios_app where id = 'a1a1a1a1-0081-4000-8000-000000000004') is null,
  'a D le dieron un slug que es prefijo del de A'
);
-- Y el mismo cálculo que usa el relleno de la migración lo ve como conflicto: con esta
-- persona en la base, la 0081 habría abortado en vez de inventarle un sufijo.
select pruebas.afirmar(
  exists (select 1 from public.slugs_en_conflicto()
           where usuario_id = 'a1a1a1a1-0081-4000-8000-000000000004' and motivo like 'prefijo%'),
  'slugs_en_conflicto no ve el choque de prefijo que haría abortar el relleno'
);

-- ─────────────────── 2. Un id nuevo tiene que seguir la regla (como el coach) ───────────────────
select pruebas.soy('a1a1a1a1-0081-4000-8000-000000000003');
set role authenticated;
select pruebas.exigir_rls();

insert into public.microciclos (id, usuario_id, numero, estado, datos)
values ('m-inigo-nunez-prueba-1', 'a1a1a1a1-0081-4000-8000-000000000001', 1, 'cerrado', '{"sesiones": []}');

-- Cada caso comprueba el código del error (23514): fallar por otra cosa no probaría la regla.
do $$
declare
  v_caso record;
begin
  for v_caso in
    select * from (values
      ('m-inigo-nunez-prueba-1-prop2', 'a1a1a1a1-0081-4000-8000-000000000001'::uuid, 2, 'el -prop de la app vieja'),
      ('m-olga-pena-prueba-2',         'a1a1a1a1-0081-4000-8000-000000000001'::uuid, 2, 'el slug de otra persona'),
      ('m-inigo-nunez-prueba-7',       'a1a1a1a1-0081-4000-8000-000000000001'::uuid, 2, 'un número que no es el suyo'),
      ('m-inigo-2',                    'a1a1a1a1-0081-4000-8000-000000000001'::uuid, 2, 'un nombre de pila derivado a mano'),
      ('m-inigo-nunez-2',              'a1a1a1a1-0081-4000-8000-000000000004'::uuid, 2, 'una persona sin slug')
    ) as t(id, usuario, numero, que)
  loop
    begin
      insert into public.microciclos (id, usuario_id, numero, estado, datos)
      values (v_caso.id, v_caso.usuario, v_caso.numero, 'propuesto', '{"sesiones": []}');
      raise exception 'FALLO: entró un microciclo nuevo con %: %', v_caso.que, v_caso.id;
    exception when check_violation then
      null;
    end;
  end loop;
end $$;

-- Una PROPUESTA con el id de una semana ya entrenada: la numeración se reinició y el upsert
-- de la app la escribiría encima.
insert into public.microciclos (id, usuario_id, numero, estado, datos)
values ('m-inigo-nunez-prueba-2', 'a1a1a1a1-0081-4000-8000-000000000001', 2, 'cerrado', '{"sesiones": [], "hecha": true}');

do $$
begin
  begin
    insert into public.microciclos (id, usuario_id, numero, estado, datos)
    values ('m-inigo-nunez-prueba-2', 'a1a1a1a1-0081-4000-8000-000000000001', 2, 'propuesto', '{"sesiones": []}')
    on conflict (id) do update set datos = excluded.datos, estado = excluded.estado;
    raise exception 'FALLO: una propuesta se escribió encima de una semana cerrada';
  exception when check_violation then
    null;
  end;
end $$;

reset role;
select pruebas.afirmar(
  (select estado = 'cerrado' and datos ? 'hecha' from public.microciclos where id = 'm-inigo-nunez-prueba-2'),
  'la semana cerrada no quedó intacta'
);

-- ─────────────────── 3. Los ids viejos se siguen registrando (como la asesorada A) ───────────────────
-- Una fila de antes de la 0081: se mete con el trigger apagado, que es como estaba la base.
alter table public.microciclos disable trigger trg_id_de_la_regla;
insert into public.microciclos (id, usuario_id, numero, estado, datos)
values ('m-viejo-1-prop2-prop3', 'a1a1a1a1-0081-4000-8000-000000000001', 3, 'activo',
        '{"sesiones": [{"id": "s1", "ejercicios": [{"id": "e1", "series": []}]}]}');
alter table public.microciclos enable trigger trg_id_de_la_regla;

select set_config('request.jwt.claim.sub', '', false);
select pruebas.soy('a1a1a1a1-0081-4000-8000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

-- El registro de series es un UPDATE de la fila entera. Justo lo que un CHECK habría roto.
select public.fijar_series_ejercicio('m-viejo-1-prop2-prop3', 'e1', '[{"orden": 1, "cargaKg": 50, "reps": 10, "rir": 2}]');

-- Y `subirMicrociclo` es un upsert: los BEFORE INSERT se disparan también ahí.
insert into public.microciclos (id, usuario_id, numero, estado, datos)
values ('m-viejo-1-prop2-prop3', 'a1a1a1a1-0081-4000-8000-000000000001', 3, 'activo',
        (select datos from public.microciclos where id = 'm-viejo-1-prop2-prop3') || '{"subido": true}')
on conflict (id) do update set datos = excluded.datos;

reset role;
select pruebas.afirmar(
  (select jsonb_array_length(datos->'sesiones'->0->'ejercicios'->0->'series') = 1 and datos ? 'subido'
     from public.microciclos where id = 'm-viejo-1-prop2-prop3'),
  'la serie o el upsert sobre un id viejo no llegaron'
);

-- ─────────────────── 4. El slug no se cambia desde la app ───────────────────
select pruebas.soy('a1a1a1a1-0081-4000-8000-000000000001');
set role authenticated;
do $$
begin
  begin
    update public.usuarios_app set slug = 'otra-persona' where id = 'a1a1a1a1-0081-4000-8000-000000000001';
    raise exception 'FALLO: la asesorada se cambió el slug';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

-- Tampoco el coach, ni sobre el suyo. (Sobre la fila de otra persona ni llega al trigger:
-- `usuarios_editar_propio` la filtra y el UPDATE toca cero filas; se comprueba abajo.)
select pruebas.soy('a1a1a1a1-0081-4000-8000-000000000003');
set role authenticated;
do $$
begin
  begin
    update public.usuarios_app set slug = 'coach' where id = 'a1a1a1a1-0081-4000-8000-000000000003';
    raise exception 'FALLO: el coach cambió un slug desde la app';
  exception when insufficient_privilege then
    null;
  end;
end $$;
update public.usuarios_app set slug = 'olga' where id = 'a1a1a1a1-0081-4000-8000-000000000002';
reset role;
select pruebas.afirmar(
  (select slug from public.usuarios_app where id = 'a1a1a1a1-0081-4000-8000-000000000002') = 'olga-pena-prueba',
  'el coach le cambió el slug a otra persona desde la app'
);

-- Desde el SQL Editor (sin sesión): a quien tiene microciclos con su prefijo no se le cambia…
select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  begin
    update public.usuarios_app set slug = 'inigo-otro' where id = 'a1a1a1a1-0081-4000-8000-000000000001';
    raise exception 'FALLO: se le partió el prefijo a quien ya tenía microciclos';
  exception when raise_exception then
    null;
  end;
end $$;
-- …un slug que choca con el de otra persona tampoco entra…
do $$
begin
  begin
    update public.usuarios_app set slug = 'inigo-nunez-prueba-bis' where id = 'a1a1a1a1-0081-4000-8000-000000000004';
    raise exception 'FALLO: entró un slug que tiene de prefijo el de otra persona';
  exception when unique_violation then
    null;
  end;
end $$;
-- …y a quien no tiene ninguno se le pone.
update public.usuarios_app set slug = 'inigo-nunez-dos' where id = 'a1a1a1a1-0081-4000-8000-000000000004';

-- ─────────────────── 5. La plantilla de carga lee el slug de la base ───────────────────
\i supabase/plantilla-carga-microciclo.sql

insert into public.microciclos (id, usuario_id, numero, estado, datos)
values ('m-olga-pena-prueba-4', 'a1a1a1a1-0081-4000-8000-000000000002', 4, 'activo', '{"sesiones": []}');

select pruebas.afirmar(
  public.tmp_cargar_siguiente('Olga Peña Prueba', 'olga', '2026-09-21') like 'ABORTA%',
  'la plantilla aceptó un slug distinto del de la base'
);
select pruebas.afirmar(
  public.tmp_cargar_siguiente('Olga Peña Prueba', null, '2026-09-21') = 'OK m-olga-pena-prueba-5 -> M5',
  'la plantilla no construyó el id con el slug de la base'
);
select pruebas.afirmar(
  (select estado from public.microciclos where id = 'm-olga-pena-prueba-5') = 'activo',
  'el microciclo que cargó la plantilla no quedó activo'
);

-- La numeración reiniciada: el M6 del bloque viejo ya existe y está cerrado.
insert into public.microciclos (id, usuario_id, numero, estado, datos)
values ('m-olga-pena-prueba-6', 'a1a1a1a1-0081-4000-8000-000000000002', 6, 'cerrado', '{"sesiones": [], "hecha": true}');
select pruebas.afirmar(
  public.tmp_cargar_siguiente('Olga Peña Prueba', null, '2026-09-28') like 'ABORTA%',
  'la plantilla escribió encima de una semana cerrada de la misma persona'
);
select pruebas.afirmar(
  (select estado = 'cerrado' and datos ? 'hecha' from public.microciclos where id = 'm-olga-pena-prueba-6'),
  'la semana cerrada del bloque viejo no quedó intacta'
);

rollback;
