-- El alta de un asesorado nuevo, de punta a punta (migración 0107).
--
-- El trayecto completo, en el orden en que ocurre:
--
--   1. Usuario nuevo en auth.users → el trigger `al_crear_usuario` (0001) crea su
--      `usuarios_app` como asesorado. Todavía sin ficha.
--   2. El asesorado NO puede crear la ficha de nadie (ni la suya con la RPC del coach);
--      conserva `registrar_medida` (0057) para lo suyo.
--   3. El coach la crea con `crear_ficha_si_falta`: true la primera vez, false la
--      segunda, y falla con una persona que no existe. Manuela (staff) también puede.
--   4. La cadena deja el primer plan `propuesto` (como servicio, sin sesión) → el trigger
--      crea la fila de `aprobaciones_primer_plan` (riesgo medio, un pendiente por persona,
--      idempotente). Una renovación (ya hubo plan), un coach o un plan que nace activo NO
--      la crean.
--   5. Quien tiene `aprobar_primer_plan` aprueba (0086) → el microciclo queda `activo`.
--   6. El asesorado no ve la bandeja y no puede aprobarse a sí mismo.
--
-- Bloque de UUID propio (d7…/e7…). ROLLBACK al final: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
-- d7…01 = asesorado nuevo · d7…02 = otro asesorado · d7…03 = renovación (ya tuvo plan)
-- e7…01 = coach · e7…02 = Manuela (aprobar_primer_plan)
insert into auth.users (id, email, raw_user_meta_data) values
  ('d7000000-0000-0000-0000-000000000001', 'alta-nuevo@ejemplo.test', '{"nombre": "Alta Nuevo"}'),
  ('d7000000-0000-0000-0000-000000000002', 'alta-otro@ejemplo.test', '{"nombre": "Alta Otro"}'),
  ('d7000000-0000-0000-0000-000000000003', 'alta-renueva@ejemplo.test', '{"nombre": "Alta Renueva"}'),
  ('e7000000-0000-0000-0000-000000000001', 'alta-coach@ejemplo.test', '{"nombre": "Coach Alta"}'),
  ('e7000000-0000-0000-0000-000000000002', 'alta-manuela@ejemplo.test', '{"nombre": "Manuela Alta"}');

-- 1 · El trigger al_crear_usuario hizo su trabajo: fila de usuarios_app, rol asesorado, sin ficha.
select pruebas.afirmar(
  (select count(*) from public.usuarios_app where id::text like 'd7000000-%' and rol = 'asesorado') = 3,
  'al_crear_usuario no creó las tres filas de usuarios_app como asesorado'
);
select pruebas.afirmar(
  (select count(*) from public.perfiles where usuario_id::text like 'd7000000-%') = 0,
  'un usuario recién creado no debería tener ficha todavía'
);

update public.usuarios_app set rol = 'coach' where id = 'e7000000-0000-0000-0000-000000000001';
update public.usuarios_app set rol = 'nutricionista' where id = 'e7000000-0000-0000-0000-000000000002';
insert into public.capacidades_staff (usuario_id, capacidad) values
  ('e7000000-0000-0000-0000-000000000002', 'leer_entrenamiento'),
  ('e7000000-0000-0000-0000-000000000002', 'aprobar_primer_plan');

-- anon no ejecuta la RPC; nadie con sesión ejecuta la función del trigger.
select pruebas.afirmar(
  not has_function_privilege('anon', 'public.crear_ficha_si_falta(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.crear_aprobacion_primer_plan()', 'execute')
  and not has_function_privilege('authenticated', 'public.crear_aprobacion_primer_plan()', 'execute'),
  'anon puede ejecutar crear_ficha_si_falta, o alguien con sesión la función del trigger'
);

-- ════════════════════════════════════════════════════════════════════════
-- 2 · El asesorado no crea fichas con la RPC del coach
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('d7000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

do $$
begin
  begin
    perform public.crear_ficha_si_falta('d7000000-0000-0000-0000-000000000002');
    raise exception 'FALLO: un asesorado creó la ficha de otra persona';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.crear_ficha_si_falta('d7000000-0000-0000-0000-000000000001');
    raise exception 'FALLO: un asesorado usó la RPC del coach para su propia ficha';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Lo suyo sigue funcionando: su medida estrena su ficha (0057).
select public.registrar_medida('{"fecha": "2026-10-02", "pesoKg": 70}'::jsonb);
select pruebas.afirmar(
  (select count(*) from public.perfiles where usuario_id = 'd7000000-0000-0000-0000-000000000001') = 1,
  'registrar_medida dejó de estrenar la ficha del asesorado'
);
reset role;
delete from public.perfiles where usuario_id = 'd7000000-0000-0000-0000-000000000001';

-- ════════════════════════════════════════════════════════════════════════
-- 3 · El coach crea la ficha
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('e7000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  public.crear_ficha_si_falta('d7000000-0000-0000-0000-000000000001') is true,
  'el coach no pudo crear la ficha de un cliente nuevo'
);
select pruebas.afirmar(
  public.crear_ficha_si_falta('d7000000-0000-0000-0000-000000000001') is false,
  'crear la ficha dos veces no fue idempotente (debía devolver false)'
);
select pruebas.afirmar(
  (select datos ->> 'usuarioId' from public.perfiles where usuario_id = 'd7000000-0000-0000-0000-000000000001')
    = 'd7000000-0000-0000-0000-000000000001'
  and (select jsonb_array_length(datos -> 'medidas') from public.perfiles
        where usuario_id = 'd7000000-0000-0000-0000-000000000001') = 0
  and (select count(*) from public.perfiles where usuario_id = 'd7000000-0000-0000-0000-000000000001') = 1,
  'la ficha creada por el coach no es la mínima esperada (usuarioId + medidas vacías), o se duplicó'
);

-- Con la ficha creada, el coach ya puede escribirle el sexo por el camino normal.
update public.perfiles set sexo = 'mujer' where usuario_id = 'd7000000-0000-0000-0000-000000000001';
select pruebas.afirmar(
  (select sexo from public.perfiles where usuario_id = 'd7000000-0000-0000-0000-000000000001') = 'mujer',
  'el coach no pudo guardar el sexo sobre la ficha recién creada'
);

do $$
begin
  begin
    perform public.crear_ficha_si_falta('d7999999-0000-0000-0000-000000000009');
    raise exception 'FALLO: se creó una ficha para una persona que no existe';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;
reset role;

-- Manuela (staff nutricionista) SÍ crea la ficha de un cliente nuevo; el asesorado no (bloque 2).
select pruebas.soy('e7000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.afirmar(
  public.crear_ficha_si_falta('d7000000-0000-0000-0000-000000000003') is true,
  'la nutricionista (staff) no pudo crear la ficha de un cliente nuevo'
);
reset role;
select pruebas.afirmar(
  (select count(*) from public.perfiles where usuario_id = 'd7000000-0000-0000-0000-000000000003') = 1,
  'la ficha creada por la nutricionista no existe'
);

-- ════════════════════════════════════════════════════════════════════════
-- 4 · La cadena propone el primer plan → nace la fila de aprobación
-- ════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', '', false);   -- servicio: sin sesión de usuario

insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('m-alta-1', 'd7000000-0000-0000-0000-000000000001', 1, 'propuesto', '{}'::jsonb);

select pruebas.afirmar(
  (select count(*) from public.aprobaciones_primer_plan
    where usuario_id = 'd7000000-0000-0000-0000-000000000001' and microciclo_id = 'm-alta-1'
      and estado = 'propuesto' and riesgo = 'medio') = 1,
  'proponer el primer microciclo no creó la fila de aprobación (riesgo medio, propuesto)'
);

-- Idempotente: tocar el estado otra vez, o proponer un segundo plan mientras el primero
-- espera, no duplica ni rompe.
update public.microciclos set estado = 'propuesto' where id = 'm-alta-1';
insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('m-alta-1b', 'd7000000-0000-0000-0000-000000000001', 2, 'propuesto', '{}'::jsonb);
select pruebas.afirmar(
  (select count(*) from public.aprobaciones_primer_plan where usuario_id = 'd7000000-0000-0000-0000-000000000001') = 1,
  'la fila de aprobación se duplicó (debía haber un solo pendiente por persona)'
);
delete from public.microciclos where id = 'm-alta-1b';

-- Una renovación (ya tuvo un plan cerrado) NO crea fila: no es un primer plan.
insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('m-alta-3-viejo', 'd7000000-0000-0000-0000-000000000003', 1, 'cerrado', '{}'::jsonb),
  ('m-alta-3', 'd7000000-0000-0000-0000-000000000003', 2, 'propuesto', '{}'::jsonb);
select pruebas.afirmar(
  (select count(*) from public.aprobaciones_primer_plan where usuario_id = 'd7000000-0000-0000-0000-000000000003') = 0,
  'una renovación creó fila de aprobación del primer plan'
);

-- Un plan propuesto de un coach tampoco.
insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('m-alta-coach', 'e7000000-0000-0000-0000-000000000001', 1, 'propuesto', '{}'::jsonb);
select pruebas.afirmar(
  (select count(*) from public.aprobaciones_primer_plan where usuario_id = 'e7000000-0000-0000-0000-000000000001') = 0,
  'un plan propuesto de un coach creó fila de aprobación'
);

-- Un microciclo que nace activo no crea nada.
insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('m-alta-2', 'd7000000-0000-0000-0000-000000000002', 1, 'activo', '{}'::jsonb);
select pruebas.afirmar(
  (select count(*) from public.aprobaciones_primer_plan where usuario_id = 'd7000000-0000-0000-0000-000000000002') = 0,
  'un microciclo activo creó fila de aprobación'
);

-- Guardamos el id de la fila (como dueño de la prueba) para las llamadas siguientes.
select set_config('prueba.aprobacion_id',
  (select id::text from public.aprobaciones_primer_plan where microciclo_id = 'm-alta-1'), false);

-- ════════════════════════════════════════════════════════════════════════
-- 6 · El asesorado no ve ni se aprueba a sí mismo
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('d7000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.aprobaciones_primer_plan) = 0,
  'el asesorado ve filas de aprobación (ni la suya debería)'
);

do $$
begin
  begin
    perform public.decidir_primer_plan(current_setting('prueba.aprobacion_id')::uuid, 'aprobar', null);
    raise exception 'FALLO: un asesorado aprobó su propio primer plan';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pruebas.afirmar(
  (select estado from public.microciclos where id = 'm-alta-1') = 'propuesto',
  'el plan se activó aunque quien intentó aprobarlo era el propio asesorado'
);

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Quien puede, aprueba → el plan queda activo
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('e7000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select (public.decidir_primer_plan(current_setting('prueba.aprobacion_id')::uuid, 'aprobar', null)).estado) = 'aprobado',
  'Manuela (aprobar_primer_plan) no pudo aprobar un primer plan de riesgo medio creado por el trigger'
);
reset role;

select pruebas.afirmar(
  (select estado from public.microciclos where id = 'm-alta-1') = 'activo',
  'aprobar no dejó el primer plan activo: el trayecto del alta no llega al final'
);

-- Con el plan activo, un nuevo propuesto ya es renovación: sin fila de primer plan.
select set_config('request.jwt.claim.sub', '', false);
insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('m-alta-1c', 'd7000000-0000-0000-0000-000000000001', 2, 'propuesto', '{}'::jsonb);
select pruebas.afirmar(
  (select count(*) from public.aprobaciones_primer_plan where usuario_id = 'd7000000-0000-0000-0000-000000000001') = 1,
  'un segundo plan propuesto, ya con plan activo, creó otra fila de primer plan'
);

rollback;

\echo 'OK · el alta de punta a punta (0107)'
