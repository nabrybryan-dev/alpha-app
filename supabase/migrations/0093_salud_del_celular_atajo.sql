-- ============================================================================
-- 0093 · Salud del celular, Fase A: el Atajo de Apple manda un resumen diario
-- ============================================================================
--
-- NO SE HA APLICADO. Se aplica a mano en el SQL Editor cuando Bryan lo decida, y solo
-- DESPUÉS de la 0083 (capacidades) y de la 0089 (piloto de interesados): las dos se
-- comprueban al principio y la migración se detiene con un mensaje claro si falta alguna.
--
-- ORDEN, Y NO ES NEGOCIABLE: ESTA MIGRACIÓN ANTES QUE EL CÓDIGO. El formulario público de
-- interesados de esta misma rama manda `casilla_e` y el texto 0.4. Si ese código llega a
-- `main` (= producción) sin esta migración aplicada, la base no tiene la columna ni acepta
-- el 0.4, y el formulario deja de guardar: es la puerta de entrada de los creadores. Al
-- revés no rompe nada: con esto aplicado, el formulario viejo (0.3, sin E) sigue entrando.
-- Comprobar con `comprobar-migraciones.sql` (filas «0093 - …» en SI) antes de fusionar.
--
-- NÚMERO. El 28-sep ninguna rama traía una 0093. El 4-oct `main` llega a la 0110 y la
-- 0093 sigue libre (las otras se numeraron alrededor). Escrita antes que la 0094–0110, se
-- aplica después de ellas: no toca nada de lo que crearon (comprobado el 4-oct).
--
-- Diseño: `vigia-codex/estilo-de-vida/COSTOS-APP-NATIVA-Y-SALUD.md` (§3 Fase 1, §5 lo
-- legal). Decisiones de Bryan (28-sep): iPhone con un Atajo que lee Salud y lo manda una
-- vez al día a la Edge Function `salud-atajo`; Android con registro a mano; permiso con
-- una casilla E NUEVA y específica para los 6 datos (pasos, sueño, FC en reposo, VFC,
-- minutos de ejercicio y peso), sin marcar por defecto (Ley 1581 de 2012: datos sensibles,
-- finalidad concreta, revocable).
--
-- QUÉ ENTRA.
--   A. `piloto_autorizaciones.casilla_e`: la casilla E también viaja en el formulario
--      público de interesados (texto v0.4). Las filas anteriores cuentan como «no».
--   B. `salud_consentimientos`: el permiso E de una PERSONA CON CUENTA, como registro de
--      eventos que solo se añade (otorgada / revocada). Es la prueba de la autorización
--      (Ley 1581, art. 17 lit. b) y lo que la Edge Function consulta antes de guardar.
--   C. `salud_muestras`: un resumen por persona, día y tipo. La fuente distingue
--      `atajo`, `manual` y `nativa`, así que el paso a la app nativa (Fase 2 y 3) reutiliza
--      la misma tabla sin tocar a quien la lee.
--   D. `salud_atajo_tokens`: el código que la persona pega en el Atajo. SOLO se guarda su
--      HASH (sha-256); el código en claro se muestra una vez, al generarlo.
--   E. Funciones. Las de la persona (dar/revocar el permiso, generar/revocar el código,
--      ver el estado) usan `auth.uid()` y jamás un parámetro para saber quién es. Las de
--      la Edge Function (`salud_atajo_autorizar`, `salud_atajo_guardar`) solo las puede
--      llamar `service_role`.
--
-- QUIÉN ESCRIBE Y QUIÉN LEE.
--   · Nadie con sesión de usuario ni con la anon key inserta, actualiza o borra en estas
--     tablas directamente: sin política de escritura y sin privilegio. Escribe
--     `service_role` (la Edge Function) y las funciones `security definer` de arriba.
--   · Lee cada persona lo suyo, y quien tenga la capacidad `leer_entrenamiento` (0083)
--     lee todo. A propósito NO se añade `es_coach()` como en la 0088: son datos de salud
--     sensibles y la capacidad es explícita; Bryan la recibe al asignar las capacidades
--     (bloque comentado al final de la 0083).
--   · De los tokens, ni la persona ni el staff pueden leer el hash: el privilegio de
--     SELECT es por columna.
--
-- SEGURIDAD, la regla de siempre (`GUIA-BRYAN.md` §10): cada `create table` enciende RLS
-- en el mismo paso y pierde sus privilegios por defecto antes de conceder nada; cada
-- función `security definer` lleva `set search_path = public` fijo y su `revoke` explícito
-- (toda función en `public` queda expuesta como RPC a `anon` en cuanto se crea).
--
-- MINIMIZACIÓN. Solo resúmenes diarios, nada de muestras crudas, ubicación ni rutas
-- (COSTOS §5.1, punto 2). El texto libre no tiene sitio en ninguna columna.
--
-- CONSERVACIÓN. Sin purga automática en esta fase. Al REVOCAR el permiso la persona puede
-- pedir que se borre lo enviado (`salud_revocar_consentimiento(true)`); el plazo de 15 días
-- hábiles del documento de autorización v0.4, §7, queda cubierto por ese borrado inmediato.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 0 · Prerrequisitos: mejor detenerse aquí que a la mitad
-- ────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.piloto_autorizaciones') is null then
    raise exception '0093 exige la 0089 aplicada: falta public.piloto_autorizaciones';
  end if;
  if to_regprocedure('public.tiene_capacidad(text)') is null then
    raise exception '0093 exige la 0083 aplicada: falta public.tiene_capacidad(text)';
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- A · La casilla E en el formulario público de interesados (texto v0.4)
-- ────────────────────────────────────────────────────────────────────────────
-- Las filas guardadas con el texto 0.3 nunca vieron la E: cuentan como «no». El valor por
-- defecto lo deja escrito, y así la evidencia sigue diciendo la verdad.
alter table public.piloto_autorizaciones
  add column if not exists casilla_e text not null default 'no'
  check (casilla_e in ('si', 'no'));

-- El formulario público inserta SOLO con un texto que existe: el vigente (0.4) o, para
-- quien tenga la página abierta desde antes con el texto 0.3 en pantalla, ese mismo texto
-- con la E en «no» (esa persona no la vio, no pudo autorizarla). Publicar una versión
-- nueva sigue exigiendo cambiar esta política (regla de la 0089).
drop policy if exists piloto_autorizacion_insertar_formulario on public.piloto_autorizaciones;
create policy piloto_autorizacion_insertar_formulario on public.piloto_autorizaciones
  for insert to anon, authenticated
  with check (
    (version_autorizacion = '0.4' or (version_autorizacion = '0.3' and casilla_e = 'no'))
    and canal = 'formulario'
    and revocaciones = '[]'::jsonb
  );

-- ────────────────────────────────────────────────────────────────────────────
-- B · SALUD_CONSENTIMIENTOS — el permiso E de cada persona con cuenta
-- ────────────────────────────────────────────────────────────────────────────
-- Una fila por EVENTO, nunca se reescribe: otorgar y revocar son dos hechos con su fecha,
-- y la prueba de la autorización tiene que sobrevivir a la revocación. «Vigente» = el
-- último evento de la persona es `otorgada` (`salud_consentimiento_vigente`).
create table if not exists public.salud_consentimientos (
  id                   bigint generated always as identity primary key,
  usuario_id           uuid not null references public.usuarios_app(id) on delete cascade,
  evento               text not null check (evento in ('otorgada', 'revocada')),
  -- La versión del texto de la autorización que la persona vio (0.4 = la que trae la E).
  version_autorizacion text not null check (version_autorizacion ~ '^[0-9]+[.][0-9]+$'),
  -- La pone el servidor (trigger de abajo): la prueba no depende del reloj del teléfono.
  fecha_hora           timestamptz not null default now(),
  canal                text not null default 'app' check (canal in ('app')),
  -- La declaración del documento (mayor de 18, leyó el texto, es voluntario): obligatoria
  -- al otorgar; al revocar no aplica.
  declaracion_aceptada boolean,
  check (evento <> 'otorgada' or declaracion_aceptada is true)
);

comment on table public.salud_consentimientos is
  'Casilla E (pasos, sueño, FC en reposo, VFC, minutos de ejercicio y peso del celular): '
  'eventos otorgada/revocada por persona. Solo se añade. Escribe únicamente la función '
  'salud_dar_consentimiento / salud_revocar_consentimiento (auth.uid()). Ley 1581, arts. 6, 9 y 17.';

create index if not exists salud_consentimientos_por_usuario
  on public.salud_consentimientos (usuario_id, id desc);

alter table public.salud_consentimientos enable row level security;

create or replace function public.salud_consentimiento_fecha_del_servidor()
returns trigger language plpgsql set search_path = public as $$
begin
  new.fecha_hora := now();
  return new;
end;
$$;
revoke all on function public.salud_consentimiento_fecha_del_servidor() from public, anon, authenticated;
drop trigger if exists trg_salud_consentimiento_fecha on public.salud_consentimientos;
create trigger trg_salud_consentimiento_fecha
  before insert on public.salud_consentimientos
  for each row execute function public.salud_consentimiento_fecha_del_servidor();

-- Lee: la propia persona, y quien tenga `leer_entrenamiento`.
drop policy if exists salud_consentimientos_leer on public.salud_consentimientos;
create policy salud_consentimientos_leer on public.salud_consentimientos
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

-- Sin política de insert/update/delete y sin esos privilegios: se escribe por las funciones.
revoke all on public.salud_consentimientos from anon, public, authenticated;
grant select on public.salud_consentimientos to authenticated;
grant all on public.salud_consentimientos to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- C · SALUD_MUESTRAS — un resumen por persona, día y tipo
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.salud_muestras (
  id           bigint generated always as identity primary key,
  usuario_id   uuid not null references public.usuarios_app(id) on delete cascade,
  -- El DÍA (en la hora del teléfono) al que pertenece el resumen; no la hora de la muestra.
  fecha        date not null check (fecha >= date '2020-01-01'),
  tipo         text not null check (tipo in
                 ('pasos', 'sueno', 'fc_reposo', 'vfc', 'minutos_ejercicio', 'peso')),
  valor        numeric not null,
  unidad       text not null,
  -- Cómo se calculó la VFC: SDNN en iPhone (Salud), RMSSD en Android (Health Connect). Nunca
  -- se mezclan ni se les pone un umbral común (COSTOS §3). Vacío para los otros 5 tipos.
  metodo       text,
  fuente       text not null check (fuente in ('atajo', 'manual', 'nativa')),
  -- La hora de llegada la pone el servidor, al insertar y al actualizar (trigger).
  recibido_en  timestamptz not null default now(),
  -- Un dato por persona, día, tipo y fuente: reenviar el mismo día ACTUALIZA, no duplica.
  -- Es lo que hace idempotente al Atajo, que cada día reenvía los últimos días.
  unique (usuario_id, fecha, tipo, fuente),
  -- Unidad y rango plausible de cada tipo. Los mismos números que `RANGOS` en la Edge Function
  -- (hay una prueba que los compara): si difirieran, la función aceptaría algo que la tabla
  -- rechaza y el envío entero fallaría con un 500.
  check (
    (tipo = 'pasos'             and unidad = 'pasos' and valor between 0 and 100000) or
    (tipo = 'sueno'             and unidad = 'h'     and valor between 0 and 20) or
    (tipo = 'fc_reposo'         and unidad = 'lpm'   and valor between 25 and 140) or
    (tipo = 'vfc'               and unidad = 'ms'    and valor between 5 and 300) or
    (tipo = 'minutos_ejercicio' and unidad = 'min'   and valor between 0 and 600) or
    (tipo = 'peso'              and unidad = 'kg'    and valor between 25 and 300)
  ),
  -- Ojo con el NULL: una CHECK que da NULL se APRUEBA. Sin el `is not null`, una VFC sin
  -- método pasaba (la primera versión de esta restricción lo permitía; lo cazó la prueba 110).
  check (
    (tipo = 'vfc' and metodo is not null and metodo in ('sdnn', 'rmssd'))
    or (tipo <> 'vfc' and metodo is null)
  )
);

comment on table public.salud_muestras is
  'Resumen diario de salud del celular (casilla E): pasos, sueño, FC en reposo, VFC, minutos de '
  'ejercicio y peso. Sin muestras crudas, ubicación ni rutas. Escribe solo service_role / la '
  'función salud_atajo_guardar; nunca el navegador. Lee la persona y quien tenga leer_entrenamiento.';

alter table public.salud_muestras enable row level security;

create or replace function public.salud_muestra_recibida_del_servidor()
returns trigger language plpgsql set search_path = public as $$
begin
  new.recibido_en := now();
  return new;
end;
$$;
revoke all on function public.salud_muestra_recibida_del_servidor() from public, anon, authenticated;
drop trigger if exists trg_salud_muestra_recibida on public.salud_muestras;
create trigger trg_salud_muestra_recibida
  before insert or update on public.salud_muestras
  for each row execute function public.salud_muestra_recibida_del_servidor();

drop policy if exists salud_muestras_leer on public.salud_muestras;
create policy salud_muestras_leer on public.salud_muestras
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

revoke all on public.salud_muestras from anon, public, authenticated;
grant select on public.salud_muestras to authenticated;
grant all on public.salud_muestras to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- D · SALUD_ATAJO_TOKENS — el código de cada persona (solo el hash)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.salud_atajo_tokens (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references public.usuarios_app(id) on delete cascade,
  -- sha-256 en hexadecimal del código. El código en claro no se guarda en ninguna parte.
  token_hash        text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  creado_en         timestamptz not null default now(),
  revocado_en       timestamptz,
  -- La última vez que ENTRARON datos con este código (lo anota salud_atajo_guardar). No
  -- la última vez que se aceptó: la tarjeta lo enseña como «Último envío».
  ultimo_uso_en     timestamptz,
  -- Límite de frecuencia básico: envíos en la ventana de una hora (ver salud_atajo_autorizar).
  ventana_inicio    timestamptz,
  envios_en_ventana integer not null default 0 check (envios_en_ventana >= 0)
);

comment on table public.salud_atajo_tokens is
  'Código del Atajo de Apple por persona. Solo el hash; revocable; con la última vez que se usó. '
  'Un solo código activo por persona (índice parcial): generar uno nuevo revoca el anterior.';

-- Un solo código activo por persona. Es el patrón de `microciclos_un_activo_por_usuario`.
create unique index if not exists salud_atajo_tokens_un_activo_por_usuario
  on public.salud_atajo_tokens (usuario_id) where revocado_en is null;

alter table public.salud_atajo_tokens enable row level security;

drop policy if exists salud_atajo_tokens_leer on public.salud_atajo_tokens;
create policy salud_atajo_tokens_leer on public.salud_atajo_tokens
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

-- SELECT por columna: el hash no sale por la API ni para su dueño. Con `select *` la
-- consulta falla en voz alta; la app pide sus columnas o usa `salud_estado()`.
revoke all on public.salud_atajo_tokens from anon, public, authenticated;
grant select (id, usuario_id, creado_en, revocado_en, ultimo_uso_en)
  on public.salud_atajo_tokens to authenticated;
grant all on public.salud_atajo_tokens to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- E.1 · Funciones internas
-- ────────────────────────────────────────────────────────────────────────────

-- ¿El último evento de esta persona es «otorgada»? Sin eventos: no.
create or replace function public.salud_consentimiento_vigente(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select evento = 'otorgada'
       from public.salud_consentimientos
      where usuario_id = p_usuario
      order by id desc
      limit 1),
    false
  );
$$;
revoke all on function public.salud_consentimiento_vigente(uuid) from public, anon, authenticated;
grant execute on function public.salud_consentimiento_vigente(uuid) to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- E.2 · Funciones de la persona (auth.uid(), nunca un parámetro)
-- ────────────────────────────────────────────────────────────────────────────

-- Otorga el permiso E. Exige el texto vigente (0.4) y la declaración. Idempotente: si ya
-- está vigente no añade otra fila.
create or replace function public.salud_dar_consentimiento(p_version text, p_declaracion boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'salud_dar_consentimiento: hace falta una sesion' using errcode = '28000';
  end if;
  -- Publicar un texto nuevo exige cambiar esta función (misma regla que la política de
  -- piloto_autorizaciones): así no entra una autorización de un texto que no existe.
  if p_version is distinct from '0.4' then
    raise exception 'salud_dar_consentimiento: la version del texto no es la vigente' using errcode = '22023';
  end if;
  if p_declaracion is not true then
    raise exception 'salud_dar_consentimiento: falta aceptar la declaracion' using errcode = '22023';
  end if;

  if not public.salud_consentimiento_vigente(v_uid) then
    insert into public.salud_consentimientos (usuario_id, evento, version_autorizacion, declaracion_aceptada)
    values (v_uid, 'otorgada', p_version, true);
  end if;

  return jsonb_build_object('consentimiento', true);
end;
$$;
revoke all on function public.salud_dar_consentimiento(text, boolean) from public, anon;
grant execute on function public.salud_dar_consentimiento(text, boolean) to authenticated, service_role;

-- Revoca el permiso E: anota el evento, REVOCA el código del Atajo (sin código no entra
-- nada) y, si la persona lo pide, borra lo ya enviado. Idempotente.
create or replace function public.salud_revocar_consentimiento(p_borrar_datos boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_version text;
  v_tokens integer := 0;
  v_muestras integer := 0;
begin
  if v_uid is null then
    raise exception 'salud_revocar_consentimiento: hace falta una sesion' using errcode = '28000';
  end if;

  if public.salud_consentimiento_vigente(v_uid) then
    select version_autorizacion into v_version
      from public.salud_consentimientos
     where usuario_id = v_uid and evento = 'otorgada'
     order by id desc
     limit 1;
    insert into public.salud_consentimientos (usuario_id, evento, version_autorizacion)
    values (v_uid, 'revocada', v_version);
  end if;

  update public.salud_atajo_tokens set revocado_en = now()
   where usuario_id = v_uid and revocado_en is null;
  get diagnostics v_tokens = row_count;

  if coalesce(p_borrar_datos, false) then
    delete from public.salud_muestras where usuario_id = v_uid;
    get diagnostics v_muestras = row_count;
  end if;

  return jsonb_build_object(
    'consentimiento', false,
    'codigos_revocados', v_tokens,
    'muestras_borradas', v_muestras
  );
end;
$$;
revoke all on function public.salud_revocar_consentimiento(boolean) from public, anon;
grant execute on function public.salud_revocar_consentimiento(boolean) to authenticated, service_role;

-- Genera el código del Atajo. Exige el permiso E vigente. Revoca el anterior (solo hay uno
-- activo) y devuelve el código EN CLARO esta única vez: en la tabla solo queda su hash.
-- Formato: `sa_` + 40 hexadecimales sacados de dos UUID v4 del servidor: 154 bits de azar
-- (los 122 del primero, que fija 6 bits de versión y variante, y 32 del segundo).
-- El hash es el mismo que calcula la Edge Function: sha-256 del texto UTF-8, en hexadecimal.
create or replace function public.salud_atajo_generar_token()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'salud_atajo_generar_token: hace falta una sesion' using errcode = '28000';
  end if;
  if not public.salud_consentimiento_vigente(v_uid) then
    raise exception 'salud_atajo_generar_token: falta el permiso de la casilla E' using errcode = '42501';
  end if;

  update public.salud_atajo_tokens set revocado_en = now()
   where usuario_id = v_uid and revocado_en is null;

  v_token := 'sa_' || left(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 40);
  insert into public.salud_atajo_tokens (usuario_id, token_hash)
  values (v_uid, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'));

  return jsonb_build_object('token', v_token);
end;
$$;
revoke all on function public.salud_atajo_generar_token() from public, anon;
grant execute on function public.salud_atajo_generar_token() to authenticated, service_role;

-- Revoca el código activo. Devuelve si había uno.
create or replace function public.salud_atajo_revocar_token()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then
    raise exception 'salud_atajo_revocar_token: hace falta una sesion' using errcode = '28000';
  end if;
  update public.salud_atajo_tokens set revocado_en = now()
   where usuario_id = v_uid and revocado_en is null;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;
revoke all on function public.salud_atajo_revocar_token() from public, anon;
grant execute on function public.salud_atajo_revocar_token() to authenticated, service_role;

-- Lo que la pantalla necesita para pintarse: si hay permiso, si hay código y cuándo se usó
-- por última vez, y el día de la última muestra recibida. Sin el hash ni ningún valor.
create or replace function public.salud_estado()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_vigente boolean;
  v_token public.salud_atajo_tokens%rowtype;
begin
  if v_uid is null then
    raise exception 'salud_estado: hace falta una sesion' using errcode = '28000';
  end if;
  v_vigente := public.salud_consentimiento_vigente(v_uid);
  select * into v_token from public.salud_atajo_tokens
   where usuario_id = v_uid and revocado_en is null;

  return jsonb_build_object(
    'consentimiento', v_vigente,
    'consentimiento_desde', case when v_vigente then
      (select fecha_hora from public.salud_consentimientos
        where usuario_id = v_uid and evento = 'otorgada' order by id desc limit 1) end,
    'codigo_activo', v_token.id is not null,
    'codigo_creado_en', v_token.creado_en,
    'codigo_ultimo_uso_en', v_token.ultimo_uso_en,
    'ultima_muestra', (select max(fecha) from public.salud_muestras where usuario_id = v_uid)
  );
end;
$$;
revoke all on function public.salud_estado() from public, anon;
grant execute on function public.salud_estado() to authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- E.3 · Funciones de la Edge Function (solo service_role)
-- ────────────────────────────────────────────────────────────────────────────

-- Recibe el HASH del código (la función calcula el sha-256; el código en claro no llega a
-- la base) y responde en un solo viaje:
--   token_invalido      no existe o está revocado
--   limite              más de 20 envíos en la última hora con ese código
--   sin_consentimiento  el código existe pero la persona no tiene la casilla E vigente
--   ok                  + usuario_id
-- El contador de la hora cuenta también los envíos rechazados por falta de permiso: un
-- Atajo desbocado no se libra del límite por estar rechazado.
create or replace function public.salud_atajo_autorizar(p_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.salud_atajo_tokens%rowtype;
  v_limite constant integer := 20;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('estado', 'token_invalido');
  end if;

  select * into t from public.salud_atajo_tokens
   where token_hash = p_hash and revocado_en is null
   for update;
  if not found then
    return jsonb_build_object('estado', 'token_invalido');
  end if;

  if t.ventana_inicio is null or t.ventana_inicio <= now() - interval '1 hour' then
    update public.salud_atajo_tokens
       set ventana_inicio = now(), envios_en_ventana = 1
     where id = t.id;
  elsif t.envios_en_ventana >= v_limite then
    return jsonb_build_object('estado', 'limite');
  else
    update public.salud_atajo_tokens
       set envios_en_ventana = envios_en_ventana + 1
     where id = t.id;
  end if;

  if not public.salud_consentimiento_vigente(t.usuario_id) then
    return jsonb_build_object('estado', 'sin_consentimiento');
  end if;

  -- `ultimo_uso_en` NO se anota aquí: aceptar el código no es recibir datos. Lo anota
  -- salud_atajo_guardar cuando de verdad entra algo (prueba 110, sección 3).
  return jsonb_build_object('estado', 'ok', 'usuario_id', t.usuario_id);
end;
$$;
revoke all on function public.salud_atajo_autorizar(text) from public, anon, authenticated;
grant execute on function public.salud_atajo_autorizar(text) to service_role;

-- Guarda los resúmenes ya validados por la Edge Function: upsert idempotente por
-- (persona, día, tipo, fuente='atajo'). Si el mismo (día, tipo) viene repetido gana el
-- último. Vuelve a comprobar el permiso: si la revocaron entre `autorizar` y aquí, no
-- entra nada. Las CHECK de la tabla son la última red (unidad y rango). Si entra algo,
-- anota el «último envío» del código.
create or replace function public.salud_atajo_guardar(p_usuario uuid, p_muestras jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if p_usuario is null or p_muestras is null or jsonb_typeof(p_muestras) <> 'array' then
    raise exception 'salud_atajo_guardar: argumentos invalidos' using errcode = '22023';
  end if;
  if jsonb_array_length(p_muestras) > 200 then
    raise exception 'salud_atajo_guardar: demasiadas muestras' using errcode = '22023';
  end if;
  if not public.salud_consentimiento_vigente(p_usuario) then
    raise exception 'salud_atajo_guardar: sin permiso vigente' using errcode = '42501';
  end if;

  insert into public.salud_muestras (usuario_id, fecha, tipo, valor, unidad, metodo, fuente)
  select p_usuario, d.fecha, d.tipo, d.valor, d.unidad, d.metodo, 'atajo'
    from (
      select distinct on ((e.elem ->> 'fecha')::date, e.elem ->> 'tipo')
             (e.elem ->> 'fecha')::date  as fecha,
             e.elem ->> 'tipo'           as tipo,
             (e.elem ->> 'valor')::numeric as valor,
             e.elem ->> 'unidad'         as unidad,
             e.elem ->> 'metodo'         as metodo
        from jsonb_array_elements(p_muestras) with ordinality as e(elem, ord)
       order by (e.elem ->> 'fecha')::date, e.elem ->> 'tipo', e.ord desc
    ) d
  on conflict (usuario_id, fecha, tipo, fuente)
  do update set valor = excluded.valor,
                unidad = excluded.unidad,
                metodo = excluded.metodo;
  get diagnostics v_n = row_count;

  -- «Último envío» = la última vez que entraron datos. Hay un solo código activo por persona.
  if v_n > 0 then
    update public.salud_atajo_tokens set ultimo_uso_en = now()
     where usuario_id = p_usuario and revocado_en is null;
  end if;
  return v_n;
end;
$$;
revoke all on function public.salud_atajo_guardar(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.salud_atajo_guardar(uuid, jsonb) to service_role;

commit;
