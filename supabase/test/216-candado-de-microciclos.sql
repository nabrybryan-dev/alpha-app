-- Candado de microciclos (migración 0147): la app y la cadena no se pisan en silencio.
--
-- Qué se prueba:
--   1. Lo que entra sin sesión de usuario (la cadena) queda con origen 'cadena'; lo que entra con
--      sesión (el coach en la app) queda 'app', con quién y cuándo.
--   2. La app NO activa una propuesta si la cadena ya cargó esa semana (o una posterior): no
--      levanta excepción, no activa, y deja un aviso con quién la cargó y cuándo.
--   3. La cadena (insert o update directo, contexto de servicio) NO activa encima de una semana de
--      la app: NO hay excepción (una excepción deshace también el aviso) y el choque queda
--      REGISTRADO; la fila queda 'propuesto'. «Cerrado» también cuenta como semana ocupada.
--   4. Un número MAYOR sobre uno de otro origen es el relevo normal: pasa sin aviso.
--   5. Misma procedencia: pasa sin aviso.
--   6. Confirmar (solo el coach) activa de verdad y cierra el aviso; un asesorado no confirma ni
--      descarta (se comprueba el MENSAJE de la guarda, no cualquier 42501, y que nada cambió);
--      confirmar sobre una propuesta que no se puede activar falla y deja el aviso pendiente.
--   7. La cadena confirma con set_config('alpha.pisar_microciclo','si',true).
--   8. Un primer plan que choca queda en espera_bryan (decidir y vencer), nunca 'aprobado' sin activar.
--   9. El asesorado no lee los avisos; anon no ejecuta NINGUNA función de la 0147.
--  10. El trigger que fija el origen se dispara antes que el candado (por nombre y por comportamiento).
-- Bloque de UUID propio (d2…/e2…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('d2000000-0000-0000-0000-000000000001', 'cd-a@ejemplo.test'),
  ('d2000000-0000-0000-0000-000000000002', 'cd-b@ejemplo.test'),
  ('d2000000-0000-0000-0000-000000000003', 'cd-c@ejemplo.test'),
  ('d2000000-0000-0000-0000-000000000004', 'cd-d@ejemplo.test'),
  ('d2000000-0000-0000-0000-000000000005', 'cd-e@ejemplo.test'),
  ('d2000000-0000-0000-0000-000000000006', 'cd-f@ejemplo.test'),
  ('e2000000-0000-0000-0000-000000000001', 'cd-coach@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('d2000000-0000-0000-0000-000000000001', 'Candado A', 'asesorado', 'CA'),
  ('d2000000-0000-0000-0000-000000000002', 'Candado B', 'asesorado', 'CB'),
  ('d2000000-0000-0000-0000-000000000003', 'Candado C', 'asesorado', 'CC'),
  ('d2000000-0000-0000-0000-000000000004', 'Candado D', 'asesorado', 'CD'),
  ('d2000000-0000-0000-0000-000000000005', 'Candado E', 'asesorado', 'CE'),
  ('d2000000-0000-0000-0000-000000000006', 'Candado F', 'asesorado', 'CF'),
  ('e2000000-0000-0000-0000-000000000001', 'Coach candado', 'coach', 'CO')
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;

-- Como la cadena: sin sesión de usuario.
insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('cd-a-8',  'd2000000-0000-0000-0000-000000000001', 8, 'activo', '{}'::jsonb),
  ('cd-b-8',  'd2000000-0000-0000-0000-000000000002', 8, 'cerrado', '{}'::jsonb),
  ('cd-b-9',  'd2000000-0000-0000-0000-000000000002', 9, 'activo', '{}'::jsonb),
  ('cd-c-8',  'd2000000-0000-0000-0000-000000000003', 8, 'activo', '{}'::jsonb),
  ('cd-d-9',  'd2000000-0000-0000-0000-000000000004', 9, 'activo', '{}'::jsonb),
  ('cd-e-5',  'd2000000-0000-0000-0000-000000000005', 5, 'activo', '{}'::jsonb),
  ('cd-f-5',  'd2000000-0000-0000-0000-000000000006', 5, 'activo', '{}'::jsonb);

insert into public.capacidades_staff (usuario_id, capacidad) values
  ('e2000000-0000-0000-0000-000000000001', 'leer_entrenamiento'),
  ('e2000000-0000-0000-0000-000000000001', 'aprobar_primer_plan'),
  ('e2000000-0000-0000-0000-000000000001', 'autorizar_excepcion')
on conflict do nothing;

select pruebas.afirmar(
  (select count(*) from public.microciclos where id like 'cd-%' and origen = 'cadena') = 7,
  'lo cargado sin sesión de usuario no quedó con origen cadena'
);

-- ─ 0 · El ORDEN de los triggers (hallazgo H4) ───────────────────────────
-- Postgres dispara por orden alfabético: el que fija el origen tiene que ir ANTES que el candado.
-- Se comprueba por nombre (la causa) y, más abajo, por comportamiento (el efecto).
select pruebas.afirmar(
  (select array_position(array_agg(tgname::text order by tgname::text), 'trg_microciclos_a_origen')
        < array_position(array_agg(tgname::text order by tgname::text), 'trg_microciclos_b_candado')
     from pg_trigger
    where tgrelid = 'public.microciclos'::regclass and not tgisinternal
      and tgname in ('trg_microciclos_a_origen', 'trg_microciclos_b_candado')),
  'el trigger que fija el origen no se dispara antes que el candado (orden alfabético de los nombres)'
);

-- ─ 1 · El coach, desde la app ───────────────────────────────────────────
select pruebas.soy('e2000000-0000-0000-0000-000000000001');
set role authenticated;
select pruebas.exigir_rls();

-- A: propone M9 sobre el M8 de la cadena (relevo normal) -> pasa.
insert into public.microciclos (id, usuario_id, numero, estado, datos)
values ('cd-a-9', 'd2000000-0000-0000-0000-000000000001', 9, 'propuesto', '{}'::jsonb);

select pruebas.afirmar(
  (select origen = 'app' and cargado_por = 'e2000000-0000-0000-0000-000000000001' and cargado_en is not null
     from public.microciclos where id = 'cd-a-9'),
  'lo cargado con sesión de usuario no quedó con origen app, autor y hora'
);

select public.activar_microciclo('cd-a-9');
select pruebas.afirmar(
  (select estado from public.microciclos where id = 'cd-a-9') = 'activo'
  and (select estado from public.microciclos where id = 'cd-a-8') = 'cerrado'
  and not exists (select 1 from public.microciclos_choques where usuario_id = 'd2000000-0000-0000-0000-000000000001'),
  'el relevo normal (M9 de la app sobre M8 de la cadena) no debió dar aviso ni quedarse sin activar'
);

-- B: la cadena ya activó M9; la app propone su M9 -> choque.
insert into public.microciclos (id, usuario_id, numero, estado, datos)
values ('cd-b-9app', 'd2000000-0000-0000-0000-000000000002', 9, 'propuesto', '{}'::jsonb);

select public.activar_microciclo('cd-b-9app');   -- no debe levantar excepción
select pruebas.afirmar(
  (select estado from public.microciclos where id = 'cd-b-9app') = 'propuesto'
  and (select estado from public.microciclos where id = 'cd-b-9') = 'activo',
  'la app pisó la semana que ya había cargado la cadena'
);
select pruebas.afirmar(
  (select count(*) from public.microciclos_choques
    where propuesta_id = 'cd-b-9app' and estado = 'pendiente'
      and existente_id = 'cd-b-9' and existente_origen = 'cadena' and existente_en is not null) = 1,
  'el choque no quedó avisado con quién la cargó y cuándo'
);

-- H4 por comportamiento: el coach (sesión) inserta DIRECTO un M9 'activo' sobre el M9 'activo' de la
-- cadena de D. Con el origen ya fijado ('app') eso es un choque. Si el candado se evaluara antes de
-- fijar el origen vería 'cadena' (el valor por defecto), no vería choque y activaría en silencio.
insert into public.microciclos (id, usuario_id, numero, estado, datos)
values ('cd-d-9app', 'd2000000-0000-0000-0000-000000000004', 9, 'activo', '{}'::jsonb);
select pruebas.afirmar(
  (select origen = 'app' and estado = 'propuesto' from public.microciclos where id = 'cd-d-9app')
  and (select estado from public.microciclos where id = 'cd-d-9') = 'activo',
  'un insert activo con sesión pisó la semana de la cadena (¿el candado corre antes de fijar el origen?)'
);
select pruebas.afirmar(
  (select count(*) from public.microciclos_choques
    where propuesta_id = 'cd-d-9app' and estado = 'pendiente'
      and propuesta_origen = 'app' and existente_id = 'cd-d-9' and existente_origen = 'cadena') = 1,
  'el insert activo con sesión no dejó su aviso'
);

-- Un reintento de la cola no duplica el aviso.
select public.activar_microciclo('cd-b-9app');
select pruebas.afirmar(
  (select count(*) from public.microciclos_choques where propuesta_id = 'cd-b-9app') = 1,
  'un reintento duplicó el aviso'
);

-- ─ 3 · La cadena no pisa lo de la app (insert directo, sin sesión) ──────
-- H3: NO hay excepción (si la hubiera, el script se pararía aquí por ON_ERROR_STOP) y el choque
-- queda ESCRITO. A tiene el M9 de la app activo.
reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into public.microciclos (id, usuario_id, numero, estado, datos)
values ('cd-a-9cad', 'd2000000-0000-0000-0000-000000000001', 9, 'activo', '{}'::jsonb);

select pruebas.afirmar(
  (select origen = 'cadena' and estado = 'propuesto' from public.microciclos where id = 'cd-a-9cad')
  and (select estado from public.microciclos where id = 'cd-a-9') = 'activo',
  'la cadena pisó en silencio una semana de la app (o su fila quedó activa)'
);
select pruebas.afirmar(
  (select count(*) from public.microciclos_choques
    where propuesta_id = 'cd-a-9cad' and estado = 'pendiente'
      and propuesta_origen = 'cadena' and existente_id = 'cd-a-9' and existente_origen = 'app'
      and existente_por = 'e2000000-0000-0000-0000-000000000001') = 1,
  'el choque de la cadena no quedó registrado (con quién la cargó)'
);

-- LINEA DE DEFENSA H1: «cerrado» cuenta. La plantilla vieja cerraba el activo y luego insertaba el
-- suyo; si alguien quita 'cerrado' de microciclo_choque, esta fila se activaría sin aviso.
update public.microciclos set estado = 'cerrado' where id = 'cd-a-9';
insert into public.microciclos (id, usuario_id, numero, estado, datos)
values ('cd-a-9cad2', 'd2000000-0000-0000-0000-000000000001', 9, 'activo', '{}'::jsonb);
select pruebas.afirmar(
  (select estado from public.microciclos where id = 'cd-a-9cad2') = 'propuesto'
  and (select count(*) from public.microciclos_choques
        where propuesta_id = 'cd-a-9cad2' and estado = 'pendiente'
          and existente_id = 'cd-a-9') = 1
  and (select estado from public.microciclos where id = 'cd-a-9') = 'cerrado',
  'una semana de la app YA CERRADA no cuenta como choque (¿alguien quitó cerrado de microciclo_choque?)'
);

-- Pasar una propuesta a activo con UPDATE también topa con el candado, y sin duplicar el aviso.
update public.microciclos set estado = 'activo' where id = 'cd-a-9cad';
select pruebas.afirmar(
  (select estado from public.microciclos where id = 'cd-a-9cad') = 'propuesto'
  and (select count(*) from public.microciclos_choques where propuesta_id = 'cd-a-9cad') = 1,
  'un UPDATE a activo pisó la semana de la app o duplicó el aviso'
);

-- ─ 7 · La cadena confirma de forma explícita ────────────────────────────
select set_config('alpha.pisar_microciclo', 'si', true);
update public.microciclos set estado = 'activo' where id = 'cd-a-9cad';
select set_config('alpha.pisar_microciclo', '', true);
select pruebas.afirmar(
  (select estado from public.microciclos where id = 'cd-a-9cad') = 'activo',
  'la cadena no pudo activar con la confirmación explícita'
);

-- ─ 5 · Misma procedencia: sin aviso ─────────────────────────────────────
insert into public.microciclos (id, usuario_id, numero, estado, datos)
values ('cd-c-9', 'd2000000-0000-0000-0000-000000000003', 9, 'propuesto', '{}'::jsonb);
select public.activar_microciclo('cd-c-9');
select pruebas.afirmar(
  (select estado from public.microciclos where id = 'cd-c-9') = 'activo'
  and not exists (select 1 from public.microciclos_choques where usuario_id = 'd2000000-0000-0000-0000-000000000003'),
  'cadena sobre cadena dio aviso o no activó'
);

-- ─ 6 · Confirmar: solo el coach ─────────────────────────────────────────
-- Un asesorado no confirma NI descarta. Cada intento tiene que morir por la GUARDA (se comprueba
-- el mensaje: un 42501 cualquiera —permiso denegado sobre una tabla o una función— no basta, porque
-- también sería insufficient_privilege) y, después, nada puede haber cambiado. Si la función NO
-- fallara, el `raise exception 'FALLO...'` de abajo es P0001 y NO lo captura `insufficient_privilege`.
-- El asesorado no puede leer la tabla: el id del aviso se guarda ANTES, como dueño.
select set_config('prueba.choque_b', (select id::text from public.microciclos_choques where propuesta_id = 'cd-b-9app'), false);
select pruebas.soy('d2000000-0000-0000-0000-000000000002');
set role authenticated;
do $$
declare v_msg text;
begin
  begin
    perform public.confirmar_pisar_microciclo('cd-b-9app');
    raise exception 'FALLO: un asesorado confirmó pisar un microciclo';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like 'confirmar_pisar_microciclo: solo el coach confirma%' then
      raise exception 'FALLO: murió por otra causa y no por la guarda del coach: %', v_msg;
    end if;
  end;
  begin
    perform public.descartar_choque_microciclo(current_setting('prueba.choque_b')::uuid);
    raise exception 'FALLO: un asesorado descartó un aviso';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like 'descartar_choque_microciclo: solo el coach decide%' then
      raise exception 'FALLO: descartar murió por otra causa y no por la guarda del coach: %', v_msg;
    end if;
  end;
end $$;
select pruebas.afirmar(
  (select count(*) from public.microciclos_choques) = 0,
  'el asesorado puede leer los avisos de choque'
);
reset role;
select pruebas.afirmar(
  (select estado from public.microciclos where id = 'cd-b-9app') = 'propuesto'
  and (select estado from public.microciclos_choques where propuesta_id = 'cd-b-9app') = 'pendiente',
  'un asesorado cambió algo (la propuesta o el aviso) aunque su llamada falló'
);

reset role;
select pruebas.soy('e2000000-0000-0000-0000-000000000001');
set role authenticated;
select public.confirmar_pisar_microciclo('cd-b-9app');
select pruebas.afirmar(
  (select estado from public.microciclos where id = 'cd-b-9app') = 'activo'
  and (select estado from public.microciclos where id = 'cd-b-9') = 'cerrado'
  and (select estado from public.microciclos_choques where propuesta_id = 'cd-b-9app') = 'confirmado',
  'confirmar no activó la propuesta, no cerró la de la cadena o no cerró el aviso'
);

-- Confirmar sobre una propuesta que ya no se puede activar (cerrada) NO marca el aviso confirmado.
-- B tiene el aviso de cd-b-9app ya confirmado; se siembra otro para una propuesta cerrada de C.
reset role;
insert into public.microciclos (id, usuario_id, numero, estado, datos)
values ('cd-c-7', 'd2000000-0000-0000-0000-000000000003', 7, 'cerrado', '{}'::jsonb);
insert into public.microciclos_choques
  (id, usuario_id, propuesta_id, propuesta_numero, propuesta_origen, existente_numero, existente_origen)
values ('c3000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000003', 'cd-c-7', 7, 'app', 8, 'cadena');
select pruebas.soy('e2000000-0000-0000-0000-000000000001');
set role authenticated;
do $$
declare v_msg text;
begin
  begin
    perform public.confirmar_pisar_microciclo('cd-c-7');
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like 'confirmar_pisar_microciclo: la propuesta cd-c-7 no quedó activa%' then
      raise exception 'FALLO: error inesperado al confirmar una propuesta cerrada: %', v_msg;
    end if;
    return;
  end;
  raise exception 'FALLO: confirmar sobre una propuesta cerrada no dio error';
end $$;
reset role;
select pruebas.afirmar(
  (select estado from public.microciclos_choques where id = 'c3000000-0000-0000-0000-000000000001') = 'pendiente'
  and (select estado from public.microciclos where id = 'cd-c-7') = 'cerrado',
  'confirmar_pisar_microciclo marcó confirmado un aviso sin activar nada'
);
select pruebas.soy('e2000000-0000-0000-0000-000000000001');
set role authenticated;

-- La confirmación no queda abierta para la siguiente operación de la sesión.
select pruebas.afirmar(
  coalesce(current_setting('alpha.pisar_microciclo', true), '') <> 'si',
  'la confirmación quedó puesta en la sesión'
);

-- ─ 8 · Un primer plan que choca NO queda 'aprobado' sin activar (riesgo (b)) ─
-- E y F tienen el M5 de la cadena activo; la app propone su M5 (con sesión: origen 'app').
insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('cd-e-5app', 'd2000000-0000-0000-0000-000000000005', 5, 'propuesto', '{}'::jsonb),
  ('cd-f-5app', 'd2000000-0000-0000-0000-000000000006', 5, 'propuesto', '{}'::jsonb);

reset role;
delete from public.aprobaciones_primer_plan where microciclo_id in ('cd-e-5app', 'cd-f-5app');
insert into public.aprobaciones_primer_plan (id, usuario_id, microciclo_id, riesgo, dudas_pendientes, plazo_hasta) values
  ('c2000000-0000-0000-0000-000000000005', 'd2000000-0000-0000-0000-000000000005', 'cd-e-5app', 'bajo', '{}', now() + interval '1 day'),
  ('c2000000-0000-0000-0000-000000000006', 'd2000000-0000-0000-0000-000000000006', 'cd-f-5app', 'bajo', '{}', now() - interval '1 minute');

-- decidir_primer_plan: el coach aprueba y la base no activa por el choque.
select pruebas.soy('e2000000-0000-0000-0000-000000000001');
set role authenticated;
select public.decidir_primer_plan('c2000000-0000-0000-0000-000000000005', 'aprobar');
reset role;
select pruebas.afirmar(
  (select estado from public.aprobaciones_primer_plan where id = 'c2000000-0000-0000-0000-000000000005') = 'espera_bryan'
  and (select motivo_espera from public.aprobaciones_primer_plan where id = 'c2000000-0000-0000-0000-000000000005') like 'Choque de microciclo%'
  and (select decidido_por from public.aprobaciones_primer_plan where id = 'c2000000-0000-0000-0000-000000000005') is null
  and (select estado from public.microciclos where id = 'cd-e-5app') = 'propuesto'
  and (select estado from public.microciclos where id = 'cd-e-5') = 'activo',
  'decidir_primer_plan dejó el plan aprobado con el microciclo sin activar (o activó encima de la cadena)'
);
select pruebas.afirmar(
  (select count(*) from public.microciclos_choques where propuesta_id = 'cd-e-5app' and estado = 'pendiente') = 1,
  'decidir_primer_plan con choque no dejó el aviso (¿se lanzó una excepción que lo deshizo?)'
);

-- vencer_primer_plan: lo vencido que choca NO cuenta como vencido_aprobado.
select * from public.vencer_primer_plan();
select pruebas.afirmar(
  (select estado from public.aprobaciones_primer_plan where id = 'c2000000-0000-0000-0000-000000000006') = 'espera_bryan'
  and (select motivo_espera from public.aprobaciones_primer_plan where id = 'c2000000-0000-0000-0000-000000000006') like 'Choque de microciclo%'
  and (select estado from public.microciclos where id = 'cd-f-5app') = 'propuesto',
  'vencer_primer_plan contó como vencido_aprobado un plan que el candado no activó'
);
select pruebas.afirmar(
  (select count(*) from public.microciclos_choques where propuesta_id = 'cd-f-5app' and estado = 'pendiente') = 1,
  'vencer_primer_plan con choque no dejó el aviso'
);

-- ─ 9 · anon no ejecuta NADA de la 0147 (LINEA DE DEFENSA H2) ─────────────
-- Con uid nulo la guarda `auth.uid() is not null and not es_coach()` DEJA PASAR: lo único que frena a
-- anon es el revoke. Si alguien lo quita (o lo deja en `from public` sin `anon`), esto se pone rojo.
select pruebas.afirmar(
  not has_function_privilege('anon', 'public.descartar_choque_microciclo(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.confirmar_pisar_microciclo(text)', 'execute')
  and not has_function_privilege('anon', 'public.registrar_choque_microciclo(text)', 'execute')
  and not has_function_privilege('anon', 'public.microciclo_choque(uuid,text,integer,text)', 'execute')
  and not has_function_privilege('anon', 'public.activar_microciclo(text)', 'execute')
  and not has_function_privilege('anon', 'public.decidir_primer_plan(uuid,text,text)', 'execute')
  and not has_function_privilege('anon', 'public.vencer_primer_plan()', 'execute'),
  'anon puede ejecutar una función de la 0147 (¿falta anon en algún revoke?)'
);

-- Y por comportamiento: anon intenta descartar un aviso pendiente y la base lo rechaza por permiso.
reset role;
select set_config('request.jwt.claim.sub', '', false);
-- Un aviso que SIGUE pendiente (el de E, del bloque 8): si el revoke faltara, anon lo descartaría.
select set_config('prueba.choque_e', (select id::text from public.microciclos_choques where propuesta_id = 'cd-e-5app'), false);
set role anon;
do $$
declare v_msg text;
begin
  begin
    perform public.descartar_choque_microciclo(current_setting('prueba.choque_e')::uuid);
    raise exception 'FALLO: anon descartó un aviso de choque';
  exception when insufficient_privilege then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like 'permission denied for function descartar_choque_microciclo%' then
      raise exception 'FALLO: anon murió por otra causa: %', v_msg;
    end if;
  end;
end $$;
reset role;
select pruebas.afirmar(
  (select estado from public.microciclos_choques where propuesta_id = 'cd-e-5app') = 'pendiente',
  'el aviso de E dejó de estar pendiente tras el intento de anon'
);

\echo 'OK · candado de microciclos (0147)'

rollback;
