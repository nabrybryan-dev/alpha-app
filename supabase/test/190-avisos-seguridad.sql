-- Avisos del advisor de seguridad (migración 0101).
--
-- Lo que se prueba, por rol (asesorado A y B, Manuela nutricionista, Bryan coach, staff
-- nutricionista sin capacidades, anon):
--   1. checkins_nutricion está en `security_invoker = on` (el ERROR del advisor).
--   2. Lo que ve cada rol NO cambia: el asesorado solo lo suyo; Bryan y cualquier staff
--      (Manuela incluida, que NO puede leer la tabla `checkins`) ven toda la cartera, con las
--      ocho columnas de siempre y sin `datos` entero; anon no lee ni ejecuta la función.
--   3. es_nutricionista() y firmo_yo() no las ejecuta anon ni public; authenticated sí.
--
-- Bloque de UUID propio (ec…/fc…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
insert into auth.users (id, email) values
  ('ec000000-0000-0000-0000-000000000001', 'as-asesorado-a@ejemplo.test'),
  ('ec000000-0000-0000-0000-000000000002', 'as-asesorado-b@ejemplo.test'),
  ('fc000000-0000-0000-0000-000000000001', 'as-manuela@ejemplo.test'),
  ('fc000000-0000-0000-0000-000000000002', 'as-bryan@ejemplo.test'),
  ('fc000000-0000-0000-0000-000000000003', 'as-staff-sin@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('ec000000-0000-0000-0000-000000000001', 'Asesorado A', 'asesorado', 'AA'),
  ('ec000000-0000-0000-0000-000000000002', 'Asesorado B', 'asesorado', 'AB'),
  ('fc000000-0000-0000-0000-000000000001', 'Manuela de prueba', 'nutricionista', 'MP'),
  ('fc000000-0000-0000-0000-000000000002', 'Bryan de prueba', 'coach', 'BP'),
  ('fc000000-0000-0000-0000-000000000003', 'Staff sin permisos', 'nutricionista', 'SP')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

-- Dos check-ins de A, uno de B, uno de Manuela (como asesorada), con campos NO nutricionales.
insert into public.checkins (id, usuario_id, fecha, datos) values
  ('as-a1', 'ec000000-0000-0000-0000-000000000001', '2026-09-01',
   '{"pesoKg": 70.5, "hambre": "POCO", "alimentacion": "bien", "hambreEscala": 3, "estres": 9, "comentarios": "privado A1"}'),
  ('as-a2', 'ec000000-0000-0000-0000-000000000001', '2026-09-02',
   '{"pesoKg": 70.2, "hambre": "MUCHO", "alimentacion": "mal", "comentarios": "privado A2"}'),
  ('as-b1', 'ec000000-0000-0000-0000-000000000002', '2026-09-01',
   '{"pesoKg": 82, "hambre": "MEDIO", "alimentacion": "regular", "estres": 4}'),
  ('as-m1', 'fc000000-0000-0000-0000-000000000001', '2026-09-01',
   '{"pesoKg": 60, "hambre": "POCO", "alimentacion": "bien"}');

-- ════════════════════════════════════════════════════════════════════════
-- 1 · La vista es invoker; la función que la alimenta no es ejecutable por anon
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar(
  coalesce((select c.reloptions @> array['security_invoker=on']
              from pg_class c where c.oid = 'public.checkins_nutricion'::regclass), false),
  'checkins_nutricion no quedó con security_invoker = on'
);
select pruebas.afirmar(
  not has_function_privilege('anon', 'public.checkins_nutricion_datos()', 'execute')
  and not has_function_privilege('public', 'public.checkins_nutricion_datos()', 'execute')
  and has_function_privilege('authenticated', 'public.checkins_nutricion_datos()', 'execute'),
  'checkins_nutricion_datos() ejecutable por anon/public, o no por authenticated'
);
-- Mismas ocho columnas, mismo orden que la 0049; y ninguna es `datos`.
select pruebas.afirmar(
  (select array_agg(column_name::text order by ordinal_position)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'checkins_nutricion')
  = array['id','usuario_id','fecha','peso_kg','hambre','alimentacion','hambre_escala','actualizado_en'],
  'checkins_nutricion cambió de columnas o de orden'
);

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Asesorados A y B: solo lo suyo
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('ec000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.checkins_nutricion) = 2
  and (select count(*) from public.checkins_nutricion where usuario_id = 'ec000000-0000-0000-0000-000000000001') = 2,
  'A no ve exactamente sus dos check-ins por la vista'
);
select pruebas.afirmar(
  (select peso_kg from public.checkins_nutricion where id = 'as-a1') = 70.5
  and (select hambre from public.checkins_nutricion where id = 'as-a1') = 'POCO'
  and (select alimentacion from public.checkins_nutricion where id = 'as-a1') = 'bien'
  and (select hambre_escala from public.checkins_nutricion where id = 'as-a1') = 3
  and (select actualizado_en from public.checkins_nutricion where id = 'as-a1') is not null,
  'la vista no trae los valores nutricionales del check-in'
);
reset role;

select pruebas.soy('ec000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.checkins_nutricion) = 1
  and (select id from public.checkins_nutricion) = 'as-b1',
  'B no ve solo el suyo'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Manuela (nutricionista): toda la cartera por la vista, solo lo suyo por la tabla
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('fc000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.checkins_nutricion where id like 'as-%') = 4,
  'Manuela dejó de ver toda la cartera en checkins_nutricion'
);
select pruebas.afirmar(
  (select count(*) from public.checkins where id like 'as-%') = 1,
  'Manuela lee de la tabla checkins más que lo suyo'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · Bryan (coach) y staff nutricionista sin capacidades: toda la cartera, igual que antes
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('fc000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.checkins_nutricion where id like 'as-%') = 4,
  'Bryan no ve toda la cartera en checkins_nutricion'
);
reset role;

select pruebas.soy('fc000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.checkins_nutricion where id like 'as-%') = 4
  and (select count(*) from public.checkins where id like 'as-%') = 0,
  'el staff sin capacidades ve distinto que antes (toda la cartera por la vista, nada por la tabla)'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Funciones de firma: authenticated sí, anon/public no
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar(
  has_function_privilege('authenticated', 'public.es_nutricionista()', 'execute')
  and has_function_privilege('authenticated', 'public.firmo_yo(text)', 'execute')
  and has_function_privilege('service_role', 'public.es_nutricionista()', 'execute')
  and has_function_privilege('service_role', 'public.firmo_yo(text)', 'execute'),
  'authenticated o service_role perdió es_nutricionista()/firmo_yo()'
);
select pruebas.afirmar(
  not has_function_privilege('anon', 'public.es_nutricionista()', 'execute')
  and not has_function_privilege('anon', 'public.firmo_yo(text)', 'execute')
  and not has_function_privilege('public', 'public.es_nutricionista()', 'execute')
  and not has_function_privilege('public', 'public.firmo_yo(text)', 'execute'),
  'anon o public todavía ejecutan es_nutricionista()/firmo_yo()'
);

-- Las políticas de borradores siguen igual para quien tiene sesión (0067).
select pruebas.soy('fc000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar(
  public.es_nutricionista() and not public.es_coach() and public.firmo_yo('borrador-nutri')
  and not public.firmo_yo('borrador-coach') and not public.firmo_yo('humano'),
  'Manuela ya no firma sus borradores o firma los del coach'
);
reset role;
select pruebas.soy('fc000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.afirmar(
  not public.es_nutricionista() and public.firmo_yo('borrador-coach') and not public.firmo_yo('borrador-nutri'),
  'Bryan firma los borradores de la nutricionista o no los suyos'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 6 · anon no toca nada
-- ════════════════════════════════════════════════════════════════════════
set role anon;
do $$
begin
  begin
    perform 1 from public.checkins_nutricion limit 1;
    raise exception 'FALLO: anon pudo leer checkins_nutricion';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.checkins_nutricion_datos();
    raise exception 'FALLO: anon pudo ejecutar checkins_nutricion_datos()';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.es_nutricionista();
    raise exception 'FALLO: anon pudo ejecutar es_nutricionista()';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.firmo_yo('borrador-nutri');
    raise exception 'FALLO: anon pudo ejecutar firmo_yo()';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;

\echo 'OK · avisos de seguridad (0101)'
