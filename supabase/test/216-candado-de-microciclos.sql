-- Candado de microciclos (migración 0147): la app y la cadena no se pisan en silencio.
--
-- Qué se prueba:
--   1. Lo que entra sin sesión de usuario (la cadena) queda con origen 'cadena'; lo que entra con
--      sesión (el coach en la app) queda 'app', con quién y cuándo.
--   2. La app NO activa una propuesta si la cadena ya cargó esa semana (o una posterior): no
--      levanta excepción, no activa, y deja un aviso con quién la cargó y cuándo.
--   3. La cadena (insert directo, contexto de servicio) NO activa encima de una semana de la app:
--      la excepción aborta y el activo de la app sigue activo.
--   4. Un número MAYOR sobre uno de otro origen es el relevo normal: pasa sin aviso.
--   5. Misma procedencia: pasa sin aviso.
--   6. Confirmar (solo el coach) activa de verdad y cierra el aviso; un asesorado no confirma.
--   7. La cadena confirma con set_config('alpha.pisar_microciclo','si',true).
--   8. El asesorado no lee los avisos.
-- Bloque de UUID propio (d2…/e2…). ROLLBACK al final.

\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email) values
  ('d2000000-0000-0000-0000-000000000001', 'cd-a@ejemplo.test'),
  ('d2000000-0000-0000-0000-000000000002', 'cd-b@ejemplo.test'),
  ('d2000000-0000-0000-0000-000000000003', 'cd-c@ejemplo.test'),
  ('d2000000-0000-0000-0000-000000000004', 'cd-d@ejemplo.test'),
  ('e2000000-0000-0000-0000-000000000001', 'cd-coach@ejemplo.test')
on conflict (id) do nothing;

insert into public.usuarios_app (id, nombre, rol, avatar_iniciales) values
  ('d2000000-0000-0000-0000-000000000001', 'Candado A', 'asesorado', 'CA'),
  ('d2000000-0000-0000-0000-000000000002', 'Candado B', 'asesorado', 'CB'),
  ('d2000000-0000-0000-0000-000000000003', 'Candado C', 'asesorado', 'CC'),
  ('d2000000-0000-0000-0000-000000000004', 'Candado D', 'asesorado', 'CD'),
  ('e2000000-0000-0000-0000-000000000001', 'Coach candado', 'coach', 'CO')
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;

-- Como la cadena: sin sesión de usuario.
insert into public.microciclos (id, usuario_id, numero, estado, datos) values
  ('cd-a-8',  'd2000000-0000-0000-0000-000000000001', 8, 'activo', '{}'::jsonb),
  ('cd-b-8',  'd2000000-0000-0000-0000-000000000002', 8, 'cerrado', '{}'::jsonb),
  ('cd-b-9',  'd2000000-0000-0000-0000-000000000002', 9, 'activo', '{}'::jsonb),
  ('cd-c-8',  'd2000000-0000-0000-0000-000000000003', 8, 'activo', '{}'::jsonb),
  ('cd-d-9',  'd2000000-0000-0000-0000-000000000004', 9, 'activo', '{}'::jsonb);

select pruebas.afirmar(
  (select count(*) from public.microciclos where id like 'cd-%' and origen = 'cadena') = 5,
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
select pruebas.soy('d2000000-0000-0000-0000-000000000002');
set role authenticated;
do $$
begin
  begin
    perform public.confirmar_pisar_microciclo('cd-b-9app');
    raise exception 'FALLO: un asesorado confirmó pisar un microciclo';
  exception
    when insufficient_privilege then null;
  end;
end $$;
select pruebas.afirmar(
  (select count(*) from public.microciclos_choques) = 0,
  'el asesorado puede leer los avisos de choque'
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

-- La confirmación no queda abierta para la siguiente operación de la sesión.
select pruebas.afirmar(
  coalesce(current_setting('alpha.pisar_microciclo', true), '') <> 'si',
  'la confirmación quedó puesta en la sesión'
);

\echo 'OK · candado de microciclos (0147)'

rollback;
