-- Praxis: lexicón por persona (0171). Migración SIN APLICAR en producción; esta prueba corre en el CI sobre una base
-- vacía con todas las migraciones.
--
-- QUÉ SE COMPRUEBA (contra RLS y privilegios de verdad):
--   1. Elegir igual suma 1; distinto vuelve a 1 con el valor nuevo.
--   2. Campos que no aprenden (hambre, dolor), valores fuera de la escala del campo y formas largas o con signos: rechazados.
--   3. Nadie escribe directo en la tabla.
--   4. Cada persona lee SOLO lo suyo; el coach tampoco ve lo de la asesorada.
--   5. Olvidar borra todo lo propio y nada ajeno.
--   6. anon y sin sesión se niegan.
-- Bloque de UUID propio (fa…). Termina en ROLLBACK.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('fa000000-0000-0000-0000-000000000001', 'lexico-asesorada@ejemplo.test'),
  ('fa000000-0000-0000-0000-000000000002', 'lexico-coach@ejemplo.test'),
  ('fa000000-0000-0000-0000-000000000003', 'lexico-otra@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('fa000000-0000-0000-0000-000000000001', 'Asesorada de prueba', 'asesorado', 'AS'),
  ('fa000000-0000-0000-0000-000000000002', 'Coach de prueba', 'coach', 'CO'),
  ('fa000000-0000-0000-0000-000000000003', 'Otra de prueba', 'asesorado', 'OT')
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

select pruebas.soy('fa000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

do $$
declare r jsonb;
begin
  -- 1 · Igual suma; distinto vuelve a 1
  perform public.praxis_aprender_forma('estres', 'como medio', 'MUCHO');
  perform public.praxis_aprender_forma('estres', 'como medio', 'MUCHO');
  r := public.praxis_aprender_forma('estres', 'como medio', 'MUCHO');
  perform pruebas.afirmar((r->>'confirmaciones')::int = 3, 'tres iguales no dieron 3');
  r := public.praxis_aprender_forma('estres', 'como medio', 'REGULAR');
  perform pruebas.afirmar((r->>'confirmaciones')::int = 1 and r->>'valor' = 'REGULAR', 'uno distinto no volvio a 1 con el valor nuevo');
  perform public.praxis_aprender_forma('rendimiento', 'no tan bien', 'MALA');

  -- 2 · Rechazos
  begin perform public.praxis_aprender_forma('hambreEscala', 'como medio', 'REGULAR'); raise exception 'FALLO: aprendio el hambre';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aprender_forma('dolor', 'como medio', 'REGULAR'); raise exception 'FALLO: aprendio el dolor';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aprender_forma('estres', 'como medio', 'MALA'); raise exception 'FALLO: guardo MALA en estres';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aprender_forma('estres', 'hoy me siento como medio raro con mi jefe', 'REGULAR'); raise exception 'FALLO: guardo una frase larga';
  exception when invalid_parameter_value then null; end;
  begin perform public.praxis_aprender_forma('estres', 'Como Medio, ¿no?', 'REGULAR'); raise exception 'FALLO: guardo una forma sin normalizar';
  exception when invalid_parameter_value then null; end;

  -- 3 · Nadie escribe directo
  begin insert into public.praxis_lexico_persona (usuario_id, campo, forma, valor) values (auth.uid(), 'estres', 'ahi', 'POCO');
    raise exception 'FALLO: insert directo en el lexicon';
  exception when insufficient_privilege then null; end;
  begin update public.praxis_lexico_persona set confirmaciones = 99; raise exception 'FALLO: update directo en el lexicon';
  exception when insufficient_privilege then null; end;

  perform pruebas.afirmar((select count(*) from public.praxis_lexico_persona) = 2, 'la asesorada no ve sus 2 formas');
end $$;

-- 4 · La otra persona y el coach no ven lo de la asesorada
reset role;
select pruebas.soy('fa000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
do $$
begin
  perform public.praxis_aprender_forma('cansancio', 'ahi', 'MUCHO');
  perform pruebas.afirmar((select count(*) from public.praxis_lexico_persona) = 1, 'la otra ve formas ajenas');
end $$;

reset role;
select pruebas.soy('fa000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar((select count(*) from public.praxis_lexico_persona) = 0, 'el coach ve el lexicon de alguien');

-- 5 · Olvidar
reset role;
select pruebas.soy('fa000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar(public.praxis_olvidar_mis_formas() = 2, 'olvidar no borro las 2 formas propias');
reset role;
select pruebas.afirmar((select count(*) from public.praxis_lexico_persona where usuario_id = 'fa000000-0000-0000-0000-000000000003') = 1,
  'olvidar borro formas ajenas');

-- 6 · anon y sin sesión
set role anon;
do $$
begin
  begin perform public.praxis_aprender_forma('estres', 'ahi', 'POCO'); raise exception 'FALLO: anon aprendio';
  exception when insufficient_privilege then null; end;
  begin perform public.praxis_olvidar_mis_formas(); raise exception 'FALLO: anon olvido';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
do $$
begin
  begin perform public.praxis_aprender_forma('estres', 'ahi', 'POCO'); raise exception 'FALLO: aprendio sin sesion';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

\echo 'OK · lexicon por persona: suma y reinicia, solo campos y escalas validos, solo lo propio, olvidar (0171)'

rollback;
