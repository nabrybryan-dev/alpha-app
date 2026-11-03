-- Aprobación de los PARÁMETROS de un plan renovado, aparte del plan (migración 0158).
--
-- Lo que se prueba, en el orden de la decisión de Bryan (2-nov):
--
--   0. La tabla tiene RLS encendida.
--   1. Quien tiene aprobar_plan_estrategico (el coach) aprueba: queda la fila con SU cuenta
--      como firmante, y aprobar de nuevo es un upsert (sigue habiendo una sola fila).
--   2. Las claves en otro orden son los mismos parámetros: se aprueba igual.
--   3. Un valor cambiado falla («los valores cambiaron») y no deja fila.
--   4. No se arrastra: aprobar los parámetros del plan 1 no aprueba los del plan 2, aunque los
--      valores sean idénticos; el plan 2 pide su propia firma.
--   5. anon no puede (ni la RPC ni la tabla); un asesorado no puede; staff sin la capacidad no
--      puede ni lee.
--   6. La fila no se edita a mano: ni insert, ni update, ni delete desde una sesión.
--   7. Un plan que ya se decidió (rechazado) no admite aprobar parámetros.
--   8. Aprobar los parámetros NO decide el plan (la aprobación del plan sigue 'propuesto').
--
-- Bloque de UUID propio (a0158…/b0158…/c0158…/d0158…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
-- a0158..01 y ..02 asesorados con plan renovado · b0158..01 coach con aprobar_plan_estrategico
-- b0158..02 staff sin esa capacidad
insert into auth.users (id, email) values
  ('a0158000-0000-0000-0000-000000000001', 'pa-uno@ejemplo.test'),
  ('a0158000-0000-0000-0000-000000000002', 'pa-dos@ejemplo.test'),
  ('b0158000-0000-0000-0000-000000000001', 'pa-coach@ejemplo.test'),
  ('b0158000-0000-0000-0000-000000000002', 'pa-staff-sin@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('a0158000-0000-0000-0000-000000000001', 'Parametros uno', 'asesorado', 'PU'),
  ('a0158000-0000-0000-0000-000000000002', 'Parametros dos', 'asesorado', 'PD'),
  ('b0158000-0000-0000-0000-000000000001', 'Coach de prueba', 'coach', 'CP'),
  ('b0158000-0000-0000-0000-000000000002', 'Staff sin capacidad', 'nutricionista', 'SC')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('b0158000-0000-0000-0000-000000000001', 'leer_entrenamiento'),
  ('b0158000-0000-0000-0000-000000000001', 'aprobar_plan_estrategico')
on conflict do nothing;

-- Versión 1 vigente y versión 2 borrador para cada asesorado. Los borradores traen los MISMOS
-- parámetros en las dos personas (la prueba 4 los necesita idénticos) y la clave `aprobacion`,
-- que es del agente y no cuenta como parámetro.
insert into public.planes_estrategicos (id, usuario_id, version, vigente, contenido, hash)
select ('d0158000-0000-0000-0000-00000000000' || n)::uuid,
       ('a0158000-0000-0000-0000-00000000000' || n)::uuid,
       1, true, '{"objetivo_largo_plazo": "base"}'::jsonb, 'hash-pa-v1-' || n
  from generate_series(1, 2) n;

insert into public.planes_estrategicos (id, usuario_id, version, vigente, contenido, hash)
select ('d0158000-0000-0000-0000-00000000001' || n)::uuid,
       ('a0158000-0000-0000-0000-00000000000' || n)::uuid,
       2, false,
       '{"objetivo_largo_plazo": "renovado",
         "parametros_para_decidir": {"frecuencia_semanal": 4, "pasos_dia": 8000, "rir_objetivo": "2",
                                      "aprobacion": {"estado": "pendiente"}}}'::jsonb,
       'hash-pa-v2-' || n
  from generate_series(1, 2) n;

insert into public.aprobaciones_plan_estrategico
  (id, usuario_id, plan_id, hash, riesgo, clinico, dudas_pendientes, preguntas_para_bryan, justificacion, plazo_hasta) values
  ('c0158000-0000-0000-0000-000000000001', 'a0158000-0000-0000-0000-000000000001', 'd0158000-0000-0000-0000-000000000011', 'hash-pa-v2-1',
   'bajo', false, '{}', '[]', '[]', now() + interval '1 day'),
  ('c0158000-0000-0000-0000-000000000002', 'a0158000-0000-0000-0000-000000000002', 'd0158000-0000-0000-0000-000000000012', 'hash-pa-v2-2',
   'bajo', false, '{}', '[]', '[]', now() + interval '1 day');

-- 0 · RLS encendida.
select pruebas.afirmar(
  (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.parametros_aprobados')),
  'parametros_aprobados no tiene RLS'
);

-- ─────────────────── Como el coach ───────────────────
set role authenticated;
select pruebas.soy('b0158000-0000-0000-0000-000000000001');
select pruebas.exigir_rls();

-- 1 · El coach aprueba, firma con su cuenta, y aprobar otra vez es un upsert.
select public.aprobar_parametros_plan(
  'c0158000-0000-0000-0000-000000000001',
  '{"frecuencia_semanal": 4, "pasos_dia": 8000, "rir_objetivo": "2"}'::jsonb);

select pruebas.afirmar(
  (select aprobado_por from public.parametros_aprobados
    where plan_renovado_id = 'c0158000-0000-0000-0000-000000000001') = 'b0158000-0000-0000-0000-000000000001',
  'la firma no es la cuenta del coach'
);

-- 2 · Claves en otro orden: mismos parámetros.
select public.aprobar_parametros_plan(
  'c0158000-0000-0000-0000-000000000001',
  '{"rir_objetivo": "2", "pasos_dia": 8000, "frecuencia_semanal": 4}'::jsonb);

select pruebas.afirmar(
  (select count(*) from public.parametros_aprobados
    where plan_renovado_id = 'c0158000-0000-0000-0000-000000000001') = 1,
  'aprobar dos veces dejó más de una fila (no es upsert)'
);

-- 3 · Un valor cambiado falla y no deja fila (se prueba sobre el plan 2, aún sin firma).
do $$
begin
  begin
    perform public.aprobar_parametros_plan(
      'c0158000-0000-0000-0000-000000000002',
      '{"frecuencia_semanal": 4, "pasos_dia": 9000, "rir_objetivo": "2"}'::jsonb);
    raise exception 'FALLO: se aprobó un parámetro con un valor distinto al del plan';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
      if sqlerrm not like '%cambiaron%' then
        raise exception 'FALLO: error inesperado al aprobar un valor cambiado: %', sqlerrm;
      end if;
  end;
end $$;

do $$
begin
  begin
    -- Una clave de menos tampoco es lo mismo.
    perform public.aprobar_parametros_plan(
      'c0158000-0000-0000-0000-000000000002',
      '{"frecuencia_semanal": 4, "pasos_dia": 8000}'::jsonb);
    raise exception 'FALLO: se aprobó con una clave de menos';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- 4 · No se arrastra: el plan 2 sigue sin firma aunque tenga los mismos valores.
select pruebas.afirmar(
  (select count(*) from public.parametros_aprobados
    where plan_renovado_id = 'c0158000-0000-0000-0000-000000000002') = 0,
  'la aprobación del plan 1 se arrastró al plan 2'
);

select public.aprobar_parametros_plan(
  'c0158000-0000-0000-0000-000000000002',
  '{"frecuencia_semanal": 4, "pasos_dia": 8000, "rir_objetivo": "2"}'::jsonb);

select pruebas.afirmar(
  (select count(*) from public.parametros_aprobados) = 2,
  'cada plan debía tener su propia fila'
);

-- 6 · La fila no se edita a mano (ni siquiera el coach que firmó).
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

-- 8 · Aprobar los parámetros no decide el plan.
select pruebas.afirmar(
  (select count(*) from public.aprobaciones_plan_estrategico
    where id::text like 'c0158000-%' and estado = 'propuesto') = 2
  and (select count(*) from public.planes_estrategicos
        where id::text like 'd0158000-%' and version = 2 and estado = 'borrador') = 2,
  'aprobar los parámetros movió el estado del plan'
);

-- ─────────────────── anon ───────────────────
set role anon;

do $$
begin
  begin
    perform public.aprobar_parametros_plan(
      'c0158000-0000-0000-0000-000000000001',
      '{"frecuencia_semanal": 4, "pasos_dia": 8000, "rir_objetivo": "2"}'::jsonb);
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

-- ─────────────────── Un asesorado ───────────────────
set role authenticated;
select pruebas.soy('a0158000-0000-0000-0000-000000000001');
select pruebas.exigir_rls();

do $$
begin
  begin
    perform public.aprobar_parametros_plan(
      'c0158000-0000-0000-0000-000000000001',
      '{"frecuencia_semanal": 4, "pasos_dia": 8000, "rir_objetivo": "2"}'::jsonb);
    raise exception 'FALLO: un asesorado aprobó parámetros';
  exception when insufficient_privilege then null;
  end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.parametros_aprobados) = 0,
  'un asesorado lee las aprobaciones de parámetros'
);

reset role;

-- ─────────────────── Staff sin la capacidad ───────────────────
set role authenticated;
select pruebas.soy('b0158000-0000-0000-0000-000000000002');
select pruebas.exigir_rls();

do $$
begin
  begin
    perform public.aprobar_parametros_plan(
      'c0158000-0000-0000-0000-000000000001',
      '{"frecuencia_semanal": 4, "pasos_dia": 8000, "rir_objetivo": "2"}'::jsonb);
    raise exception 'FALLO: staff sin aprobar_plan_estrategico aprobó parámetros';
  exception when insufficient_privilege then null;
  end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.parametros_aprobados) = 0,
  'staff sin capacidad lee las aprobaciones de parámetros'
);

reset role;

-- 7 · Un plan ya decidido no admite aprobar parámetros.
update public.aprobaciones_plan_estrategico
   set estado = 'rechazado', decidido_por = 'b0158000-0000-0000-0000-000000000001',
       decidido_en = now(), motivo = 'prueba'
 where id = 'c0158000-0000-0000-0000-000000000002';

set role authenticated;
select pruebas.soy('b0158000-0000-0000-0000-000000000001');

do $$
begin
  begin
    perform public.aprobar_parametros_plan(
      'c0158000-0000-0000-0000-000000000002',
      '{"frecuencia_semanal": 4, "pasos_dia": 8000, "rir_objetivo": "2"}'::jsonb);
    raise exception 'FALLO: se aprobaron parámetros de un plan ya rechazado';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

reset role;

rollback;

\echo 'OK · aprobación de parámetros del plan renovado (0158)'
