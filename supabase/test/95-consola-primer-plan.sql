-- Aprobación del PRIMER plan desde la consola (migración 0086).
--
-- Lo que se prueba, en el orden de la decisión de Bryan (26-sep):
--
--   1. Manuela (aprobar_primer_plan, sin autorizar_excepcion) aprueba un plan de riesgo
--      BAJO: queda `aprobado`, con ella como autora, y el microciclo pasa a `activo`.
--   2. Manuela NO puede aprobar un riesgo ALTO (eso es de Bryan); sí puede rechazarlo, y
--      rechazar sin motivo falla. Bryan (autorizar_excepcion) sí aprueba el alto.
--   3. El asesorado no ve nada (ni su propia fila) y nadie escribe la tabla directamente
--      desde una sesión de usuario, ni con la capacidad; staff sin aprobar_primer_plan no
--      puede decidir.
--   4. vencer_primer_plan(): pasa SOLO bajo sin dudas; medio, alto y bajo-con-dudas quedan
--      en espera_bryan; lo que aún no vence no se toca. authenticated no puede llamarla.
--   5. La fila no se puede crear apuntando al microciclo de otra persona.
--
-- Bloque de UUID propio (a1…/b1…/c1…) para no chocar con los otros archivos. ROLLBACK al
-- final: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
-- a1..a6 = asesorados nuevos (uno por escenario). b1 = «Manuela». b2 = «Bryan».
-- b3 = staff con leer_entrenamiento pero SIN aprobar_primer_plan.
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'pp-bajo@ejemplo.test'),
  ('a1000000-0000-0000-0000-000000000002', 'pp-alto@ejemplo.test'),
  ('a1000000-0000-0000-0000-000000000003', 'pp-vence-bajo@ejemplo.test'),
  ('a1000000-0000-0000-0000-000000000004', 'pp-vence-medio@ejemplo.test'),
  ('a1000000-0000-0000-0000-000000000005', 'pp-vence-dudas@ejemplo.test'),
  ('a1000000-0000-0000-0000-000000000006', 'pp-no-vence@ejemplo.test'),
  ('b1000000-0000-0000-0000-000000000001', 'pp-manuela@ejemplo.test'),
  ('b1000000-0000-0000-0000-000000000002', 'pp-bryan@ejemplo.test'),
  ('b1000000-0000-0000-0000-000000000003', 'pp-staff-sin@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('a1000000-0000-0000-0000-000000000001', 'Nueva bajo', 'asesorado', 'NB'),
  ('a1000000-0000-0000-0000-000000000002', 'Nueva alto', 'asesorado', 'NA'),
  ('a1000000-0000-0000-0000-000000000003', 'Vence bajo', 'asesorado', 'VB'),
  ('a1000000-0000-0000-0000-000000000004', 'Vence medio', 'asesorado', 'VM'),
  ('a1000000-0000-0000-0000-000000000005', 'Vence con dudas', 'asesorado', 'VD'),
  ('a1000000-0000-0000-0000-000000000006', 'No vence', 'asesorado', 'NV'),
  ('b1000000-0000-0000-0000-000000000001', 'Manuela de prueba', 'nutricionista', 'MP'),
  ('b1000000-0000-0000-0000-000000000002', 'Bryan de prueba', 'coach', 'BP'),
  ('b1000000-0000-0000-0000-000000000003', 'Staff sin aprobar', 'nutricionista', 'SA')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('b1000000-0000-0000-0000-000000000001', 'leer_entrenamiento'),
  ('b1000000-0000-0000-0000-000000000001', 'aprobar_primer_plan'),
  ('b1000000-0000-0000-0000-000000000002', 'leer_entrenamiento'),
  ('b1000000-0000-0000-0000-000000000002', 'aprobar_primer_plan'),
  ('b1000000-0000-0000-0000-000000000002', 'autorizar_excepcion'),
  ('b1000000-0000-0000-0000-000000000003', 'leer_entrenamiento')
on conflict do nothing;

insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('m-pp-1', 'a1000000-0000-0000-0000-000000000001', 1, 'propuesto', '{}'::jsonb),
  ('m-pp-2', 'a1000000-0000-0000-0000-000000000002', 1, 'propuesto', '{}'::jsonb),
  ('m-pp-3', 'a1000000-0000-0000-0000-000000000003', 1, 'propuesto', '{}'::jsonb),
  ('m-pp-4', 'a1000000-0000-0000-0000-000000000004', 1, 'propuesto', '{}'::jsonb),
  ('m-pp-5', 'a1000000-0000-0000-0000-000000000005', 1, 'propuesto', '{}'::jsonb),
  ('m-pp-6', 'a1000000-0000-0000-0000-000000000006', 1, 'propuesto', '{}'::jsonb)
on conflict (id) do nothing;

-- Como dueño de la tabla (lo que haría la cola con service_role).
insert into public.aprobaciones_primer_plan (id, usuario_id, microciclo_id, riesgo, dudas_pendientes, plazo_hasta) values
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'm-pp-1', 'bajo', '{}', now() + interval '1 day'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'm-pp-2', 'alto', '{}', now() + interval '1 day'),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'm-pp-3', 'bajo', '{}', now() - interval '1 minute'),
  ('c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'm-pp-4', 'medio', '{}', now() - interval '1 minute'),
  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 'm-pp-5', 'bajo',
   array['¿puede cargar la rodilla operada?'], now() - interval '1 minute'),
  ('c1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006', 'm-pp-6', 'bajo', '{}', now() + interval '1 day');

-- 5 · El trigger de alta: no se puede apuntar al microciclo de OTRA persona.
do $$
begin
  begin
    insert into public.aprobaciones_primer_plan (usuario_id, microciclo_id, riesgo)
    values ('a1000000-0000-0000-0000-000000000001', 'm-pp-6', 'bajo');
    raise exception 'FALLO: se creó una aprobación con el microciclo de otra persona';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · Manuela aprueba un riesgo bajo
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('b1000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.aprobaciones_primer_plan where id::text like 'c1000000-%') = 6,
  'Manuela (leer_entrenamiento) no ve la bandeja completa de primeros planes'
);

select pruebas.afirmar(
  (select (public.decidir_primer_plan('c1000000-0000-0000-0000-000000000001', 'aprobar', null)).estado) = 'aprobado',
  'Manuela no pudo aprobar un primer plan de riesgo bajo'
);

select pruebas.afirmar(
  (select decidido_por from public.aprobaciones_primer_plan where id = 'c1000000-0000-0000-0000-000000000001')
    = 'b1000000-0000-0000-0000-000000000001',
  'el autor de la aprobación no es quien llamó (auth.uid())'
);

select pruebas.afirmar(
  (select estado from public.microciclos where id = 'm-pp-1') = 'activo',
  'aprobar no activó el microciclo propuesto'
);

-- Decidir dos veces: rechazado.
do $$
begin
  begin
    perform public.decidir_primer_plan('c1000000-0000-0000-0000-000000000001', 'rechazar', 'me arrepentí');
    raise exception 'FALLO: se decidió dos veces el mismo primer plan';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Riesgo alto: Manuela no aprueba; rechazar exige motivo; Bryan sí aprueba
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    perform public.decidir_primer_plan('c1000000-0000-0000-0000-000000000002', 'aprobar', 'lo veo bien');
    raise exception 'FALLO: Manuela aprobó un primer plan de riesgo alto';
  exception
    when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    perform public.decidir_primer_plan('c1000000-0000-0000-0000-000000000002', 'rechazar', '   ');
    raise exception 'FALLO: se rechazó sin motivo';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

select pruebas.afirmar(
  (select estado from public.aprobaciones_primer_plan where id = 'c1000000-0000-0000-0000-000000000002') = 'propuesto',
  'el plan de riesgo alto cambió de estado pese a que Manuela no podía aprobarlo'
);

select pruebas.afirmar(
  (select estado from public.microciclos where id = 'm-pp-2') = 'propuesto',
  'el microciclo de riesgo alto se activó sin Bryan'
);

-- Escribir la tabla directamente, ni con la capacidad: sin privilegio.
do $$
begin
  begin
    update public.aprobaciones_primer_plan set estado = 'aprobado' where id = 'c1000000-0000-0000-0000-000000000002';
    raise exception 'FALLO: Manuela actualizó la tabla sin pasar por la RPC';
  exception when insufficient_privilege then
    null;
  end;
end $$;

do $$
begin
  begin
    insert into public.aprobaciones_primer_plan (usuario_id, microciclo_id, riesgo)
    values ('a1000000-0000-0000-0000-000000000006', 'm-pp-6', 'bajo');
    raise exception 'FALLO: Manuela insertó una aprobación desde el navegador';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- vencer_primer_plan no es para una sesión de usuario.
do $$
begin
  begin
    perform public.vencer_primer_plan();
    raise exception 'FALLO: authenticated pudo llamar a vencer_primer_plan';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

select pruebas.soy('b1000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select (public.decidir_primer_plan('c1000000-0000-0000-0000-000000000002', 'aprobar', 'cribado revisado en llamada')).estado) = 'aprobado',
  'Bryan (autorizar_excepcion) no pudo aprobar el riesgo alto'
);

select pruebas.afirmar(
  (select estado from public.microciclos where id = 'm-pp-2') = 'activo',
  'la aprobación de Bryan no activó el microciclo'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · El asesorado no ve nada; staff sin aprobar_primer_plan no decide
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('a1000000-0000-0000-0000-000000000006');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.aprobaciones_primer_plan) = 0,
  'un asesorado ve filas de aprobaciones_primer_plan (ni la suya debería)'
);

do $$
begin
  begin
    perform public.decidir_primer_plan('c1000000-0000-0000-0000-000000000006', 'aprobar', null);
    raise exception 'FALLO: un asesorado aprobó su propio primer plan';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

select pruebas.soy('b1000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.aprobaciones_primer_plan where id = 'c1000000-0000-0000-0000-000000000006') = 1,
  'staff con leer_entrenamiento no ve la bandeja (falso negativo: revisa la semilla)'
);

do $$
begin
  begin
    perform public.decidir_primer_plan('c1000000-0000-0000-0000-000000000006', 'aprobar', null);
    raise exception 'FALLO: staff sin aprobar_primer_plan aprobó un primer plan';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · vencer_primer_plan(): solo bajo sin dudas pasa; el resto espera a Bryan
-- ════════════════════════════════════════════════════════════════════════
-- Contexto de servicio: sin sesión de usuario (auth.uid() nulo), como el cron.
select set_config('request.jwt.claim.sub', '', false);
set role service_role;

select pruebas.afirmar(
  (select aprobados from public.vencer_primer_plan()) = 1,
  'vencer_primer_plan no aprobó exactamente un plan (el bajo sin dudas)'
);

reset role;

select pruebas.afirmar(
  (select estado from public.aprobaciones_primer_plan where id = 'c1000000-0000-0000-0000-000000000003') = 'vencido_aprobado'
  and (select decidido_por from public.aprobaciones_primer_plan where id = 'c1000000-0000-0000-0000-000000000003') is null,
  'el bajo sin dudas no quedó vencido_aprobado sin autor'
);

select pruebas.afirmar(
  (select estado from public.microciclos where id = 'm-pp-3') = 'activo',
  'el plan vencido y aprobado no se publicó'
);

select pruebas.afirmar(
  (select estado from public.aprobaciones_primer_plan where id = 'c1000000-0000-0000-0000-000000000004') = 'espera_bryan'
  and (select estado from public.microciclos where id = 'm-pp-4') = 'propuesto',
  'el riesgo medio pasó solo al vencer'
);

select pruebas.afirmar(
  (select estado from public.aprobaciones_primer_plan where id = 'c1000000-0000-0000-0000-000000000005') = 'espera_bryan'
  and (select motivo_espera from public.aprobaciones_primer_plan where id = 'c1000000-0000-0000-0000-000000000005') like '%rodilla%',
  'el bajo con dudas pendientes pasó solo, o no dejó escrito por qué espera'
);

select pruebas.afirmar(
  (select estado from public.aprobaciones_primer_plan where id = 'c1000000-0000-0000-0000-000000000006') = 'propuesto',
  'vencer_primer_plan tocó un plan cuyo plazo no había vencido'
);

-- Lo que espera a Bryan: Manuela ya no lo aprueba (sí Bryan).
select pruebas.soy('b1000000-0000-0000-0000-000000000001');
set role authenticated;

do $$
begin
  begin
    perform public.decidir_primer_plan('c1000000-0000-0000-0000-000000000004', 'aprobar', null);
    raise exception 'FALLO: Manuela aprobó algo que ya esperaba a Bryan';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

rollback;

\echo 'OK · aprobación del primer plan (0086)'
