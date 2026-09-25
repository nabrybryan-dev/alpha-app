-- «Reanudar» y «Preparar para firmar» desde la consola (migración 0084).
--
-- POR QUÉ ESTA PRUEBA EXISTE. Igual que 70-consola-permisos.sql para la 0083: todo lo de
-- aquí es nuevo, así que no hay un fallo histórico que reproducir. Lo que sí hay son
-- cinco riesgos concretos del contrato (CONTRATO-FIRMA-Y-REANUDAR.md):
--
--   1. `reanudar` exige la MISMA capacidad que `detener` (detener_publicacion) — ni más
--      laxa (cualquiera autenticado) ni más estricta (solo el coach).
--   2. `preparar_firma` exige `leer_entrenamiento`, una capacidad DISTINTA de la de
--      `reanudar` — alguien con una y no la otra no puede colarse en la que le falta.
--   3. `casos_firma` solo lo lee quien tiene `leer_entrenamiento`, y NADIE lo escribe
--      desde una sesión de usuario, ni siquiera con esa capacidad.
--   4. El navegador solo puede SUBIR `.sig` a `firmas`, nunca `.json`, y nunca puede
--      reemplazar un archivo ya subido (ni el `.json` ni el propio `.sig`).
--   5. `registrar_firma()` exige la capacidad, exige `listo_para_firmar` y exige que el
--      `.sig` ya esté en Storage — y dos veces sobre el mismo caso ya `firmado` falla.
--
-- Bloque de UUID propio (55/66/77/88/99) para no chocar con la semilla de los otros
-- archivos. Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla mínima ───────────────────
-- 55 = asesorada dueña del caso (usuario_id de ordenes.objetivo y de casos_firma).
-- 66 = staff con las DOS capacidades relevantes (el equivalente de Manuela).
-- 77 = staff sin ninguna capacidad (control negativo de las dos acciones).
-- 88 = staff con SOLO detener_publicacion (puede reanudar, no preparar_firma).
-- 99 = staff con SOLO leer_entrenamiento (puede preparar_firma y leer casos_firma, no
--      reanudar) — separa las dos capacidades para que ninguna cuele por la otra.
insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555', 'firma-asesorada@ejemplo.test'),
  ('66666666-6666-6666-6666-666666666666', 'firma-staff-completo@ejemplo.test'),
  ('77777777-7777-7777-7777-777777777777', 'firma-staff-sin-capacidad@ejemplo.test'),
  ('88888888-8888-8888-8888-888888888888', 'firma-staff-solo-detener@ejemplo.test'),
  ('99999999-9999-9999-9999-999999999999', 'firma-staff-solo-leer@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('55555555-5555-5555-5555-555555555555', 'Asesorada de la firma', 'asesorado', 'AF'),
  ('66666666-6666-6666-6666-666666666666', 'Staff completo', 'nutricionista', 'SC'),
  ('77777777-7777-7777-7777-777777777777', 'Staff sin capacidad', 'nutricionista', 'SS'),
  ('88888888-8888-8888-8888-888888888888', 'Staff solo detener', 'nutricionista', 'SD'),
  ('99999999-9999-9999-9999-999999999999', 'Staff solo leer', 'nutricionista', 'SL')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('66666666-6666-6666-6666-666666666666', 'leer_entrenamiento'),
  ('66666666-6666-6666-6666-666666666666', 'detener_publicacion'),
  ('88888888-8888-8888-8888-888888888888', 'detener_publicacion'),
  ('99999999-9999-9999-9999-999999999999', 'leer_entrenamiento')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · reanudar exige detener_publicacion; preparar_firma exige leer_entrenamiento;
--     ninguna capacidad cuela en la acción de la otra.
-- ════════════════════════════════════════════════════════════════════════

-- 1a. Sin ninguna capacidad (77): las dos se rechazan.
select pruebas.soy('77777777-7777-7777-7777-777777777777');
set role authenticated;
select pruebas.exigir_rls();

do $$
begin
  begin
    insert into public.ordenes (tipo, objetivo, idempotency_key) values (
      'reanudar',
      jsonb_build_object('usuario_id', '55555555-5555-5555-5555-555555555555', 'semana_inicio', '2026-09-28', 'motivo', 'x'),
      'reanudar-77-' || clock_timestamp()::text
    );
    raise exception 'FALLO: reanudó sin tener detener_publicacion';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

do $$
begin
  begin
    insert into public.ordenes (tipo, objetivo, idempotency_key) values (
      'preparar_firma',
      jsonb_build_object('usuario_id', '55555555-5555-5555-5555-555555555555', 'semana_inicio', '2026-09-28', 'motivo', 'x'),
      'preparar-77-' || clock_timestamp()::text
    );
    raise exception 'FALLO: preparó un caso de firma sin tener leer_entrenamiento';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

reset role;

-- 1b. Con SOLO detener_publicacion (88): reanudar sí, preparar_firma no.
select pruebas.soy('88888888-8888-8888-8888-888888888888');
set role authenticated;
select pruebas.exigir_rls();

insert into public.ordenes (tipo, objetivo, idempotency_key) values (
  'reanudar',
  jsonb_build_object('usuario_id', '55555555-5555-5555-5555-555555555555', 'semana_inicio', '2026-09-28', 'motivo', 'ya puede entrenar'),
  'reanudar-88-1'
);

select pruebas.afirmar(
  (select count(*) from public.ordenes where idempotency_key = 'reanudar-88-1' and actor_id = '88888888-8888-8888-8888-888888888888') = 1,
  'staff con detener_publicacion no pudo reanudar, o el actor no quedó como quien llamó'
);

do $$
begin
  begin
    insert into public.ordenes (tipo, objetivo, idempotency_key) values (
      'preparar_firma',
      jsonb_build_object('usuario_id', '55555555-5555-5555-5555-555555555555', 'semana_inicio', '2026-09-28', 'motivo', 'x'),
      'preparar-88-' || clock_timestamp()::text
    );
    raise exception 'FALLO: preparó un caso de firma teniendo solo detener_publicacion (le falta leer_entrenamiento)';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

reset role;

-- 1c. Con SOLO leer_entrenamiento (99): preparar_firma sí, reanudar no.
select pruebas.soy('99999999-9999-9999-9999-999999999999');
set role authenticated;
select pruebas.exigir_rls();

insert into public.ordenes (tipo, objetivo, idempotency_key) values (
  'preparar_firma',
  jsonb_build_object('usuario_id', '55555555-5555-5555-5555-555555555555', 'semana_inicio', '2026-09-28', 'motivo', 'zona roja por retiros'),
  'preparar-99-1'
);

select pruebas.afirmar(
  (select count(*) from public.ordenes where idempotency_key = 'preparar-99-1' and actor_id = '99999999-9999-9999-9999-999999999999') = 1,
  'staff con leer_entrenamiento no pudo preparar un caso de firma'
);

do $$
begin
  begin
    insert into public.ordenes (tipo, objetivo, idempotency_key) values (
      'reanudar',
      jsonb_build_object('usuario_id', '55555555-5555-5555-5555-555555555555', 'semana_inicio', '2026-09-28', 'motivo', 'x'),
      'reanudar-99-' || clock_timestamp()::text
    );
    raise exception 'FALLO: reanudó teniendo solo leer_entrenamiento (le falta detener_publicacion)';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

reset role;

-- 1d. Se puede detener y reanudar varias veces: dos órdenes `reanudar` para la MISMA
-- persona+semana con claves distintas (la hora) no chocan entre sí.
select pruebas.soy('66666666-6666-6666-6666-666666666666');
set role authenticated;
select pruebas.exigir_rls();

insert into public.ordenes (tipo, objetivo, idempotency_key) values (
  'reanudar',
  jsonb_build_object('usuario_id', '55555555-5555-5555-5555-555555555555', 'semana_inicio', '2026-09-28', 'motivo', 'segunda reanudación'),
  'reanudar-66-2'
);

select pruebas.afirmar(
  (select count(*) from public.ordenes
    where tipo = 'reanudar'
      and objetivo->>'usuario_id' = '55555555-5555-5555-5555-555555555555'
      and objetivo->>'semana_inicio' = '2026-09-28') >= 2,
  'dos reanudaciones de la misma persona y semana, con claves distintas, no conviven'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 2 · casos_firma: solo lee quien tiene leer_entrenamiento; nadie escribe
--     desde una sesión de usuario, ni con la capacidad.
-- ════════════════════════════════════════════════════════════════════════

-- Como dueño de la tabla (mismo nivel que service_role): la fila la escribiría el equipo
-- de mesa. `caso-listo` está lista para firmar; `caso-preparando` sirve para probar que
-- la RPC rechaza un estado que no es el suyo.
insert into public.casos_firma
  (id, usuario_id, semana_inicio, tipo, estado, ruta_decision, valida_hasta)
values
  ('11111111-c0de-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', '2026-09-28',
   'retiro', 'listo_para_firmar', 'casos/55555555-5555-5555-5555-555555555555/2026-09-28/caso-1.json',
   now() + interval '1 day'),
  ('11111111-c0de-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', '2026-09-28',
   'recorte', 'preparando', 'casos/55555555-5555-5555-5555-555555555555/2026-09-28/caso-2.json',
   now() + interval '1 day')
on conflict (id) do nothing;

-- 2a. `tipo` es NULLABLE, pero SOLO junto con `estado = 'rechazado'` (ajuste del equipo de
-- mesa: cuando la semana no tiene retiros ni recortes pendientes de firma, el caso nace
-- rechazado sin tipo — no hay una decisión que clasificar). Un caso `rechazado` con tipo
-- NULL se acepta; cualquier otro estado con tipo NULL es un caso a medio llenar y se
-- rechaza.
insert into public.casos_firma (id, usuario_id, semana_inicio, tipo, estado, error)
values (
  '11111111-c0de-0000-0000-000000000004', '55555555-5555-5555-5555-555555555555', '2026-10-12',
  null, 'rechazado', 'esta semana no tiene retiros ni recortes pendientes de firma'
);

select pruebas.afirmar(
  (select count(*) from public.casos_firma where id = '11111111-c0de-0000-0000-000000000004') = 1,
  'un caso rechazado con tipo NULL no se pudo crear (el CHECK debería aceptarlo)'
);

do $$
begin
  begin
    insert into public.casos_firma (usuario_id, semana_inicio, tipo, estado)
    values ('55555555-5555-5555-5555-555555555555', '2026-10-19', null, 'listo_para_firmar');
    raise exception 'FALLO: un caso listo_para_firmar con tipo NULL se aceptó';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

select pruebas.soy('77777777-7777-7777-7777-777777777777');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.casos_firma where id = '11111111-c0de-0000-0000-000000000001') = 0,
  'staff SIN leer_entrenamiento ve un caso de firma ajeno'
);

reset role;

-- Control positivo: si esto fallara por cualquier motivo —incluida la tabla vacía—, la
-- comprobación negativa de arriba no probaría que la política filtra.
select pruebas.soy('99999999-9999-9999-9999-999999999999');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from public.casos_firma where id = '11111111-c0de-0000-0000-000000000001') = 1,
  'staff CON leer_entrenamiento no ve el caso de firma (falso negativo: revisa la semilla)'
);

-- Ni con la capacidad se puede escribir desde una sesión de usuario: `authenticated` no
-- tiene privilegio de insert/update/delete sobre esta tabla (revocado explícitamente en
-- la 0084, no solo "sin política de RLS") — el intento revienta antes de que RLS llegue a
-- evaluar nada.
do $$
begin
  begin
    insert into public.casos_firma (usuario_id, semana_inicio, tipo, ruta_decision)
    values ('55555555-5555-5555-5555-555555555555', '2026-10-05', 'retiro', 'casos/x/y/otro.json');
    raise exception 'FALLO: insertó un caso de firma desde una sesión de usuario CON la capacidad';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- Mismo patrón que 60-los-errores-del-navegador.sql (0078): sin privilegio de UPDATE para
-- `authenticated` (la 0084 lo revoca explícitamente, no solo se apoya en que falte una
-- política de RLS), el intento tiene que reventar con `insufficient_privilege` — no pasar
-- en silencio sobre cero filas visibles, que sería un resultado más débil y más fácil de
-- confundir con «tenía permiso pero no había nada que tocar».
do $$
begin
  begin
    update public.casos_firma set estado = 'firmado' where id = '11111111-c0de-0000-0000-000000000001';
    raise exception 'FALLO: actualizó un caso de firma desde una sesión de usuario CON la capacidad';
  exception when insufficient_privilege then
    null;
  end;
end $$;

select pruebas.afirmar(
  (select estado from public.casos_firma where id = '11111111-c0de-0000-0000-000000000001') = 'listo_para_firmar',
  'un caso de firma cambió de estado pese a que el UPDATE debía rechazarse'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · Storage: el navegador sube SOLO `.sig`, y nunca reemplaza nada.
-- ════════════════════════════════════════════════════════════════════════

select pruebas.soy('99999999-9999-9999-9999-999999999999');
set role authenticated;
select pruebas.exigir_rls();

-- Subir un `.sig`: sí.
insert into storage.objects (bucket_id, name)
values ('firmas', 'casos/55555555-5555-5555-5555-555555555555/2026-09-28/caso-1.json.sig');

select pruebas.afirmar(
  (select count(*) from storage.objects
    where bucket_id = 'firmas' and name = 'casos/55555555-5555-5555-5555-555555555555/2026-09-28/caso-1.json.sig') = 1,
  'staff con leer_entrenamiento no pudo subir el .sig'
);

-- Subir el `.json` (la decisión sin firmar): no. Ninguna política de insert lo cubre.
do $$
begin
  begin
    insert into storage.objects (bucket_id, name)
    values ('firmas', 'casos/55555555-5555-5555-5555-555555555555/2026-09-28/caso-1.json');
    raise exception 'FALLO: el navegador pudo subir el .json sin firmar';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- Reemplazar el `.sig` ya subido: no. `authenticated` SÍ tiene privilegio de UPDATE sobre
-- `storage.objects` a nivel de tabla (`00-suplantar-supabase.sql` lo concede en bloque,
-- igual que el proyecto real) — la única barrera es RLS, y sin política de `update` un
-- UPDATE sin filas visibles para esa cláusula NO lanza, afecta CERO filas en silencio
-- (mismo mecanismo que el de `casos_firma` más arriba, distinto motivo: ahí no hay
-- privilegio; aquí no hay política). Se comprueba el resultado, no una excepción.
update storage.objects set owner = '99999999-9999-9999-9999-999999999999'
 where bucket_id = 'firmas' and name = 'casos/55555555-5555-5555-5555-555555555555/2026-09-28/caso-1.json.sig';

select pruebas.afirmar(
  (select owner from storage.objects
    where bucket_id = 'firmas' and name = 'casos/55555555-5555-5555-5555-555555555555/2026-09-28/caso-1.json.sig')
    is null,
  'se pudo reemplazar/tocar un .sig ya subido'
);

reset role;

-- Sin la capacidad, ni siquiera se ve lo que hay en el bucket.
select pruebas.soy('77777777-7777-7777-7777-777777777777');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select count(*) from storage.objects where bucket_id = 'firmas') = 0,
  'staff SIN leer_entrenamiento ve archivos del bucket firmas'
);

reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · registrar_firma(): capacidad, estado y existencia del .sig — sin
--     poder falsificar el actor.
-- ════════════════════════════════════════════════════════════════════════

-- 4a. Sin la capacidad: rechazada.
select pruebas.soy('77777777-7777-7777-7777-777777777777');
set role authenticated;
select pruebas.exigir_rls();

do $$
begin
  begin
    perform public.registrar_firma('11111111-c0de-0000-0000-000000000001');
    raise exception 'FALLO: registró una firma sin tener leer_entrenamiento';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

reset role;

-- 4b. Con la capacidad, pero el caso NO está listo_para_firmar (está preparando):
-- rechazada.
select pruebas.soy('99999999-9999-9999-9999-999999999999');
set role authenticated;
select pruebas.exigir_rls();

do $$
begin
  begin
    perform public.registrar_firma('11111111-c0de-0000-0000-000000000002');
    raise exception 'FALLO: registró una firma sobre un caso que seguía en preparando';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

-- 4c. El caso SÍ está listo_para_firmar, pero todavía no se subió NINGÚN .sig para él
-- (el que se subió en el bloque 3 es de `caso-1`, que es justo este caso — se prueba
-- ANTES de esa subida quitándola de en medio: aquí se usa un caso nuevo, sin .sig).
insert into public.casos_firma
  (id, usuario_id, semana_inicio, tipo, estado, ruta_decision, valida_hasta)
values
  ('11111111-c0de-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', '2026-10-05',
   'retiro', 'listo_para_firmar', 'casos/55555555-5555-5555-5555-555555555555/2026-10-05/caso-3.json',
   now() + interval '1 day')
on conflict (id) do nothing;

do $$
begin
  begin
    perform public.registrar_firma('11111111-c0de-0000-0000-000000000003');
    raise exception 'FALLO: registró una firma sin que existiera el .sig en Storage';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

reset role;

-- 4d. Con el .sig ya subido (bloque 3, sobre `caso-1`): la RPC SÍ avanza el caso, y el
-- actor que queda registrado en el estado del caso no importa aquí (la tabla no guarda
-- firmante) — lo que se comprueba es que la RPC solo actuó tras verificar el archivo.
select pruebas.soy('99999999-9999-9999-9999-999999999999');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (select (public.registrar_firma('11111111-c0de-0000-0000-000000000001')).estado) = 'firmado',
  'con el .sig ya subido y la capacidad, registrar_firma no pasó el caso a firmado'
);

select pruebas.afirmar(
  (select ruta_firma from public.casos_firma where id = '11111111-c0de-0000-0000-000000000001')
    = 'casos/55555555-5555-5555-5555-555555555555/2026-09-28/caso-1.json.sig',
  'registrar_firma no guardó la ruta de la firma correctamente'
);

-- 4e. Repetir sobre el mismo caso, ya `firmado`: rechazada — no es idempotente hacia
-- adelante, es un estado que ya se dejó atrás.
do $$
begin
  begin
    perform public.registrar_firma('11111111-c0de-0000-0000-000000000001');
    raise exception 'FALLO: registró la firma dos veces sobre el mismo caso';
  exception
    when others then
      if sqlerrm like 'FALLO:%' then raise; end if;
  end;
end $$;

reset role;

rollback;

\echo 'OK · reanudar y firma de casos (0084)'
