-- Tablero de creadores, capa de lectura (migración 0090).
--
-- Lo que se prueba:
--   1. Quien tiene `revisar_creadores` (Manuela de prueba) y el coach LEEN las tres tablas.
--   2. Un asesorado y un staff sin la capacidad NO ven ninguna fila.
--   3. anon no lee nada (ni siquiera tiene privilegio de select).
--   4. Nadie escribe desde una sesión: insert/update/delete de authenticated fallan, también
--      para el coach y para quien tiene `firmar_creadores`.
--   5. `service_role` sí escribe (es el importador), y el event_id repetido no duplica.
--   6. Los checks de forma: creador_id `ig:<dígitos>`, carril conocido, revisor conocido.
--   7. El bucket `creadores-cuadros` es privado.
--   8. La 0092 lo vuelve privado aunque ya existiera público.
--
-- Bloque de UUID propio (a9…/b9…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla ───────────────────
insert into auth.users (id, email) values
  ('a9000000-0000-0000-0000-000000000001', 'cr-asesorado@ejemplo.test'),
  ('b9000000-0000-0000-0000-000000000001', 'cr-manuela@ejemplo.test'),
  ('b9000000-0000-0000-0000-000000000002', 'cr-bryan@ejemplo.test'),
  ('b9000000-0000-0000-0000-000000000003', 'cr-staff-sin@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('a9000000-0000-0000-0000-000000000001', 'Asesorado cualquiera', 'asesorado', 'AC'),
  ('b9000000-0000-0000-0000-000000000001', 'Manuela de prueba', 'nutricionista', 'MP'),
  ('b9000000-0000-0000-0000-000000000002', 'Bryan de prueba', 'coach', 'BP'),
  ('b9000000-0000-0000-0000-000000000003', 'Staff sin creadores', 'nutricionista', 'SC')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('b9000000-0000-0000-0000-000000000001', 'revisar_creadores'),
  ('b9000000-0000-0000-0000-000000000001', 'firmar_creadores'),
  ('b9000000-0000-0000-0000-000000000003', 'leer_entrenamiento')
on conflict do nothing;

-- Como el importador: service_role escribe.
select set_config('request.jwt.claim.sub', '', false);
set role service_role;

insert into public.creadores_candidatos
  (creador_id, usuario_ig, seguidores, segmento, carril, motivos, nota_a, fecha_dato) values
  ('ig:900000001', 'creador.prueba', 800, 'aliado', 'tambaleando', '["C 1,8", "sin audio"]', 85, now()),
  ('ig:900000002', 'entrenador.prueba', 17781, 'entrenador', 'entrenador', '[]', 83, now());

insert into public.creadores_revisiones
  (revision_id, creador_id, revisor, rol_reel, media_id, permalink, notas, fecha_revision) values
  ('etapa2-28sep', 'ig:900000001', 'claude', 'reciente_1', '17894876838608374',
   'https://www.instagram.com/reel/DdrXjLohE-k/', '{"H":3,"C":2,"P":2,"T":2,"CTA":0,"S":3}', now()),
  ('etapa2-28sep', 'ig:900000001', 'astra', 'reciente_1', '17894876838608374',
   'https://www.instagram.com/reel/DdrXjLohE-k/', '{"H":2,"C":1,"P":2,"T":2,"CTA":0,"S":2}', now());

-- 5b · Dos creadores con el mismo rol de reel en la misma vuelta NO chocan (0091): el
-- «reciente_1» de uno no se come el del otro.
insert into public.creadores_revisiones
  (revision_id, creador_id, revisor, rol_reel, media_id, notas, fecha_revision)
values ('etapa2-28sep', 'ig:900000002', 'claude', 'reciente_1', '17894876838608375', '{"H":1}', now())
on conflict (revision_id, creador_id, revisor, rol_reel) do nothing;
select pruebas.afirmar(
  (select count(*) from public.creadores_revisiones where revision_id = 'etapa2-28sep' and revisor = 'claude' and rol_reel = 'reciente_1') = 2,
  'la revisión de un creador se comió la de otro con el mismo rol de reel'
);

insert into public.creadores_eventos (event_id, creador_id, carril_anterior, carril_nuevo, motivo, actor, fecha_dato)
values ('ig:900000001:tambaleando:1', 'ig:900000001', 'etapa2', 'tambaleando', 'C 1,8', 'importador', now());

-- 5 · El mismo event_id no duplica (el importador usa on conflict do nothing).
insert into public.creadores_eventos (event_id, creador_id, carril_nuevo, actor, fecha_dato)
values ('ig:900000001:tambaleando:1', 'ig:900000001', 'tambaleando', 'importador', now())
on conflict (event_id) do nothing;
select pruebas.afirmar(
  (select count(*) from public.creadores_eventos where event_id = 'ig:900000001:tambaleando:1') = 1,
  'un event_id repetido duplicó la historia del embudo'
);

-- 6 · Checks de forma.
do $$
begin
  begin
    insert into public.creadores_candidatos (creador_id, usuario_ig, carril, fecha_dato)
    values ('@creador', 'creador', 'etapa1', now());
    raise exception 'FALLO: se aceptó un creador_id sin la forma ig:<dígitos>';
  exception when check_violation then null;
  end;
  begin
    insert into public.creadores_candidatos (creador_id, usuario_ig, carril, fecha_dato)
    values ('ig:900000009', 'otro', 'inventado', now());
    raise exception 'FALLO: se aceptó un carril que no existe';
  exception when check_violation then null;
  end;
  begin
    insert into public.creadores_revisiones
      (revision_id, creador_id, revisor, rol_reel, media_id, notas, fecha_revision)
    values ('x', 'ig:900000001', 'gpt', 'reciente_1', '1', '{}', now());
    raise exception 'FALLO: se aceptó un revisor desconocido';
  exception when check_violation then null;
  end;
end $$;

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · Manuela (revisar_creadores) y el coach leen
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('b9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar(
  (select count(*) from public.creadores_candidatos where creador_id like 'ig:90000000%') = 2
  and (select count(*) from public.creadores_revisiones where creador_id = 'ig:900000001') = 2
  and (select count(*) from public.creadores_revisiones where creador_id = 'ig:900000002') = 1
  and (select count(*) from public.creadores_eventos where creador_id = 'ig:900000001') = 1,
  'quien tiene revisar_creadores no ve el tablero completo'
);

-- 4 · ni con firmar_creadores se escribe desde la sesión
do $$
begin
  begin
    update public.creadores_candidatos set carril = 'aprobado_contacto' where creador_id = 'ig:900000001';
    raise exception 'FALLO: Manuela movió de carril a un creador sin pasar por el importador';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.creadores_revisiones
      (revision_id, creador_id, revisor, rol_reel, media_id, notas, fecha_revision)
    values ('manual', 'ig:900000001', 'manuela', 'reciente_1', '1', '{"H":3}', now());
    raise exception 'FALLO: Manuela insertó una revisión desde la sesión';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pruebas.soy('b9000000-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.afirmar(
  (select count(*) from public.creadores_candidatos where creador_id like 'ig:90000000%') = 2,
  'el coach no ve el tablero de creadores'
);
do $$
begin
  begin
    delete from public.creadores_eventos where creador_id = 'ig:900000001';
    raise exception 'FALLO: el coach borró la historia del embudo desde la sesión';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Asesorado y staff sin la capacidad: cero filas
-- ════════════════════════════════════════════════════════════════════════
select pruebas.soy('a9000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.afirmar(
  (select count(*) from public.creadores_candidatos) = 0
  and (select count(*) from public.creadores_revisiones) = 0
  and (select count(*) from public.creadores_eventos) = 0,
  'un asesorado ve el tablero de creadores'
);
reset role;

select pruebas.soy('b9000000-0000-0000-0000-000000000003');
set role authenticated;
select pruebas.afirmar(
  (select count(*) from public.creadores_candidatos) = 0,
  'staff con leer_entrenamiento pero sin revisar_creadores ve el tablero'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · anon no lee
-- ════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$
begin
  begin
    perform 1 from public.creadores_candidatos limit 1;
    raise exception 'FALLO: anon pudo consultar creadores_candidatos';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 7 · El bucket es privado
-- ════════════════════════════════════════════════════════════════════════
select pruebas.afirmar(
  (select public from storage.buckets where id = 'creadores-cuadros') = false,
  'el bucket creadores-cuadros no existe o es público'
);

-- ════════════════════════════════════════════════════════════════════════
-- 8 · La 0092 vuelve privado un bucket que ya existía público (E-07, 28-sep)
-- ════════════════════════════════════════════════════════════════════════
-- La 0090 hace `on conflict do nothing`: si el bucket ya existía con public = true, se
-- quedaba público. Se simula ese estado y se vuelve a pasar la 0092 (idempotente).
update storage.buckets set public = true where id = 'creadores-cuadros';
\ir ../migrations/0092_bucket_creadores_privado.sql
select pruebas.afirmar(
  (select public from storage.buckets where id = 'creadores-cuadros') = false,
  'la 0092 no vuelve privado un bucket creadores-cuadros que ya era público'
);

rollback;
