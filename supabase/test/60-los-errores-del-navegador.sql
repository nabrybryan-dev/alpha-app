-- ¿La recogida de errores del navegador guarda lo que debe y enseña solo a quien debe?
--
-- POR QUÉ ESTA PRUEBA EXISTE. La 0078 crea `errores_navegador` porque del 10 al 12-sep el
-- cribado falló para todo el mundo y nadie se enteró. La tabla la escribe CADA persona desde
-- su teléfono, así que su RLS es de las que más se van a ejercitar: si deja escribir a nombre
-- de otro, el panel del coach miente sobre a quién le falla la app; si deja leer a un
-- asesorado, un mensaje de error de otra persona —que puede traer trozos de sus datos— queda
-- a la vista.
--
-- Demuestra, como `authenticated` y con RLS evaluándose de verdad:
--   1. el asesorado inserta lo suyo (con `usuario_id` puesto por defecto);
--   2. no inserta a nombre de otro;
--   3. no lee lo de otros (ni lo suyo: solo el coach lee);
--   4. no actualiza ni borra;
--   5. el coach lee lo de todos.
--
-- Uuids propios (6666…, 7777…, y 8888… para el coach) para no chocar con las otras pruebas.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla mínima ───────────────────
insert into auth.users (id, email) values
  ('66666666-6666-6666-6666-666666666666', 'errores-a@ejemplo.test'),
  ('77777777-7777-7777-7777-777777777777', 'errores-b@ejemplo.test'),
  ('88888888-8888-8888-8888-888888888888', 'errores-coach@ejemplo.test')
on conflict (id) do nothing;

-- `do update` y no `do nothing`: el trigger de la 0001 ya creó las filas con el rol por
-- defecto al insertar en `auth.users`, y con `do nothing` el coach se quedaría de asesorado
-- (ver 10-escrituras-del-asesorado.sql).
insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('66666666-6666-6666-6666-666666666666', 'Asesorada A de errores', 'asesorado', 'EA'),
  ('77777777-7777-7777-7777-777777777777', 'Asesorado B de errores', 'asesorado', 'EB'),
  ('88888888-8888-8888-8888-888888888888', 'Coach de errores', 'coach', 'CE')
on conflict (id) do update set
  nombre = excluded.nombre,
  rol = excluded.rol,
  avatar_iniciales = excluded.avatar_iniciales;

-- Que el coach de la prueba sea coach DE VERDAD. La primera versión de esta prueba usaba la
-- cuenta de staff de `00-suplantar-supabase.sql` y cayó aquí: esa cuenta se crea ANTES de que
-- exista el trigger de la 0001, así que no tiene fila en `usuarios_app` y la 0006 no promueve
-- a nadie. Sin esta comprobación el paso 5 fallaría por la semilla y parecería la política.
select pruebas.afirmar(
  (select rol from public.usuarios_app where id = '88888888-8888-8888-8888-888888888888') = 'coach',
  'el coach de la prueba no es coach: el paso del coach no probaría la política'
);

-- ─────────────────── Como la asesorada A ───────────────────
select pruebas.soy('66666666-6666-6666-6666-666666666666');
set role authenticated;
select pruebas.exigir_rls();

-- 1. Inserta lo suyo SIN mandar `usuario_id`: es lo que hace el cliente. Si el default
--    `auth.uid()` se perdiera, la columna NOT NULL tumbaría esta línea.
insert into public.errores_navegador (pantalla, mensaje, pila, origen, donde, user_agent, version)
values ('/hoy', 'function contestar_cribado(jsonb) does not exist', 'Error: …', 'reportado',
        'cola:contestar_cribado', 'Mozilla/5.0 (prueba)', 'abc123');

-- Y con su propio id explícito, también.
insert into public.errores_navegador (usuario_id, mensaje, origen)
values ('66666666-6666-6666-6666-666666666666', 'Failed to fetch', 'unhandledrejection');

-- 2. A nombre de B, no. Se comprueba el código del error: un fallo por otra causa (una
--    columna mal escrita, un CHECK) no demostraría nada sobre la política.
do $$
begin
  begin
    insert into public.errores_navegador (usuario_id, mensaje, origen)
    values ('77777777-7777-7777-7777-777777777777', 'suplantado', 'window.error');
    raise exception 'FALLO: la asesorada A insertó un error a nombre de B';
  exception when insufficient_privilege then
    null; -- 42501: la política WITH CHECK lo rechazó, que es lo esperado
  end;
end $$;

-- 3. No lee: ni lo suyo ni, sobre todo, lo de nadie más.
select pruebas.afirmar(
  (select count(*) from public.errores_navegador) = 0,
  'un asesorado lee filas de errores_navegador (solo el coach debe leer)'
);

-- 4. Ni actualiza ni borra. Sin privilegio, así que tiene que reventar, no pasar en silencio
--    sobre cero filas visibles.
do $$
begin
  begin
    update public.errores_navegador set mensaje = 'reescrito';
    raise exception 'FALLO: un asesorado puede actualizar errores_navegador';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.errores_navegador;
    raise exception 'FALLO: un asesorado puede borrar errores_navegador';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

-- ─────────────────── Como B ───────────────────
select pruebas.soy('77777777-7777-7777-7777-777777777777');
set role authenticated;
select pruebas.exigir_rls();

insert into public.errores_navegador (mensaje, origen)
values ('Failed to fetch', 'window.error');

select pruebas.afirmar(
  (select count(*) from public.errores_navegador
    where usuario_id = '66666666-6666-6666-6666-666666666666') = 0,
  'un asesorado lee los errores de otro'
);

reset role;

-- Como dueño (sin RLS): las filas EXISTEN y están a nombre de quien las mandó. Sin esto, el
-- «cero» de arriba podría ser una tabla vacía y no una política.
select pruebas.afirmar(
  (select count(*) from public.errores_navegador
    where usuario_id = '66666666-6666-6666-6666-666666666666') = 2
  and (select count(*) from public.errores_navegador
    where usuario_id = '77777777-7777-7777-7777-777777777777') = 1,
  'las inserciones de A y B no quedaron a su nombre'
);

-- ─────────────────── 5. Como el coach ───────────────────
select pruebas.soy('88888888-8888-8888-8888-888888888888');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.errores_navegador
    where usuario_id in ('66666666-6666-6666-6666-666666666666',
                         '77777777-7777-7777-7777-777777777777')) = 3,
  'el coach no lee los errores de los asesorados'
);

reset role;

rollback;
