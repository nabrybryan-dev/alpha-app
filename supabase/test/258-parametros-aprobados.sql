-- Aprobación de los PARÁMETROS de un plan renovado, aparte del plan (migración 0158).
--
-- Lo que se prueba (decisiones de Bryan, 2-nov):
--
--   0. La tabla tiene RLS encendida.
--   1. Firma SOLO el coach (es_coach): aprueba y queda su cuenta como firmante; aprobar otra vez
--      es un upsert. Manuela (nutricionista con aprobar_plan_estrategico) NO puede.
--   2. Las claves en otro orden son los mismos parámetros.
--   3. Un valor cambiado falla («Los valores cambiaron») y no deja fila. Una clave de menos
--      también. 4 frente a "4" cuentan como DISTINTOS (comportamiento documentado, no se cambia).
--   4. No se arrastra: aprobar los parámetros del plan 1 no aprueba los del plan 2.
--   5. Exactamente diez valores: un plan con sección vacía, de 9 o de 11 claves no se aprueba;
--      un plan sin sección tampoco; p_parametros null o que no es objeto, tampoco.
--   6. Vence: si cambia el contenido del plan, aprobar con los valores viejos falla.
--   7. anon, un asesorado y staff sin ser coach no pueden; la fila no se edita a mano.
--   8. Aprobar el PLAN (decidir_plan_estrategico) no crea fila de parámetros, y aprobar los
--      parámetros no decide el plan.
--   9. Un plan ya decidido no admite aprobar parámetros.
--
-- Bloque de UUID propio (a0158…/b0158…/c0158…/d0158…). ROLLBACK al final.
-- Los nombres p01…p10 son de relleno: los reales los escribe el agente.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
-- Asesorados a..01 (aprueba y vence) · ..02 (no se arrastra y rechazo) · ..03 (Manuela aprueba el plan)
-- ..04 sin sección · ..05 con 9 claves · ..06 con 11 claves · ..07 sección vacía
-- b..01 coach (rol coach + capacidad) · b..02 staff sin capacidad · b..03 Manuela
-- (nutricionista con aprobar_plan_estrategico, sin ser coach)
insert into auth.users (id, email)
select ('a0158000-0000-0000-0000-00000000000' || n)::uuid, 'pa-' || n || '@ejemplo.test'
  from generate_series(1, 7) n
union all
select ('b0158000-0000-0000-0000-00000000000' || n)::uuid, 'pa-staff-' || n || '@ejemplo.test'
  from generate_series(1, 3) n
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales)
select ('a0158000-0000-0000-0000-00000000000' || n)::uuid, 'Parametros ' || n, 'asesorado', 'P' || n
  from generate_series(1, 7) n
union all values
  ('b0158000-0000-0000-0000-000000000001'::uuid, 'Coach de prueba', 'coach', 'CP'),
  ('b0158000-0000-0000-0000-000000000002'::uuid, 'Staff sin capacidad', 'nutricionista', 'SC'),
  ('b0158000-0000-0000-0000-000000000003'::uuid, 'Manuela de prueba', 'nutricionista', 'MP')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('b0158000-0000-0000-0000-000000000001', 'leer_entrenamiento'),
  ('b0158000-0000-0000-0000-000000000001', 'aprobar_plan_estrategico'),
  ('b0158000-0000-0000-0000-000000000003', 'leer_entrenamiento'),
  ('b0158000-0000-0000-0000-000000000003', 'aprobar_plan_estrategico')
on conflict do nothing;

insert into public.planes_estrategicos (id, usuario_id, version, vigente, contenido, hash)
select ('d0158000-0000-0000-0000-00000000000' || n)::uuid,
       ('a0158000-0000-0000-0000-00000000000' || n)::uuid,
       1, true, '{"objetivo_largo_plazo": "base"}'::jsonb, 'hash-pa-v1-' || n
  from generate_series(1, 7) n;

-- Borradores v2. Planes 1-3: diez parámetros y la clave `aprobacion` (del agente, no cuenta).
-- 4: sin sección · 5: 9 claves · 6: 11 claves · 7: sección vacía.
insert into public.planes_estrategicos (id, usuario_id, version, vigente, contenido, hash)
select ('d0158000-0000-0000-0000-00000000001' || n)::uuid,
       ('a0158000-0000-0000-0000-00000000000' || n)::uuid,
       2, false,
       case
         when n <= 3 then
           '{"objetivo_largo_plazo": "renovado",
             "parametros_para_decidir": {"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6,
                                          "p07": 7, "p08": 8, "p09": 9, "p10": 10,
                                          "aprobacion": {"estado": "pendiente"}}}'::jsonb
         when n = 4 then '{"objetivo_largo_plazo": "renovado"}'::jsonb
         when n = 5 then
           '{"parametros_para_decidir": {"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6,
                                          "p07": 7, "p08": 8, "p09": 9}}'::jsonb
         when n = 6 then
           '{"parametros_para_decidir": {"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6,
                                          "p07": 7, "p08": 8, "p09": 9, "p10": 10, "p11": 11}}'::jsonb
         else '{"parametros_para_decidir": {"aprobacion": {"estado": "pendiente"}}}'::jsonb
       end,
       'hash-pa-v2-' || n
  from generate_series(1, 7) n;

insert into public.aprobaciones_plan_estrategico
  (id, usuario_id, plan_id, hash, riesgo, clinico, dudas_pendientes, preguntas_para_bryan, justificacion, plazo_hasta)
select ('c0158000-0000-0000-0000-00000000000' || n)::uuid,
       ('a0158000-0000-0000-0000-00000000000' || n)::uuid,
       ('d0158000-0000-0000-0000-00000000001' || n)::uuid,
       'hash-pa-v2-' || n, 'bajo', false, '{}', '[]', '[]', now() + interval '1 day'
  from generate_series(1, 7) n;

-- 0 · RLS encendida.
select pruebas.afirmar(
  (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.parametros_aprobados')),
  'parametros_aprobados no tiene RLS'
);

-- ─────────────────── Como Manuela: puede el plan, no los parámetros ───────────────────
set role authenticated;
select pruebas.soy('b0158000-0000-0000-0000-000000000003');
select pruebas.exigir_rls();

do $$
begin
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000001',
      '{"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9, "p10": 10}'::jsonb);
    raise exception 'FALLO: Manuela (no coach) aprobó parámetros';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 8a · Aprobar el PLAN no crea fila de parámetros.
select public.decidir_plan_estrategico('c0158000-0000-0000-0000-000000000003', 'aprobar', null);

select pruebas.afirmar(
  (select estado from public.aprobaciones_plan_estrategico where id = 'c0158000-0000-0000-0000-000000000003') = 'aprobado',
  'Manuela no pudo aprobar el plan (precondición de la prueba)'
);
select pruebas.afirmar(
  (select count(*) from public.parametros_aprobados) = 0,
  'aprobar el plan creó una fila de parámetros'
);

reset role;

-- ─────────────────── Como el coach ───────────────────
set role authenticated;
select pruebas.soy('b0158000-0000-0000-0000-000000000001');
select pruebas.exigir_rls();

-- 1 · El coach aprueba y firma con su cuenta; aprobar otra vez es un upsert.
select public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000001',
  '{"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9, "p10": 10}'::jsonb);

select pruebas.afirmar(
  (select aprobado_por from public.parametros_aprobados
    where plan_renovado_id = 'c0158000-0000-0000-0000-000000000001') = 'b0158000-0000-0000-0000-000000000001',
  'la firma no es la cuenta del coach'
);

-- 2 · Claves en otro orden: mismos parámetros.
select public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000001',
  '{"p10": 10, "p09": 9, "p08": 8, "p07": 7, "p06": 6, "p05": 5, "p04": 4, "p03": 3, "p02": 2, "p01": 1}'::jsonb);

select pruebas.afirmar(
  (select count(*) from public.parametros_aprobados
    where plan_renovado_id = 'c0158000-0000-0000-0000-000000000001') = 1,
  'aprobar dos veces dejó más de una fila (no es upsert)'
);

-- 3 · Un valor cambiado, una clave de menos y 4 frente a "4" fallan (sobre el plan 2).
do $$
begin
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000002',
      '{"p01": 1, "p02": 99, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9, "p10": 10}'::jsonb);
    raise exception 'FALLO: se aprobó un parámetro con un valor distinto al del plan';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
    if sqlerrm not like 'Los valores cambiaron%' then raise exception 'FALLO: error inesperado (valor cambiado): %', sqlerrm; end if;
  end;
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000002',
      '{"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9}'::jsonb);
    raise exception 'FALLO: se aprobó con una clave de menos';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
    if sqlerrm not like 'Los valores cambiaron%' then raise exception 'FALLO: error inesperado (clave de menos): %', sqlerrm; end if;
  end;
  -- Documentado: el tipo cuenta. jsonb distingue 1 de "1", así que NO se aprueba.
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000002',
      '{"p01": "1", "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9, "p10": 10}'::jsonb);
    raise exception 'FALLO: 1 y "1" se trataron como el mismo valor';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
    if sqlerrm not like 'Los valores cambiaron%' then raise exception 'FALLO: error inesperado (1 frente a "1"): %', sqlerrm; end if;
  end;
end $$;

-- 3e · Y no quedó fila del plan 2.
select pruebas.afirmar(
  (select count(*) from public.parametros_aprobados
    where plan_renovado_id = 'c0158000-0000-0000-0000-000000000002') = 0,
  'un intento fallido dejó una fila de parámetros'
);

-- 4 · No se arrastra: el plan 2 pide su propia firma aunque los valores sean idénticos.
select public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000002',
  '{"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9, "p10": 10}'::jsonb);

select pruebas.afirmar(
  (select count(*) from public.parametros_aprobados) = 2,
  'cada plan debía tener su propia fila'
);

-- 5 · Exactamente diez: sin sección, vacía, 9 u 11 claves; y p_parametros mal formado.
do $$
begin
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000004',
      '{"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9, "p10": 10}'::jsonb);
    raise exception 'FALLO: se aprobó un plan sin parametros_para_decidir';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
    if sqlerrm not like '%no trae parámetros%' then raise exception 'FALLO: error inesperado (sin sección): %', sqlerrm; end if;
  end;
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000005',
      '{"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9}'::jsonb);
    raise exception 'FALLO: se aprobó un plan de 9 parámetros';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
    if sqlerrm not like 'El plan no trae los diez parámetros%' then raise exception 'FALLO: error inesperado (9 claves): %', sqlerrm; end if;
  end;
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000006',
      '{"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9, "p10": 10, "p11": 11}'::jsonb);
    raise exception 'FALLO: se aprobó un plan de 11 parámetros';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
    if sqlerrm not like 'El plan no trae los diez parámetros%' then raise exception 'FALLO: error inesperado (11 claves): %', sqlerrm; end if;
  end;
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000007', '{}'::jsonb);
    raise exception 'FALLO: se aprobó una sección vacía con {}';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
    if sqlerrm not like 'El plan no trae los diez parámetros%' then raise exception 'FALLO: error inesperado (sección vacía): %', sqlerrm; end if;
  end;
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000001', null);
    raise exception 'FALLO: se aprobó con p_parametros null';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000001', '[1, 2]'::jsonb);
    raise exception 'FALLO: se aprobó con p_parametros que es una lista';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000001', '"texto"'::jsonb);
    raise exception 'FALLO: se aprobó con p_parametros que es un texto';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.parametros_aprobados
    where plan_renovado_id in ('c0158000-0000-0000-0000-000000000004', 'c0158000-0000-0000-0000-000000000005',
                               'c0158000-0000-0000-0000-000000000006', 'c0158000-0000-0000-0000-000000000007')) = 0,
  'un plan sin los diez parámetros quedó con fila'
);

-- 7 · La fila no se edita a mano (ni siquiera el coach que firmó).
do $$
begin
  begin
    update public.parametros_aprobados set parametros = '{}'::jsonb;
    raise exception 'FALLO: el coach editó una aprobación a mano';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.parametros_aprobados (plan_renovado_id, parametros)
    values ('c0158000-0000-0000-0000-000000000001', '{}'::jsonb);
    raise exception 'FALLO: el coach insertó una aprobación a mano';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.parametros_aprobados;
    raise exception 'FALLO: el coach borró una aprobación a mano';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- 8b · Aprobar los parámetros no decide el plan.
select pruebas.afirmar(
  (select count(*) from public.aprobaciones_plan_estrategico
    where id in ('c0158000-0000-0000-0000-000000000001', 'c0158000-0000-0000-0000-000000000002')
      and estado = 'propuesto') = 2,
  'aprobar los parámetros movió el estado del plan'
);

-- 6 · Vence: cambia el contenido del plan y los valores viejos ya no se aprueban.
update public.planes_estrategicos
   set contenido = jsonb_set(contenido, '{parametros_para_decidir,p02}', '99'::jsonb)
 where id = 'd0158000-0000-0000-0000-000000000011';

set role authenticated;
select pruebas.soy('b0158000-0000-0000-0000-000000000001');

do $$
begin
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000001',
      '{"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9, "p10": 10}'::jsonb);
    raise exception 'FALLO: se aprobaron los valores viejos de un plan que cambió';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
    if sqlerrm not like 'Los valores cambiaron%' then raise exception 'FALLO: error inesperado (vencimiento): %', sqlerrm; end if;
  end;
end $$;

-- La fila vieja sigue diciendo lo que se aprobó (p02 = 2): la pantalla la ve vencida.
select pruebas.afirmar(
  (select (parametros ->> 'p02')::int from public.parametros_aprobados
    where plan_renovado_id = 'c0158000-0000-0000-0000-000000000001') = 2,
  'la fila aprobada cambió al cambiar el plan'
);

reset role;

-- ─────────────────── anon ───────────────────
set role anon;

do $$
begin
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000001',
      '{"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9, "p10": 10}'::jsonb);
    raise exception 'FALLO: anon ejecutó aprobar_parametros_plan';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.parametros_aprobados;
    raise exception 'FALLO: anon leyó parametros_aprobados';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- ─────────────────── Un asesorado y staff sin ser coach ───────────────────
set role authenticated;
select pruebas.soy('a0158000-0000-0000-0000-000000000001');
select pruebas.exigir_rls();

do $$
begin
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000001',
      '{"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9, "p10": 10}'::jsonb);
    raise exception 'FALLO: un asesorado aprobó parámetros';
  exception when insufficient_privilege then null;
  end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.parametros_aprobados) = 0,
  'un asesorado lee las aprobaciones de parámetros'
);

select pruebas.soy('b0158000-0000-0000-0000-000000000002');

do $$
begin
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000001',
      '{"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9, "p10": 10}'::jsonb);
    raise exception 'FALLO: staff que no es coach aprobó parámetros';
  exception when insufficient_privilege then null;
  end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.parametros_aprobados) = 0,
  'staff sin capacidad lee las aprobaciones de parámetros'
);

reset role;

-- 9 · Un plan ya decidido no admite aprobar parámetros.
update public.aprobaciones_plan_estrategico
   set estado = 'rechazado', decidido_por = 'b0158000-0000-0000-0000-000000000001',
       decidido_en = now(), motivo = 'prueba'
 where id = 'c0158000-0000-0000-0000-000000000002';

set role authenticated;
select pruebas.soy('b0158000-0000-0000-0000-000000000001');

do $$
begin
  begin
    perform public.aprobar_parametros_plan('c0158000-0000-0000-0000-000000000002',
      '{"p01": 1, "p02": 2, "p03": 3, "p04": 4, "p05": 5, "p06": 6, "p07": 7, "p08": 8, "p09": 9, "p10": 10}'::jsonb);
    raise exception 'FALLO: se aprobaron parámetros de un plan ya rechazado';
  exception when others then
    if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

reset role;

rollback;

\echo 'OK · aprobación de parámetros del plan renovado (0158)'
