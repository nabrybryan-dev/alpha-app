-- El interruptor de la regla de ventana (0170, sobre 0141 y 0143).
--
-- Qué se prueba:
--   1. El staff SIN la capacidad lee el estado, pero no enciende ni apaga.
--   2. Con la capacidad `encender_regla_ventana` se enciende y se apaga; cada cambio queda en
--      `cambios_regla_ventana` con quién y la nota, y `estado_regla_ventana` devuelve el último.
--   3. Un asesorado no lee el estado; anon no ejecuta ninguna de las tres funciones.
--   4. Las tablas siguen sin leerse desde `authenticated` (el estado solo sale por la función).
-- Bloque de UUID propio (f7…). ROLLBACK al final: la regla queda como estaba.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('f7000000-0000-0000-0000-000000000001', 'rv-asesorada@ejemplo.test'),
  ('f7000000-0000-0000-0000-000000000002', 'rv-coach-sin@ejemplo.test'),
  ('f7000000-0000-0000-0000-000000000003', 'rv-coach-con@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('f7000000-0000-0000-0000-000000000001', 'Asesorada regla de prueba', 'asesorado', 'AR'),
  ('f7000000-0000-0000-0000-000000000002', 'Coach sin interruptor', 'coach', 'CS'),
  ('f7000000-0000-0000-0000-000000000003', 'Coach con interruptor', 'coach', 'CC')
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('f7000000-0000-0000-0000-000000000003', 'encender_regla_ventana');

update public.regla_ventana_primer_plan set activa = false where id;

-- ─ 1 · Staff sin la capacidad ───────────────────────────────────────────
select pruebas.soy('f7000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar((public.estado_regla_ventana() ->> 'activa')::boolean = false,
  'el staff no leyó la regla apagada');

do $$
begin
  begin
    perform public.encender_regla_ventana('no debería');
    raise exception 'FALLO: un staff sin la capacidad encendió la regla';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.apagar_regla_ventana('no debería');
    raise exception 'FALLO: un staff sin la capacidad apagó la regla';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.regla_ventana_primer_plan;
    raise exception 'FALLO: authenticated lee la tabla de la regla directo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.cambios_regla_ventana;
    raise exception 'FALLO: authenticated lee el registro de cambios directo';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- ─ 2 · Con la capacidad: enciende, se ve quién; apaga, se ve quién ────────
select pruebas.soy('f7000000-0000-0000-0000-000000000003');
select public.encender_regla_ventana('prueba de encendido');

select pruebas.afirmar(
  (public.estado_regla_ventana() ->> 'activa')::boolean
  and public.estado_regla_ventana() -> 'ultimo_cambio' ->> 'activa_despues' = 'true'
  and public.estado_regla_ventana() -> 'ultimo_cambio' ->> 'hecho_por' = 'f7000000-0000-0000-0000-000000000003'
  and public.estado_regla_ventana() -> 'ultimo_cambio' ->> 'hecho_por_nombre' = 'Coach con interruptor'
  and public.estado_regla_ventana() -> 'ultimo_cambio' ->> 'nota' = 'prueba de encendido',
  'tras encender, el estado no dice encendida, quién ni la nota');

select public.apagar_regla_ventana('prueba de apagado');

select pruebas.afirmar(
  (public.estado_regla_ventana() ->> 'activa')::boolean = false
  and public.estado_regla_ventana() -> 'ultimo_cambio' ->> 'activa_despues' = 'false'
  and public.estado_regla_ventana() -> 'ultimo_cambio' ->> 'nota' = 'prueba de apagado',
  'tras apagar, el estado no dice apagada o no enseña el último cambio');

-- ─ 3 · Asesorado y anon ───────────────────────────────────────────────────
select pruebas.soy('f7000000-0000-0000-0000-000000000001');
do $$
begin
  begin
    perform public.estado_regla_ventana();
    raise exception 'FALLO: un asesorado leyó el estado de la regla';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;

select pruebas.afirmar(
  (select count(*) from public.cambios_regla_ventana
    where hecho_por = 'f7000000-0000-0000-0000-000000000003' and rol_sesion is not null) = 2,
  'el registro de la 0143 no anotó los dos cambios de la cuenta con la capacidad');

select pruebas.afirmar(
  not has_function_privilege('anon', 'public.estado_regla_ventana()', 'execute')
  and not has_function_privilege('anon', 'public.apagar_regla_ventana(text)', 'execute')
  and not has_function_privilege('anon', 'public.encender_regla_ventana(text)', 'execute'),
  'anon puede ejecutar alguna función del interruptor');

rollback;
