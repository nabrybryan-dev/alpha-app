-- Consola del coach — capa de servidor (0083): permisos por capacidad, no por rol.
--
-- POR QUÉ ESTA PRUEBA EXISTE. Todo lo de esta migración es nuevo (tablas y políticas), así
-- que no hay un fallo histórico que reproducir como en 40-el-cribado-se-guarda.sql. Lo que
-- sí hay es un riesgo concreto, nombrado por Astra: "datos de salud expuestos por una
-- política olvidada" y "suplantación de respuestas". Esta prueba comprueba contra RLS de
-- verdad —no contra el código del cliente— las cinco cosas que el encargo pide:
--
--   1. Quien NO tiene la capacidad no lee (y quien SÍ la tiene, control positivo, sí lee).
--   2. Manuela (capacidad sin ser coach) lee entrenamiento, pero no puede insertar en
--      `aprobaciones` ni tiene `autorizar_excepcion`.
--   3. El actor de `responder_como_staff` no se puede falsificar.
--   4. `event_id` duplicado en `cadena_corridas` se rechaza.
--   5. Un único plan vigente por persona en `planes_estrategicos`.
--
-- Usa un bloque de UUID propio (55/66/77-…) para no chocar con la semilla de los otros
-- archivos, y termina en ROLLBACK: no deja nada detrás para las pruebas que corran después.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla mínima ───────────────────
-- 55 = asesorada dueña de sus propios datos.
-- 66 = staff CON capacidades (el equivalente de Manuela: lee entrenamiento y responde por
--      el asesorado, pero JAMÁS autorizar_excepcion ni firmar_politica).
-- 77 = staff SIN ninguna capacidad (control negativo: staff no implica acceso).
-- 33 = el coach que ya sembró 10-escrituras-del-asesorado.sql (corre antes en el CI).
insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'consola-asesorada@ejemplo.test'),
  ('66666666-6666-6666-6666-666666666666', 'consola-staff-con-capacidad@ejemplo.test'),
  ('77777777-7777-7777-7777-777777777777', 'consola-staff-sin-capacidad@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('55555555-5555-5555-5555-555555555555', 'Asesorada de la consola', 'asesorado', 'AS'),
  ('66666666-6666-6666-6666-666666666666', 'Staff con capacidad', 'nutricionista', 'SC'),
  ('77777777-7777-7777-7777-777777777777', 'Staff sin capacidad', 'nutricionista', 'SS')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- 66 tiene lo que Manuela tiene según §4 de RESPUESTA-ASTRA-CONSOLA.md: todo MENOS
-- autorizar_excepcion y firmar_politica. 77 no tiene nada — ni siquiera detenida.
insert into public.capacidades_staff (usuario_id, capacidad) values
  ('66666666-6666-6666-6666-666666666666', 'leer_entrenamiento'),
  ('66666666-6666-6666-6666-666666666666', 'responder_por_asesorado'),
  ('66666666-6666-6666-6666-666666666666', 'detener_publicacion'),
  ('66666666-6666-6666-6666-666666666666', 'reportar_riesgo')
on conflict do nothing;

-- Un microciclo, un check-in y un cuestionario asignado SOLO a la asesorada, para poder
-- comprobar que 77 no los ve y 66 sí. `cuestionarios.asignado_a` es lo que exige
-- `responder_como_staff`: un único destinatario.
insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('m-consola-test-1', '55555555-5555-5555-5555-555555555555', 1, 'activo', '{}'::jsonb)
on conflict (id) do nothing;

insert into public.checkins (id, usuario_id, fecha, datos) values
  ('checkin-consola-test-1', '55555555-5555-5555-5555-555555555555', current_date, '{"pesoKg": 61}'::jsonb)
on conflict (id) do nothing;

insert into public.cuestionarios (id, datos, asignado_a) values
  ('q-consola-test-1', '{"titulo": "Check-in de la consola"}'::jsonb,
   array['55555555-5555-5555-5555-555555555555']::uuid[])
on conflict (id) do nothing;

-- Un evento de la cadena y un plan estratégico, ambos de la asesorada — los escribiría
-- `service_role`, y aquí se insertan como dueño de las tablas (mismo permiso).
insert into public.cadena_corridas
  (event_id, run_id, usuario_id, semana_inicio, paso, estado, secuencia, hash_artefacto,
   version_reglas, fecha_dato, resumen)
values
  ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001',
   '55555555-5555-5555-5555-555555555555', '2026-09-28', 1, 'completado', 1, 'hash-paso-1',
   'reglas-v1', now(), 'Dictamen de la semana')
on conflict (event_id) do nothing;

insert into public.planes_estrategicos (usuario_id, version, vigente, contenido, hash) values
  ('55555555-5555-5555-5555-555555555555', 1, true, '{"objetivo": "hipertrofia"}'::jsonb, 'hash-plan-v1')
on conflict (usuario_id, version) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · Sin la capacidad no se lee; con ella, sí (control positivo Y negativo)
-- ════════════════════════════════════════════════════════════════════════

select pruebas.soy('77777777-7777-7777-7777-777777777777');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.microciclos where id = 'm-consola-test-1') = 0,
  'staff SIN leer_entrenamiento ve un microciclo ajeno'
);
select pruebas.afirmar(
  (select count(*) from public.checkins where id = 'checkin-consola-test-1') = 0,
  'staff SIN leer_entrenamiento ve un check-in ajeno'
);
select pruebas.afirmar(
  (select count(*) from public.cuestionarios where id = 'q-consola-test-1') = 0,
  'staff SIN leer_entrenamiento ve un cuestionario ajeno'
);
select pruebas.afirmar(
  (select count(*) from public.cadena_corridas where event_id = '11111111-0000-0000-0000-000000000001') = 0,
  'staff SIN leer_entrenamiento ve una corrida ajena'
);
select pruebas.afirmar(
  (select count(*) from public.planes_estrategicos where usuario_id = '55555555-5555-5555-5555-555555555555') = 0,
  'staff SIN leer_entrenamiento ve un plan estratégico ajeno'
);

reset role;

select pruebas.soy('66666666-6666-6666-6666-666666666666');
set role authenticated;
select pruebas.exigir_rls();

-- Control positivo: si estas fallaran por CUALQUIER motivo —incluida la tabla vacía—, el
-- bloque negativo de arriba no probaría que la política filtra, probaría que no hay datos.
select pruebas.afirmar(
  (select count(*) from public.microciclos where id = 'm-consola-test-1') = 1,
  'staff CON leer_entrenamiento no ve el microciclo (falso negativo: revisa la semilla)'
);
select pruebas.afirmar(
  (select count(*) from public.checkins where id = 'checkin-consola-test-1') = 1,
  'staff CON leer_entrenamiento no ve el check-in'
);
select pruebas.afirmar(
  (select count(*) from public.cuestionarios where id = 'q-consola-test-1') = 1,
  'staff CON leer_entrenamiento no ve el cuestionario'
);
select pruebas.afirmar(
  (select count(*) from public.cadena_corridas where event_id = '11111111-0000-0000-0000-000000000001') = 1,
  'staff CON leer_entrenamiento no ve la corrida de la cadena'
);
select pruebas.afirmar(
  (select count(*) from public.planes_estrategicos where usuario_id = '55555555-5555-5555-5555-555555555555') = 1,
  'staff CON leer_entrenamiento no ve el plan estratégico'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Manuela (66) lee entrenamiento, pero no autoriza excepciones ni firma
--     política, y NADIE —ni con todas las demás capacidades— inserta en
--     `aprobaciones` desde una sesión de usuario.
-- ════════════════════════════════════════════════════════════════════════

select pruebas.soy('66666666-6666-6666-6666-666666666666');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select public.tiene_capacidad('leer_entrenamiento')) is true,
  'la staff con capacidad debería tener leer_entrenamiento'
);
select pruebas.afirmar(
  (select public.tiene_capacidad('autorizar_excepcion')) is false,
  'la staff con capacidad NO debería poder autorizar excepciones (decisión de Bryan)'
);
select pruebas.afirmar(
  (select public.tiene_capacidad('firmar_politica')) is false,
  'la staff con capacidad NO debería poder firmar la política del piloto'
);

-- Intento de insertar una aprobación desde una sesión de usuario: sin política de INSERT,
-- RLS deniega ANTES de mirar el `with check` — no hace falta que exista uno.
do $$
begin
  begin
    insert into public.aprobaciones (plan_hash, usuario_id, semana, firmante, firma)
    values ('hash-plan-v1', '55555555-5555-5555-5555-555555555555', '2026-09-28',
            '66666666-6666-6666-6666-666666666666', 'firma-de-mentira');
    raise exception 'FALLO: una sesión de usuario insertó una aprobación';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.aprobaciones where plan_hash = 'hash-plan-v1') = 0,
  'quedó una aprobación insertada desde el navegador'
);

reset role;

-- Y ni siquiera el COACH puede insertar en `aprobaciones` desde su sesión: la única vía es
-- `service_role`, tras verificar la firma SSH fuera de la base (§1 del encargo).
select pruebas.soy('33333333-3333-3333-3333-333333333333');
set role authenticated;
select pruebas.exigir_rls();

do $$
begin
  begin
    insert into public.aprobaciones (plan_hash, usuario_id, semana, firmante, firma)
    values ('hash-plan-v1', '55555555-5555-5555-5555-555555555555', '2026-09-28',
            '33333333-3333-3333-3333-333333333333', 'firma-de-mentira');
    raise exception 'FALLO: el coach insertó una aprobación desde el navegador';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · El actor de responder_como_staff no se puede falsificar
-- ════════════════════════════════════════════════════════════════════════

-- 3a. Sin la capacidad, la RPC rechaza (77 no tiene responder_por_asesorado).
select pruebas.soy('77777777-7777-7777-7777-777777777777');
set role authenticated;
select pruebas.exigir_rls();

do $$
begin
  begin
    perform public.responder_como_staff('q-consola-test-1', '{"animo": "bien"}'::jsonb);
    raise exception 'FALLO: respondió como staff sin tener la capacidad';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

reset role;

-- 3b. Con la capacidad, la RPC inserta y el actor es SIEMPRE auth.uid() — incluso si el
-- jsonb trae un `_respondido_por` distinto intentando suplantar a otra persona (Q2 de
-- Astra: un campo así "no acredita autoría"; aquí se comprueba que ni lo intenta leer).
select pruebas.soy('66666666-6666-6666-6666-666666666666');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select (public.responder_como_staff(
     'q-consola-test-1',
     '{"animo": "bien", "_respondido_por": "33333333-3333-3333-3333-333333333333"}'::jsonb
   )).respondido_por) = '66666666-6666-6666-6666-666666666666',
  'el actor registrado no fue quien llamó a la RPC: se pudo falsificar'
);

select pruebas.afirmar(
  (select count(*) from public.respuestas
    where cuestionario_id = 'q-consola-test-1'
      and origen = 'staff'
      and respondido_por = '66666666-6666-6666-6666-666666666666') = 1,
  'la respuesta del staff no quedó registrada con su origen y su actor'
);

reset role;

-- No borra la historia: si la asesorada respondió antes (con su propia sesión — la
-- política `respuestas_crear_propia` de la 0001 exige `usuario_id = auth.uid()`, así que
-- esto tiene que insertarse COMO ella, no como el staff que sigue de la prueba anterior),
-- las dos filas conviven.
select pruebas.soy('55555555-5555-5555-5555-555555555555');
set role authenticated;
select pruebas.exigir_rls();

insert into public.respuestas (id, cuestionario_id, usuario_id, fecha_iso, valores) values
  ('r-consola-test-de-ella', 'q-consola-test-1', '55555555-5555-5555-5555-555555555555',
   now(), '{"animo": "regular"}'::jsonb)
on conflict (id) do nothing;

reset role;

select pruebas.soy('66666666-6666-6666-6666-666666666666');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.respuestas where cuestionario_id = 'q-consola-test-1') >= 2,
  'la respuesta del staff sobrescribió la historia en vez de sumarse a ella'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · event_id duplicado en cadena_corridas se rechaza
-- ════════════════════════════════════════════════════════════════════════
-- Como dueño de la tabla (mismo nivel que service_role, que bypassa RLS): es el único que
-- escribe esta proyección, así que la prueba de idempotencia tiene que correr con SU
-- mismo permiso, no con el de un usuario autenticado que ni siquiera puede insertar.

do $$
begin
  begin
    insert into public.cadena_corridas
      (event_id, run_id, usuario_id, semana_inicio, paso, estado, secuencia, hash_artefacto,
       version_reglas, fecha_dato)
    values
      ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002',
       '55555555-5555-5555-5555-555555555555', '2026-09-28', 1, 'completado', 2, 'hash-otro',
       'reglas-v1', now());
    raise exception 'FALLO: un event_id duplicado se aceptó';
  exception
    when unique_violation then null;
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.cadena_corridas where event_id = '11111111-0000-0000-0000-000000000001') = 1,
  'el event_id duplicado dejó dos filas'
);

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Un único plan vigente por persona
-- ════════════════════════════════════════════════════════════════════════

do $$
begin
  begin
    insert into public.planes_estrategicos (usuario_id, version, vigente, contenido, hash)
    values ('55555555-5555-5555-5555-555555555555', 2, true, '{"objetivo": "fuerza"}'::jsonb, 'hash-plan-v2');
    raise exception 'FALLO: dos planes vigentes a la vez para la misma persona';
  exception
    when unique_violation then null;
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.planes_estrategicos
    where usuario_id = '55555555-5555-5555-5555-555555555555' and vigente) = 1,
  'quedó más de un plan vigente para la misma persona'
);

-- Apagar el vigente y activar el siguiente SÍ tiene que poder, en la misma transacción
-- (es la disciplina que se le exige a quien escriba esto en producción).
update public.planes_estrategicos set vigente = false
  where usuario_id = '55555555-5555-5555-5555-555555555555' and version = 1;
insert into public.planes_estrategicos (usuario_id, version, vigente, contenido, hash)
  values ('55555555-5555-5555-5555-555555555555', 2, true, '{"objetivo": "fuerza"}'::jsonb, 'hash-plan-v2');

select pruebas.afirmar(
  (select count(*) from public.planes_estrategicos
    where usuario_id = '55555555-5555-5555-5555-555555555555' and vigente) = 1
  and (select version from public.planes_estrategicos
        where usuario_id = '55555555-5555-5555-5555-555555555555' and vigente) = 2,
  'apagar el viejo y prender el nuevo en la misma transacción no dejó exactamente un vigente'
);

rollback;

\echo 'OK · permisos de la consola por capacidad (0083)'
