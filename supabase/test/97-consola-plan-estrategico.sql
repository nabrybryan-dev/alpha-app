-- Aprobación del plan estratégico RENOVADO desde la consola (migración 0087).
--
-- Lo que se prueba, en el orden de la decisión de Bryan (26-sep):
--
--   0. `estado` se deriva para los escritores viejos: insert vigente sin estado → 'vigente';
--      insert no vigente sin estado → 'borrador'; `(estado = 'vigente') = vigente` por check.
--   1. El asesorado NO ve su borrador (ni un rechazado); sí su vigente. El staff sí lo ve.
--   2. Manuela (aprobar_plan_estrategico, sin autorizar_excepcion) aprueba un riesgo BAJO:
--      el viejo queda 'reemplazado', el borrador 'vigente', y hay UN solo vigente.
--   3. Manuela NO aprueba lo clínico ni el riesgo alto; sí rechaza (con motivo), y el
--      borrador queda 'rechazado'. Bryan (autorizar_excepcion) aprueba el alto.
--   4. Nadie escribe la tabla de aprobaciones desde una sesión; staff sin la capacidad y el
--      asesorado no deciden; authenticated no llama a vencer.
--   5. vencer_plan_estrategico(): pasa SOLO bajo, no clínico, sin dudas ni preguntas para
--      Bryan; el resto a espera_bryan; lo no vencido no se toca.
--   6. El trigger de alta: no se puede aprobar el plan de otra persona, algo que no es
--      borrador, ni con un hash distinto.
--
-- Bloque de UUID propio (a7…/b7…/c7…/d7…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
-- a7..01 bajo (Manuela aprueba) · 02 alto (Bryan) · 03 clínico (Manuela rechaza)
-- 04 vence bajo · 05 vence medio · 06 vence con preguntas · 07 vence clínico · 08 no vence
-- b7..01 Manuela · 02 Bryan · 03 staff sin aprobar_plan_estrategico
insert into auth.users (id, email) values
  ('a7000000-0000-0000-0000-000000000001', 'pe-bajo@ejemplo.test'),
  ('a7000000-0000-0000-0000-000000000002', 'pe-alto@ejemplo.test'),
  ('a7000000-0000-0000-0000-000000000003', 'pe-clinico@ejemplo.test'),
  ('a7000000-0000-0000-0000-000000000004', 'pe-vence-bajo@ejemplo.test'),
  ('a7000000-0000-0000-0000-000000000005', 'pe-vence-medio@ejemplo.test'),
  ('a7000000-0000-0000-0000-000000000006', 'pe-vence-preguntas@ejemplo.test'),
  ('a7000000-0000-0000-0000-000000000007', 'pe-vence-clinico@ejemplo.test'),
  ('a7000000-0000-0000-0000-000000000008', 'pe-no-vence@ejemplo.test'),
  ('b7000000-0000-0000-0000-000000000001', 'pe-manuela@ejemplo.test'),
  ('b7000000-0000-0000-0000-000000000002', 'pe-bryan@ejemplo.test'),
  ('b7000000-0000-0000-0000-000000000003', 'pe-staff-sin@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('a7000000-0000-0000-0000-000000000001', 'Renueva bajo', 'asesorado', 'RB'),
  ('a7000000-0000-0000-0000-000000000002', 'Renueva alto', 'asesorado', 'RA'),
  ('a7000000-0000-0000-0000-000000000003', 'Renueva clínico', 'asesorado', 'RC'),
  ('a7000000-0000-0000-0000-000000000004', 'Vence bajo', 'asesorado', 'VB'),
  ('a7000000-0000-0000-0000-000000000005', 'Vence medio', 'asesorado', 'VM'),
  ('a7000000-0000-0000-0000-000000000006', 'Vence con preguntas', 'asesorado', 'VP'),
  ('a7000000-0000-0000-0000-000000000007', 'Vence clínico', 'asesorado', 'VC'),
  ('a7000000-0000-0000-0000-000000000008', 'No vence', 'asesorado', 'NV'),
  ('b7000000-0000-0000-0000-000000000001', 'Manuela de prueba', 'nutricionista', 'MP'),
  ('b7000000-0000-0000-0000-000000000002', 'Bryan de prueba', 'coach', 'BP'),
  ('b7000000-0000-0000-0000-000000000003', 'Staff sin aprobar', 'nutricionista', 'SA')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('b7000000-0000-0000-0000-000000000001', 'leer_entrenamiento'),
  ('b7000000-0000-0000-0000-000000000001', 'aprobar_plan_estrategico'),
  ('b7000000-0000-0000-0000-000000000002', 'leer_entrenamiento'),
  ('b7000000-0000-0000-0000-000000000002', 'aprobar_plan_estrategico'),
  ('b7000000-0000-0000-0000-000000000002', 'autorizar_excepcion'),
  ('b7000000-0000-0000-0000-000000000003', 'leer_entrenamiento')
on conflict do nothing;

-- Planes como los escriben los importadores (service_role = dueño aquí), SIN `estado`:
-- versión 1 vigente para cada persona, versión 2 borrador (vigente = false).
insert into public.planes_estrategicos (id, usuario_id, version, vigente, contenido, hash)
select ('d7000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       ('a7000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       1, true, '{"objetivo_largo_plazo": "base"}'::jsonb, 'hash-v1-' || n
  from generate_series(1, 8) n;

insert into public.planes_estrategicos (id, usuario_id, version, vigente, contenido, hash)
select ('d7000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid,
       ('a7000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       2, false, '{"objetivo_largo_plazo": "renovado"}'::jsonb, 'hash-v2-' || n
  from generate_series(1, 8) n;

-- 0 · Derivación del estado.
select pruebas.afirmar(
  (select count(*) from public.planes_estrategicos where id::text like 'd7000000-%' and version = 1 and estado = 'vigente') = 8
  and (select count(*) from public.planes_estrategicos where id::text like 'd7000000-%' and version = 2 and estado = 'borrador') = 8,
  'insert sin estado no derivó vigente/borrador desde vigente'
);

do $$
begin
  begin
    update public.planes_estrategicos set estado = 'vigente'
     where id = 'd7000000-0000-0000-0000-000000000108';
    raise exception 'FALLO: un plan quedó estado vigente con vigente = false';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

insert into public.aprobaciones_plan_estrategico
  (id, usuario_id, plan_id, hash, riesgo, clinico, dudas_pendientes, preguntas_para_bryan, justificacion, plazo_hasta) values
  ('c7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000101', 'hash-v2-1',
   'bajo', false, '{}', '[]', '[{"decision": "subir a 4 días", "evidencia": "adherencia 95 %"}]', now() + interval '1 day'),
  ('c7000000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000002', 'd7000000-0000-0000-0000-000000000102', 'hash-v2-2',
   'alto', false, '{}', '[]', '[]', now() + interval '1 day'),
  ('c7000000-0000-0000-0000-000000000003', 'a7000000-0000-0000-0000-000000000003', 'd7000000-0000-0000-0000-000000000103', 'hash-v2-3',
   'bajo', true, '{}', '[]', '[]', now() + interval '1 day'),
  ('c7000000-0000-0000-0000-000000000004', 'a7000000-0000-0000-0000-000000000004', 'd7000000-0000-0000-0000-000000000104', 'hash-v2-4',
   'bajo', false, '{}', '[]', '[]', now() - interval '1 minute'),
  ('c7000000-0000-0000-0000-000000000005', 'a7000000-0000-0000-0000-000000000005', 'd7000000-0000-0000-0000-000000000105', 'hash-v2-5',
   'medio', false, '{}', '[]', '[]', now() - interval '1 minute'),
  ('c7000000-0000-0000-0000-000000000006', 'a7000000-0000-0000-0000-000000000006', 'd7000000-0000-0000-0000-000000000106', 'hash-v2-6',
   'bajo', false, '{}', '[{"pregunta": "¿Mantener 3 días?", "opciones": ["Sí", "No"]}]', '[]', now() - interval '1 minute'),
  ('c7000000-0000-0000-0000-000000000007', 'a7000000-0000-0000-0000-000000000007', 'd7000000-0000-0000-0000-000000000107', 'hash-v2-7',
   'bajo', true, '{}', '[]', '[]', now() - interval '1 minute'),
  ('c7000000-0000-0000-0000-000000000008', 'a7000000-0000-0000-0000-000000000008', 'd7000000-0000-0000-0000-000000000108', 'hash-v2-8',
   'bajo', false, '{}', '[]', '[]', now() + interval '1 day');

-- 6 · El trigger de alta.
do $$
begin
  begin
    insert into public.aprobaciones_plan_estrategico (usuario_id, plan_id, hash, riesgo)
    values ('a7000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000108', 'hash-v2-8', 'bajo');
    raise exception 'FALLO: se creó una aprobación con el plan de otra persona';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

do $$
begin
  begin
    insert into public.aprobaciones_plan_estrategico (usuario_id, plan_id, hash, riesgo)
    values ('a7000000-0000-0000-0000-000000000008', 'd7000000-0000-0000-0000-000000000008', 'hash-v1-8', 'bajo');
    raise exception 'FALLO: se creó una aprobación sobre un plan que no es borrador';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

do $$
begin
  begin
    -- Borra la pendiente de la 8 dentro de la subtransacción para que el índice de «un
    -- pendiente» no sea lo que haga fallar; lo que tiene que fallar es el hash.
    delete from public.aprobaciones_plan_estrategico where id = 'c7000000-0000-0000-0000-000000000008';
    insert into public.aprobaciones_plan_estrategico (usuario_id, plan_id, hash, riesgo)
    values ('a7000000-0000-0000-0000-000000000008', 'd7000000-0000-0000-0000-000000000108', 'otro-hash', 'bajo');
    raise exception 'FALLO: se creó una aprobación con un hash distinto del borrador';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.aprobaciones_plan_estrategico where id = 'c7000000-0000-0000-0000-000000000008') = 1,
  'la subtransacción del hash distinto no se deshizo (revisa la prueba)'
);

-- ════════════════════════════════════════════════════════════════════════
-- 1 · El asesorado no ve su borrador; sí su vigente
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('a7000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000001') = 1,
  'el asesorado no ve su plan vigente (falso negativo: revisa la semilla)'
);
select pruebas.afirmar(
  (select count(*) from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000101') = 0,
  'el asesorado ve su BORRADOR de plan estratégico'
);
select pruebas.afirmar(
  (select count(*) from public.aprobaciones_plan_estrategico) = 0,
  'el asesorado ve filas de aprobaciones_plan_estrategico'
);

do $$
begin
  begin
    perform public.decidir_plan_estrategico('c7000000-0000-0000-0000-000000000001', 'aprobar', null);
    raise exception 'FALLO: un asesorado aprobó su propio plan renovado';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Manuela aprueba un riesgo bajo: un solo vigente, el viejo reemplazado
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('b7000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000101') = 1,
  'Manuela no ve el borrador que tiene que aprobar'
);
select pruebas.afirmar(
  (select count(*) from public.aprobaciones_plan_estrategico where id::text like 'c7000000-%') = 8,
  'Manuela no ve la bandeja completa de planes renovados'
);

select pruebas.afirmar(
  (select (public.decidir_plan_estrategico('c7000000-0000-0000-0000-000000000001', 'aprobar', null)).estado) = 'aprobado',
  'Manuela no pudo aprobar un plan renovado de riesgo bajo'
);

select pruebas.afirmar(
  (select decidido_por from public.aprobaciones_plan_estrategico where id = 'c7000000-0000-0000-0000-000000000001')
    = 'b7000000-0000-0000-0000-000000000001',
  'el autor de la aprobación no es quien llamó (auth.uid())'
);

select pruebas.afirmar(
  (select count(*) from public.planes_estrategicos
    where usuario_id = 'a7000000-0000-0000-0000-000000000001' and vigente) = 1
  and (select version from public.planes_estrategicos
        where usuario_id = 'a7000000-0000-0000-0000-000000000001' and vigente) = 2
  and (select estado from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000101') = 'vigente'
  and (select estado from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000001') = 'reemplazado',
  'aprobar no dejó exactamente un vigente (el renovado) con el viejo reemplazado'
);

do $$
begin
  begin
    perform public.decidir_plan_estrategico('c7000000-0000-0000-0000-000000000001', 'rechazar', 'me arrepentí');
    raise exception 'FALLO: se decidió dos veces el mismo plan renovado';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Alto y clínico: Manuela no aprueba; rechazar exige motivo
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  begin
    perform public.decidir_plan_estrategico('c7000000-0000-0000-0000-000000000002', 'aprobar', 'lo veo bien');
    raise exception 'FALLO: Manuela aprobó un plan renovado de riesgo alto';
  exception when insufficient_privilege then
    null;
  end;
end $$;

do $$
begin
  begin
    perform public.decidir_plan_estrategico('c7000000-0000-0000-0000-000000000003', 'aprobar', 'lo veo bien');
    raise exception 'FALLO: Manuela aprobó un plan renovado clínico marcado de riesgo bajo';
  exception when insufficient_privilege then
    null;
  end;
end $$;

do $$
begin
  begin
    perform public.decidir_plan_estrategico('c7000000-0000-0000-0000-000000000003', 'rechazar', '   ');
    raise exception 'FALLO: se rechazó sin motivo';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

select pruebas.afirmar(
  (select (public.decidir_plan_estrategico('c7000000-0000-0000-0000-000000000003', 'rechazar', 'hay que hablar con su médico')).estado) = 'rechazado',
  'Manuela no pudo rechazar un plan clínico'
);

select pruebas.afirmar(
  (select estado from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000103') = 'rechazado'
  and (select vigente from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000003'),
  'rechazar no dejó el borrador rechazado y el vigente intacto'
);

select pruebas.afirmar(
  (select estado from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000102') = 'borrador',
  'el borrador de riesgo alto cambió sin Bryan'
);

-- Escribir directamente, ni con la capacidad: sin privilegio.
do $$
begin
  begin
    update public.aprobaciones_plan_estrategico set estado = 'aprobado' where id = 'c7000000-0000-0000-0000-000000000002';
    raise exception 'FALLO: Manuela actualizó la tabla sin pasar por la RPC';
  exception when insufficient_privilege then
    null;
  end;
end $$;

do $$
begin
  begin
    update public.planes_estrategicos set vigente = true where id = 'd7000000-0000-0000-0000-000000000102';
    raise exception 'FALLO: Manuela encendió un borrador sin pasar por la RPC';
  exception when insufficient_privilege then
    null;
  end;
end $$;

do $$
begin
  begin
    perform public.vencer_plan_estrategico();
    raise exception 'FALLO: authenticated pudo llamar a vencer_plan_estrategico';
  exception when insufficient_privilege then
    null;
  end;
end $$;

do $$
begin
  begin
    perform public.encender_plan_estrategico('d7000000-0000-0000-0000-000000000102', 'hash-v2-2');
    raise exception 'FALLO: authenticated pudo llamar a encender_plan_estrategico';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

-- El asesorado no ve su borrador rechazado.
select pruebas.soy('a7000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.afirmar(
  (select count(*) from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000103') = 0,
  'el asesorado ve su borrador RECHAZADO'
);
reset role;

select pruebas.soy('b7000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select (public.decidir_plan_estrategico('c7000000-0000-0000-0000-000000000002', 'aprobar', 'revisado en llamada')).estado) = 'aprobado',
  'Bryan (autorizar_excepcion) no pudo aprobar el riesgo alto'
);

select pruebas.afirmar(
  (select count(*) from public.planes_estrategicos
    where usuario_id = 'a7000000-0000-0000-0000-000000000002' and vigente) = 1
  and (select estado from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000102') = 'vigente',
  'la aprobación de Bryan no encendió el borrador'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · Staff sin aprobar_plan_estrategico no decide
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('b7000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.aprobaciones_plan_estrategico where id = 'c7000000-0000-0000-0000-000000000008') = 1,
  'staff con leer_entrenamiento no ve la bandeja (falso negativo: revisa la semilla)'
);

do $$
begin
  begin
    perform public.decidir_plan_estrategico('c7000000-0000-0000-0000-000000000008', 'aprobar', null);
    raise exception 'FALLO: staff sin aprobar_plan_estrategico aprobó un plan renovado';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 5 · vencer_plan_estrategico()
-- ════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', '', false);
set role service_role;

select pruebas.afirmar(
  (select aprobados from public.vencer_plan_estrategico()) = 1,
  'vencer_plan_estrategico no aprobó exactamente un plan (el bajo sin dudas)'
);

reset role;

select pruebas.afirmar(
  (select estado from public.aprobaciones_plan_estrategico where id = 'c7000000-0000-0000-0000-000000000004') = 'vencido_aprobado'
  and (select decidido_por from public.aprobaciones_plan_estrategico where id = 'c7000000-0000-0000-0000-000000000004') is null
  and (select estado from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000104') = 'vigente'
  and (select count(*) from public.planes_estrategicos
        where usuario_id = 'a7000000-0000-0000-0000-000000000004' and vigente) = 1,
  'el bajo sin dudas no pasó solo al vencer, o dejó más de un vigente'
);

select pruebas.afirmar(
  (select estado from public.aprobaciones_plan_estrategico where id = 'c7000000-0000-0000-0000-000000000005') = 'espera_bryan'
  and (select estado from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000105') = 'borrador',
  'el riesgo medio pasó solo al vencer'
);

select pruebas.afirmar(
  (select estado from public.aprobaciones_plan_estrategico where id = 'c7000000-0000-0000-0000-000000000006') = 'espera_bryan'
  and (select motivo_espera from public.aprobaciones_plan_estrategico where id = 'c7000000-0000-0000-0000-000000000006') like '%Bryan%',
  'el bajo con preguntas para Bryan pasó solo, o no dejó escrito por qué espera'
);

select pruebas.afirmar(
  (select estado from public.aprobaciones_plan_estrategico where id = 'c7000000-0000-0000-0000-000000000007') = 'espera_bryan'
  and (select estado from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000107') = 'borrador',
  'el clínico marcado de riesgo bajo pasó solo al vencer'
);

select pruebas.afirmar(
  (select estado from public.aprobaciones_plan_estrategico where id = 'c7000000-0000-0000-0000-000000000008') = 'propuesto',
  'vencer_plan_estrategico tocó un plan cuyo plazo no había vencido'
);

-- Lo que espera a Bryan: Manuela ya no lo aprueba.
select pruebas.soy('b7000000-0000-0000-0000-000000000001');
set role authenticated;

do $$
begin
  begin
    perform public.decidir_plan_estrategico('c7000000-0000-0000-0000-000000000005', 'aprobar', null);
    raise exception 'FALLO: Manuela aprobó algo que ya esperaba a Bryan';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;

-- El importador viejo (subir_a_consola.py) sigue pudiendo apagar y encender sin `estado`.
update public.planes_estrategicos set vigente = false
 where usuario_id = 'a7000000-0000-0000-0000-000000000008' and vigente;
insert into public.planes_estrategicos (usuario_id, version, vigente, contenido, hash)
values ('a7000000-0000-0000-0000-000000000008', 3, true, '{}'::jsonb, 'hash-v3-8');

select pruebas.afirmar(
  (select estado from public.planes_estrategicos where id = 'd7000000-0000-0000-0000-000000000008') = 'reemplazado'
  and (select estado from public.planes_estrategicos
        where usuario_id = 'a7000000-0000-0000-0000-000000000008' and version = 3) = 'vigente',
  'el importador sin estado no deja reemplazado el viejo y vigente el nuevo'
);

rollback;

\echo 'OK · aprobación del plan estratégico renovado (0087)'
