-- Salud del celular, Fase A (0093): el permiso E, el código del atajo y los resúmenes diarios.
--
-- POR QUÉ ESTA PRUEBA EXISTE. Son datos sensibles de salud (Ley 1581, art. 5) y la
-- protección es enteramente del lado de la base: RLS, privilegios por columna y funciones
-- `security definer`. Nada de eso lo ve la suite de vitest (corre en modo demo). Se comprueba
-- contra RLS de verdad, no contra el código del cliente:
--
--   1. La persona: sin permiso no genera código; el permiso exige el texto vigente y la
--      declaración; es idempotente; el código sale UNA vez y en la tabla solo queda su hash
--      (sha-256); generar otro revoca el anterior; el hash no se puede leer ni por su dueña.
--   2. Nadie con sesión escribe en las tres tablas: ni la dueña, ni el staff, ni anon.
--   3. La Edge Function (service_role): código desconocido / revocado / sin permiso /
--      pasado de frecuencia; upsert idempotente por (persona, día, tipo, fuente); gana el
--      último si el mismo día viene repetido; unidad, rango y método los exige la tabla.
--   4. Lectura: cada persona lo suyo; el staff solo con `leer_entrenamiento`; el hash, ni ese.
--   5. Revocar: apaga el código, deja de aceptar envíos, borra lo enviado solo si se pide,
--      y el historial de la autorización se conserva.
--   6. La casilla E en el formulario público: el texto 0.4 entra; el 0.3 solo con la E en
--      «no»; cualquier otra versión, no.
--
-- Bloque de UUID propio (97/96-…) para no chocar con la semilla de otros archivos.
-- Termina en ROLLBACK: no deja nada detrás.

\set ON_ERROR_STOP on

begin;

-- ─────────────────── Semilla mínima ───────────────────
-- 97..1 = asesorada A, dueña de sus datos.  97..2 = asesorada B (aislamiento).
-- 96..1 = staff CON leer_entrenamiento.      96..2 = staff SIN ninguna capacidad.
insert into auth.users (id, email) values
  ('97777777-0000-0000-0000-000000000001', 'salud-a@ejemplo.test'),
  ('97777777-0000-0000-0000-000000000002', 'salud-b@ejemplo.test'),
  ('96666666-0000-0000-0000-000000000001', 'salud-staff-con@ejemplo.test'),
  ('96666666-0000-0000-0000-000000000002', 'salud-staff-sin@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('97777777-0000-0000-0000-000000000001', 'Asesorada A', 'asesorado', 'AA'),
  ('97777777-0000-0000-0000-000000000002', 'Asesorada B', 'asesorado', 'AB'),
  ('96666666-0000-0000-0000-000000000001', 'Staff con capacidad', 'nutricionista', 'SC'),
  ('96666666-0000-0000-0000-000000000002', 'Staff sin capacidad', 'nutricionista', 'SS')
on conflict (id) do update set
  nombre = excluded.nombre, rol = excluded.rol, avatar_iniciales = excluded.avatar_iniciales;

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('96666666-0000-0000-0000-000000000001', 'leer_entrenamiento')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 1 · La persona: el permiso E y el código
-- ════════════════════════════════════════════════════════════════════════

select pruebas.soy('97777777-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

select pruebas.afirmar(
  (public.salud_estado() ->> 'consentimiento')::boolean = false
    and (public.salud_estado() ->> 'codigo_activo')::boolean = false,
  'una persona nueva ya tiene permiso o código'
);

-- Sin la casilla E no se genera código: la base lo rechaza, no solo la pantalla.
do $$
begin
  begin
    perform public.salud_atajo_generar_token();
    raise exception 'FALLO: se generó un código sin el permiso de la casilla E';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- El permiso exige el texto vigente…
do $$
begin
  begin
    perform public.salud_dar_consentimiento('0.3', true);
    raise exception 'FALLO: se aceptó un permiso con el texto 0.3, que no tiene la casilla E';
  exception
    when invalid_parameter_value then null;
  end;
end $$;

-- …y la declaración.
do $$
begin
  begin
    perform public.salud_dar_consentimiento('0.4', false);
    raise exception 'FALLO: se aceptó un permiso sin la declaración';
  exception
    when invalid_parameter_value then null;
  end;
end $$;

select pruebas.afirmar(
  (select count(*) from public.salud_consentimientos) = 0,
  'un permiso rechazado dejó un evento escrito'
);

-- Otorgar dos veces es lo mismo que una: no duplica la evidencia.
select public.salud_dar_consentimiento('0.4', true);
select public.salud_dar_consentimiento('0.4', true);

select pruebas.afirmar(
  (select count(*) from public.salud_consentimientos
    where usuario_id = '97777777-0000-0000-0000-000000000001' and evento = 'otorgada') = 1,
  'otorgar el permiso dos veces dejó dos eventos'
);
select pruebas.afirmar(
  (public.salud_estado() ->> 'consentimiento')::boolean = true,
  'tras otorgar el permiso el estado no lo dice'
);

-- El código sale UNA vez, con su forma, y se guarda en la sesión de la prueba para usarlo después.
select set_config('pruebas.token_a1', public.salud_atajo_generar_token() ->> 'token', false);
select pruebas.afirmar(
  current_setting('pruebas.token_a1') ~ '^sa_[0-9a-f]{40}$',
  'el código no tiene la forma sa_ + 40 hexadecimales'
);

-- Su dueña ve que tiene un código activo, pero no su hash: SELECT por columna.
select pruebas.afirmar(
  (select count(*) from (select id, usuario_id, creado_en, revocado_en, ultimo_uso_en
                           from public.salud_atajo_tokens) t) = 1,
  'la dueña no ve su propio código (metadatos)'
);
do $$
begin
  begin
    perform token_hash from public.salud_atajo_tokens;
    raise exception 'FALLO: una sesión de usuario leyó token_hash';
  exception
    when insufficient_privilege then null;
  end;
end $$;
do $$
begin
  begin
    perform * from public.salud_atajo_tokens;
    raise exception 'FALLO: un select * sobre los códigos no falló y arrastraría el hash';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- Generar otro código revoca el anterior: solo hay uno activo.
select set_config('pruebas.token_a', public.salud_atajo_generar_token() ->> 'token', false);
select pruebas.afirmar(
  current_setting('pruebas.token_a') <> current_setting('pruebas.token_a1'),
  'dos códigos iguales'
);
select pruebas.afirmar(
  (select count(*) from public.salud_atajo_tokens where revocado_en is null) = 1
    and (select count(*) from public.salud_atajo_tokens) = 2,
  'debía haber 2 códigos en total y 1 activo'
);

reset role;

-- Como dueño de la tabla: en la base solo está el HASH (sha-256 del código), nunca el código.
select pruebas.afirmar(
  (select count(*) from public.salud_atajo_tokens
    where token_hash = encode(sha256(convert_to(current_setting('pruebas.token_a'), 'UTF8')), 'hex')
      and revocado_en is null) = 1,
  'el hash del código activo no es el sha-256 del código'
);
select pruebas.afirmar(
  (select count(*) from public.salud_atajo_tokens
    where token_hash = encode(sha256(convert_to(current_setting('pruebas.token_a1'), 'UTF8')), 'hex')
      and revocado_en is not null) = 1,
  'el código anterior no quedó revocado'
);
select pruebas.afirmar(
  (select count(*) from public.salud_atajo_tokens
    where token_hash like 'sa_%' or token_hash = current_setting('pruebas.token_a')) = 0,
  'se guardó un código en claro'
);

-- ════════════════════════════════════════════════════════════════════════
-- 2 · Nadie con sesión escribe en las tres tablas
-- ════════════════════════════════════════════════════════════════════════

select pruebas.soy('97777777-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

do $$
begin
  begin
    insert into public.salud_muestras (usuario_id, fecha, tipo, valor, unidad, fuente) values
      ('97777777-0000-0000-0000-000000000001', '2026-09-28', 'pasos', 1, 'pasos', 'manual');
    raise exception 'FALLO: una sesión de usuario insertó en salud_muestras';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.salud_consentimientos (usuario_id, evento, version_autorizacion, declaracion_aceptada) values
      ('97777777-0000-0000-0000-000000000002', 'otorgada', '0.4', true);
    raise exception 'FALLO: una sesión de usuario insertó un permiso directamente';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.salud_atajo_tokens (usuario_id, token_hash) values
      ('97777777-0000-0000-0000-000000000001', repeat('a', 64));
    raise exception 'FALLO: una sesión de usuario insertó un código directamente';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.salud_atajo_tokens set revocado_en = null;
    raise exception 'FALLO: una sesión de usuario pudo reactivar un código revocado';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.salud_consentimientos set evento = 'otorgada';
    raise exception 'FALLO: una sesión de usuario pudo reescribir su historial de permisos';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.salud_consentimientos;
    raise exception 'FALLO: una sesión de usuario borró su historial de permisos';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.salud_muestras;
    raise exception 'FALLO: una sesión de usuario borró muestras directamente';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Las funciones de la Edge Function no las llama nadie con sesión.
do $$
begin
  begin
    perform public.salud_atajo_guardar('97777777-0000-0000-0000-000000000001', '[]'::jsonb);
    raise exception 'FALLO: authenticated puede llamar salud_atajo_guardar';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.salud_atajo_autorizar(repeat('a', 64));
    raise exception 'FALLO: authenticated puede llamar salud_atajo_autorizar';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.salud_consentimiento_vigente('97777777-0000-0000-0000-000000000002');
    raise exception 'FALLO: authenticated puede preguntar por el permiso de otra persona';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- anon: ni funciones de la persona ni tablas.
set role anon;
do $$
begin
  begin
    perform public.salud_estado();
    raise exception 'FALLO: anon puede llamar salud_estado';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.salud_atajo_generar_token();
    raise exception 'FALLO: anon puede generar un código';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.salud_muestras;
    raise exception 'FALLO: anon lee salud_muestras';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.salud_consentimientos;
    raise exception 'FALLO: anon lee salud_consentimientos';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 3 · La Edge Function (service_role)
-- ════════════════════════════════════════════════════════════════════════

set role service_role;

select pruebas.afirmar(
  public.salud_atajo_autorizar('no-es-un-hash') ->> 'estado' = 'token_invalido',
  'un texto que no es un hash no dio token_invalido'
);
select pruebas.afirmar(
  public.salud_atajo_autorizar(repeat('a', 64)) ->> 'estado' = 'token_invalido',
  'un hash desconocido no dio token_invalido'
);
-- El código anterior fue revocado al generar el segundo.
select pruebas.afirmar(
  public.salud_atajo_autorizar(encode(sha256(convert_to(current_setting('pruebas.token_a1'), 'UTF8')), 'hex')) ->> 'estado'
    = 'token_invalido',
  'un código revocado se aceptó'
);
-- El vigente entra y dice de quién es. (Cada llamada y su comprobación van en sentencias
-- SEPARADAS: dentro de una sola, la comprobación no vería lo que la función escribió.)
select set_config('pruebas.r', public.salud_atajo_autorizar(
  encode(sha256(convert_to(current_setting('pruebas.token_a'), 'UTF8')), 'hex'))::text, false);
select pruebas.afirmar(
  current_setting('pruebas.r')::jsonb ->> 'estado' = 'ok'
    and current_setting('pruebas.r')::jsonb ->> 'usuario_id' = '97777777-0000-0000-0000-000000000001',
  'el código vigente no entró o dijo de quién no era'
);

-- Límite de frecuencia: 20 envíos por hora y código (ya llevamos 1 arriba).
do $$
declare
  h text := encode(sha256(convert_to(current_setting('pruebas.token_a'), 'UTF8')), 'hex');
  r jsonb;
  i integer;
begin
  for i in 2..20 loop
    r := public.salud_atajo_autorizar(h);
    if r ->> 'estado' <> 'ok' then
      raise exception 'FALLO: el envío % debía entrar y dio %', i, r;
    end if;
  end loop;
  r := public.salud_atajo_autorizar(h);
  if r ->> 'estado' <> 'limite' then
    raise exception 'FALLO: el envío 21 de la hora debía dar limite y dio %', r;
  end if;
end $$;

reset role;

-- La ventana se renueva pasada la hora.
update public.salud_atajo_tokens set ventana_inicio = now() - interval '2 hours' where revocado_en is null;

set role service_role;
select pruebas.afirmar(
  public.salud_atajo_autorizar(encode(sha256(convert_to(current_setting('pruebas.token_a'), 'UTF8')), 'hex')) ->> 'estado' = 'ok',
  'pasada la hora el límite no se renovó'
);

-- Guardar: upsert idempotente.
select pruebas.afirmar(
  public.salud_atajo_guardar('97777777-0000-0000-0000-000000000001',
    '[{"fecha":"2026-09-28","tipo":"pasos","valor":8123,"unidad":"pasos","metodo":null},
      {"fecha":"2026-09-28","tipo":"vfc","valor":42.3,"unidad":"ms","metodo":"sdnn"}]'::jsonb) = 2,
  'no guardó las dos muestras'
);
select pruebas.afirmar(
  public.salud_atajo_guardar('97777777-0000-0000-0000-000000000001',
    '[{"fecha":"2026-09-28","tipo":"pasos","valor":9000,"unidad":"pasos","metodo":null},
      {"fecha":"2026-09-28","tipo":"vfc","valor":42.3,"unidad":"ms","metodo":"sdnn"}]'::jsonb) = 2,
  'reenviar el día no devolvió 2'
);
select pruebas.afirmar(
  (select count(*) from public.salud_muestras where usuario_id = '97777777-0000-0000-0000-000000000001') = 2
    and (select valor from public.salud_muestras
          where usuario_id = '97777777-0000-0000-0000-000000000001' and tipo = 'pasos') = 9000
    and (select fuente from public.salud_muestras where tipo = 'pasos') = 'atajo',
  'reenviar el día debía ACTUALIZAR el dato (9000), no duplicarlo'
);

-- Si el mismo día y tipo viene repetido en el mismo envío, gana el último.
select pruebas.afirmar(
  public.salud_atajo_guardar('97777777-0000-0000-0000-000000000001',
    '[{"fecha":"2026-09-27","tipo":"peso","valor":70,"unidad":"kg","metodo":null},
      {"fecha":"2026-09-27","tipo":"peso","valor":71.5,"unidad":"kg","metodo":null}]'::jsonb) = 1,
  'con el día repetido en un envío no quedó una sola fila'
);
select pruebas.afirmar(
  (select valor from public.salud_muestras
    where usuario_id = '97777777-0000-0000-0000-000000000001' and tipo = 'peso') = 71.5,
  'con el día repetido en un envío no ganó el último'
);

-- La tabla exige unidad, rango y método aunque la función se equivoque (la última red).
do $$
declare
  a constant uuid := '97777777-0000-0000-0000-000000000001';
  malo text;
begin
  foreach malo in array array[
    '[{"fecha":"2026-09-28","tipo":"peso","valor":5,"unidad":"kg","metodo":null}]',
    '[{"fecha":"2026-09-28","tipo":"pasos","valor":200000,"unidad":"pasos","metodo":null}]',
    '[{"fecha":"2026-09-28","tipo":"fc_reposo","valor":10,"unidad":"lpm","metodo":null}]',
    '[{"fecha":"2026-09-28","tipo":"pasos","valor":10,"unidad":"kg","metodo":null}]',
    '[{"fecha":"2026-09-28","tipo":"vfc","valor":40,"unidad":"ms","metodo":null}]',
    '[{"fecha":"2026-09-28","tipo":"vfc","valor":40,"unidad":"ms","metodo":"otro"}]',
    '[{"fecha":"2026-09-28","tipo":"pasos","valor":10,"unidad":"pasos","metodo":"sdnn"}]',
    '[{"fecha":"2026-09-28","tipo":"glucosa","valor":90,"unidad":"mg","metodo":null}]',
    '[{"fecha":"2019-12-31","tipo":"pasos","valor":10,"unidad":"pasos","metodo":null}]'
  ] loop
    begin
      perform public.salud_atajo_guardar(a, malo::jsonb);
      raise exception 'FALLO: la tabla aceptó %', malo;
    exception when check_violation then null;
    end;
  end loop;
end $$;

-- Argumentos que no son una lista, y una persona sin permiso.
do $$
begin
  begin
    perform public.salud_atajo_guardar('97777777-0000-0000-0000-000000000001', '{"a":1}'::jsonb);
    raise exception 'FALLO: se aceptó un objeto donde iba una lista';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.salud_atajo_guardar('97777777-0000-0000-0000-000000000002',
      '[{"fecha":"2026-09-28","tipo":"pasos","valor":10,"unidad":"pasos","metodo":null}]'::jsonb);
    raise exception 'FALLO: se guardó a nombre de una persona sin el permiso E';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

select pruebas.afirmar(
  (select count(*) from public.salud_muestras where usuario_id = '97777777-0000-0000-0000-000000000001') = 3,
  'después de los rechazos debían quedar exactamente 3 muestras'
);
select pruebas.afirmar(
  (select ultimo_uso_en from public.salud_atajo_tokens where revocado_en is null) is not null,
  'el código no anotó su último uso'
);
select pruebas.afirmar(
  (select metodo from public.salud_muestras where tipo = 'vfc') = 'sdnn'
    and (select count(*) from public.salud_muestras where tipo <> 'vfc' and metodo is not null) = 0,
  'el método de la VFC (sdnn) o el vacío de los otros tipos no quedó como debía'
);

-- Un dato por persona, día, tipo y fuente…
do $$
begin
  begin
    insert into public.salud_muestras (usuario_id, fecha, tipo, valor, unidad, fuente) values
      ('97777777-0000-0000-0000-000000000001', '2026-09-28', 'pasos', 5, 'pasos', 'atajo');
    raise exception 'FALLO: se aceptó un segundo dato de la misma persona, día, tipo y fuente';
  exception when unique_violation then null;
  end;
end $$;
-- …pero la misma medida por otra fuente (a mano) es otro dato: la tabla sirve para las tres fuentes.
insert into public.salud_muestras (usuario_id, fecha, tipo, valor, unidad, fuente) values
  ('97777777-0000-0000-0000-000000000001', '2026-09-28', 'pasos', 5000, 'pasos', 'manual');
do $$
begin
  begin
    insert into public.salud_muestras (usuario_id, fecha, tipo, valor, unidad, fuente) values
      ('97777777-0000-0000-0000-000000000001', '2026-09-28', 'pasos', 5, 'pasos', 'gps');
    raise exception 'FALLO: se aceptó una fuente que no es atajo, manual ni nativa';
  exception when check_violation then null;
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 4 · Lectura: cada persona lo suyo; el staff, solo con la capacidad
-- ════════════════════════════════════════════════════════════════════════

select pruebas.soy('97777777-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar((select count(*) from public.salud_muestras) = 4, 'la dueña no ve sus 4 datos (3 del atajo y 1 a mano)');
select pruebas.afirmar((select count(*) from public.salud_consentimientos) = 1, 'la dueña no ve su permiso');
reset role;

select pruebas.soy('97777777-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar((select count(*) from public.salud_muestras) = 0, 'otra asesorada ve datos de salud que no son suyos');
select pruebas.afirmar((select count(*) from public.salud_consentimientos) = 0, 'otra asesorada ve el permiso de A');
select pruebas.afirmar(
  (select count(*) from (select id from public.salud_atajo_tokens) t) = 0,
  'otra asesorada ve los códigos de A'
);
reset role;

select pruebas.soy('96666666-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select pruebas.afirmar((select count(*) from public.salud_muestras) = 0, 'staff SIN leer_entrenamiento ve datos de salud');
select pruebas.afirmar((select count(*) from public.salud_consentimientos) = 0, 'staff SIN leer_entrenamiento ve permisos');
select pruebas.afirmar(
  (select count(*) from (select id from public.salud_atajo_tokens) t) = 0,
  'staff SIN leer_entrenamiento ve códigos'
);
reset role;

select pruebas.soy('96666666-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
-- Control positivo: si esto fallara, el bloque negativo de arriba no probaría que la política
-- filtra — probaría que no hay datos.
select pruebas.afirmar((select count(*) from public.salud_muestras) = 4, 'staff CON leer_entrenamiento no ve los datos (revisa la semilla)');
select pruebas.afirmar((select count(*) from public.salud_consentimientos) = 1, 'staff CON leer_entrenamiento no ve el permiso');
select pruebas.afirmar(
  (select count(*) from (select id, usuario_id, creado_en, revocado_en, ultimo_uso_en from public.salud_atajo_tokens) t) = 2,
  'staff CON leer_entrenamiento no ve los metadatos de los códigos'
);
-- Ni siquiera el staff con la capacidad lee el hash, ni escribe.
do $$
begin
  begin
    perform token_hash from public.salud_atajo_tokens;
    raise exception 'FALLO: el staff leyó token_hash';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.salud_muestras (usuario_id, fecha, tipo, valor, unidad, fuente) values
      ('97777777-0000-0000-0000-000000000002', '2026-09-28', 'pasos', 1, 'pasos', 'manual');
    raise exception 'FALLO: el staff con leer_entrenamiento escribió datos de salud';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 5 · Revocar
-- ════════════════════════════════════════════════════════════════════════

select pruebas.soy('97777777-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

-- Revocar SIN borrar: apaga el código, deja los datos.
select set_config('pruebas.r', public.salud_revocar_consentimiento(false)::text, false);
select pruebas.afirmar(
  (current_setting('pruebas.r')::jsonb ->> 'codigos_revocados')::integer = 1
    and (current_setting('pruebas.r')::jsonb ->> 'muestras_borradas')::integer = 0,
  'revocar sin borrar no revocó el código o borró datos'
);
select pruebas.afirmar(
  (public.salud_estado() ->> 'consentimiento')::boolean = false
    and (public.salud_estado() ->> 'codigo_activo')::boolean = false,
  'revocar no apagó el permiso y el código'
);
select pruebas.afirmar((select count(*) from public.salud_muestras) = 4, 'revocar sin borrar borró datos');
-- Revocar dos veces es lo mismo que una: no añade otro evento.
select public.salud_revocar_consentimiento(false);
select pruebas.afirmar(
  (select count(*) from public.salud_consentimientos) = 2
    and (select evento from public.salud_consentimientos order by id desc limit 1) = 'revocada',
  'el historial debía tener 2 eventos (otorgada, revocada) y terminar en revocada'
);
-- Sin el permiso vuelve a no poder generar código.
do $$
begin
  begin
    perform public.salud_atajo_generar_token();
    raise exception 'FALLO: se generó un código con el permiso revocado';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role service_role;
select pruebas.afirmar(
  public.salud_atajo_autorizar(encode(sha256(convert_to(current_setting('pruebas.token_a'), 'UTF8')), 'hex')) ->> 'estado' = 'token_invalido',
  'el código siguió funcionando después de revocar el permiso'
);
do $$
begin
  begin
    perform public.salud_atajo_guardar('97777777-0000-0000-0000-000000000001',
      '[{"fecha":"2026-09-28","tipo":"pasos","valor":10,"unidad":"pasos","metodo":null}]'::jsonb);
    raise exception 'FALLO: se guardó un dato con el permiso revocado';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Volver a autorizar es posible y deja otro evento.
select pruebas.soy('97777777-0000-0000-0000-000000000001');
set role authenticated;
select public.salud_dar_consentimiento('0.4', true);
select set_config('pruebas.token_a2', public.salud_atajo_generar_token() ->> 'token', false);
reset role;

-- Si el permiso se revocara por otra vía con el código aún activo, el código no basta:
-- `sin_consentimiento` (lo que la Edge Function responde con 403).
insert into public.salud_consentimientos (usuario_id, evento, version_autorizacion) values
  ('97777777-0000-0000-0000-000000000001', 'revocada', '0.4');
set role service_role;
select pruebas.afirmar(
  public.salud_atajo_autorizar(encode(sha256(convert_to(current_setting('pruebas.token_a2'), 'UTF8')), 'hex')) ->> 'estado'
    = 'sin_consentimiento',
  'con el permiso revocado el código todavía dio ok'
);
reset role;
insert into public.salud_consentimientos (usuario_id, evento, version_autorizacion, declaracion_aceptada) values
  ('97777777-0000-0000-0000-000000000001', 'otorgada', '0.4', true);

-- Revocar borrando: se van los datos, se queda la prueba de la autorización.
select pruebas.soy('97777777-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();
select set_config('pruebas.r', public.salud_revocar_consentimiento(true)::text, false);
select pruebas.afirmar(
  (current_setting('pruebas.r')::jsonb ->> 'muestras_borradas')::integer = 4,
  'revocar borrando no dijo haber borrado las 4 muestras'
);
select pruebas.afirmar((select count(*) from public.salud_muestras) = 0, 'quedaron datos después de borrar');
select pruebas.afirmar(
  (select count(*) from public.salud_consentimientos) >= 5,
  'el borrado de datos se llevó el historial de la autorización, que es la prueba de la Ley 1581 art. 17'
);
reset role;

-- Una persona que nunca autorizó: revocar/borrar es inofensivo y no inventa eventos.
select pruebas.soy('97777777-0000-0000-0000-000000000002');
set role authenticated;
select pruebas.exigir_rls();
select set_config('pruebas.r', public.salud_revocar_consentimiento(true)::text, false);
select pruebas.afirmar(
  (current_setting('pruebas.r')::jsonb ->> 'consentimiento')::boolean = false
    and (current_setting('pruebas.r')::jsonb ->> 'muestras_borradas')::integer = 0
    and (current_setting('pruebas.r')::jsonb ->> 'codigos_revocados')::integer = 0,
  'revocar sin haber autorizado dijo haber revocado o borrado algo'
);
select pruebas.afirmar(
  (select count(*) from public.salud_consentimientos) = 0,
  'revocar sin haber autorizado inventó un evento'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════
-- 6 · La casilla E en el formulario público de interesados
-- ════════════════════════════════════════════════════════════════════════
-- El insert va sin `returning` (anon no puede leer); cada envío tiene su respuesta de encaje.

set role anon;

insert into public.piloto_encaje_respuestas
  (envio_id, codigo, p1_dias, p1_horarios, p2_lugar, p2_modalidad, p3_expectativa) values
  ('97777777-1111-4111-8111-000000000001', 'PRUEBAE', '3', 'fijos', 'gimnasio', 'en línea', 'fuerza'),
  ('97777777-1111-4111-8111-000000000002', 'PRUEBAE', '3', 'fijos', 'gimnasio', 'en línea', 'fuerza'),
  ('97777777-1111-4111-8111-000000000003', 'PRUEBAE', '3', 'fijos', 'gimnasio', 'en línea', 'fuerza'),
  ('97777777-1111-4111-8111-000000000004', 'PRUEBAE', '3', 'fijos', 'gimnasio', 'en línea', 'fuerza'),
  ('97777777-1111-4111-8111-000000000005', 'PRUEBAE', '3', 'fijos', 'gimnasio', 'en línea', 'fuerza');

-- El texto 0.4 entra, con la E en «sí»…
insert into public.piloto_autorizaciones
  (envio_id, version_autorizacion, canal, casilla_a, casilla_b, casilla_c, casilla_d, casilla_e, declaracion_aceptada) values
  ('97777777-1111-4111-8111-000000000001', '0.4', 'formulario', 'no', 'no', 'no', 'no', 'si', true);

do $$
begin
  -- …el 0.3 con la E en «sí» no (esa persona no vio la casilla, no pudo autorizarla)…
  begin
    insert into public.piloto_autorizaciones
      (envio_id, version_autorizacion, canal, casilla_a, casilla_b, casilla_c, casilla_d, casilla_e, declaracion_aceptada) values
      ('97777777-1111-4111-8111-000000000002', '0.3', 'formulario', 'no', 'no', 'no', 'no', 'si', true);
    raise exception 'FALLO: se aceptó una E en «sí» con el texto 0.3';
  exception when insufficient_privilege then null;
  end;
  -- …una versión que no existe, tampoco…
  begin
    insert into public.piloto_autorizaciones
      (envio_id, version_autorizacion, canal, casilla_a, casilla_b, casilla_c, casilla_d, casilla_e, declaracion_aceptada) values
      ('97777777-1111-4111-8111-000000000003', '0.5', 'formulario', 'no', 'no', 'no', 'no', 'no', true);
    raise exception 'FALLO: se aceptó una versión del texto que no existe';
  exception when insufficient_privilege then null;
  end;
  -- …y la casilla solo admite sí o no.
  begin
    insert into public.piloto_autorizaciones
      (envio_id, version_autorizacion, canal, casilla_a, casilla_b, casilla_c, casilla_d, casilla_e, declaracion_aceptada) values
      ('97777777-1111-4111-8111-000000000004', '0.4', 'formulario', 'no', 'no', 'no', 'no', 'quizas', true);
    raise exception 'FALLO: la casilla E aceptó un valor que no es sí ni no';
  exception when check_violation then null;
  end;
end $$;

-- Quien tenía la página abierta con el texto 0.3 sigue pudiendo enviar (sin E: cuenta como «no»).
insert into public.piloto_autorizaciones
  (envio_id, version_autorizacion, canal, casilla_a, casilla_b, casilla_c, casilla_d, declaracion_aceptada) values
  ('97777777-1111-4111-8111-000000000005', '0.3', 'formulario', 'si', 'no', 'no', 'no', true);

reset role;

select pruebas.afirmar(
  (select casilla_e from public.piloto_autorizaciones where envio_id = '97777777-1111-4111-8111-000000000001') = 'si'
    and (select casilla_e from public.piloto_autorizaciones where envio_id = '97777777-1111-4111-8111-000000000005') = 'no'
    and (select count(*) from public.piloto_autorizaciones where envio_id::text like '97777777-1111-4111-8111-%') = 2,
  'la evidencia del formulario no guardó la E como debía (0.4 sí; 0.3 sin E = no) o dejó filas de más'
);

rollback;
