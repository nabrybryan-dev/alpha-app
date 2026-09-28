-- ============================================================================
-- 0089 · Piloto «bola de nieve»: el formulario de interesados y la hoja del piloto
-- ============================================================================
--
-- NÚMERO PENDIENTE DE CONFIRMAR POR BRYAN. `origin/main` llega a la 0088 (27-sep); la
-- 0079 la tiene reservada la rama `feat/veto-24h` (PR #296). Ninguna rama remota trae
-- una 0089. Si otra rama la coge antes, se renumera ESTA, que no está aplicada.
--
-- NO SE HA APLICADO. Se aplica a mano en el SQL Editor cuando Bryan lo decida.
--
-- Fuentes (repo `alpha-estudio/bola-de-nieve`): `DATOS.md` (identificadores),
-- `embudo/PASO-A-PASO.md` (columnas de cada pestaña y valores permitidos),
-- `embudo/PREGUNTAS-ENCAJE.md` (códigos de opción), `legal/AUTORIZACION-DATOS-
-- SENSIBLES.md` v0.3 §11 (registro de la prueba) y `legal/MAPA-DE-DATOS.md` §3–§4.
--
-- QUÉ ENTRA. Dos grupos de tablas, porque son dos destinos distintos del mapa de datos:
--
--   A. EL FORMULARIO PÚBLICO (`/interesados?codigo=XXXX`), sin sesión, con la anon key:
--        piloto_encaje_respuestas  — destino SB: las 3 respuestas, solo códigos de opción.
--        piloto_autorizaciones     — destino EVI: la prueba de la autorización.
--      Quien llena el formulario solo puede INSERTAR aquí. Nunca leer, ni lo suyo.
--
--   B. LA HOJA DEL PILOTO (destino HOJA), solo para el coach:
--        piloto_codigos, piloto_interesados, piloto_clientes, piloto_cobros,
--        piloto_eventos (solo se añade), piloto_saldos_por_recuperar y
--        piloto_avisos_creador (la 7.ª pestaña de PASO-A-PASO §0).
--      La hoja NO lleva nombres, teléfonos, respuestas de encaje, casillas A–D ni ningún
--      dato de salud: por eso ninguna tabla de B tiene una columna para ellos.
--
-- SIN HISTORIAL DE VERSIONES (Bryan, 27-sep; mapa §3, fila HOJA). Ninguna tabla de esta
-- migración tiene tabla de auditoría, trigger que copie la fila vieja ni columna de
-- «versión anterior». Borrar una fila o poner un campo a NULL lo borra de la tabla; los
-- respaldos del proveedor siguen el `FALTA` de la fila SB del mapa.
--
-- «EL ROL DE COACH O ADMIN». La app no tiene rol admin: el rol con más permisos es
-- `coach` (`usuarios_app.rol`, 0001) y `public.es_coach()` es la función que ya usan las
-- políticas de todo el repo. Todas las políticas del coach van `to authenticated` y
-- con `es_coach()`; anon no tiene `execute` sobre ella (0013).
--
-- SEGURIDAD, la regla de siempre (`GUIA-BRYAN.md` §10): cada `create table` enciende
-- RLS en el mismo paso y pierde los privilegios por defecto (`revoke all ... from anon,
-- authenticated, public`) antes de conceder solo lo que hace falta.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- A.1 · PILOTO_ENCAJE_RESPUESTAS (SB)
-- ────────────────────────────────────────────────────────────────────────────
-- Una fila por envío del formulario. Solo códigos de opción: no hay columna de texto
-- libre (PASO-A-PASO, «Puerta del campo libre»). Las respuestas son NULLABLE a
-- propósito: así Bryan puede BORRAR UN CAMPO con un `update ... set p3_expectativa =
-- null` y comprobarlo con un `select`. Quien envía no puede dejarlas en blanco: lo exige
-- la política de insert, no la tabla.
-- Conservación (mapa §4): 3 meses si no compra; si compra, mientras sea cliente + 6 meses.
-- El borrado es manual por ahora (ver el final del archivo).
create table if not exists public.piloto_encaje_respuestas (
  envio_id       uuid primary key,
  -- A–Z y 0–9: lo que el navegador ya normalizó (mayúsculas, sin espacios). Si el enlace
  -- traía otra cosa, llega NULL; la URL no puede colar texto libre.
  codigo         text check (codigo ~ '^[A-Z0-9]{1,32}$'),
  cliente_id     text check (cliente_id ~ '^(cli-[0-9]{1,9}|PRUEBA-[0-9]{1,9})$'),
  p1_dias        text check (p1_dias in ('1', '2', '3', '4_o_mas')),
  p1_horarios    text check (p1_horarios in ('fijos', 'cambian')),
  p2_lugar       text check (p2_lugar in ('gimnasio', 'casa con equipo', 'casa sin equipo', 'parque u otro')),
  p2_modalidad   text check (p2_modalidad in ('en línea', 'presencial')),
  p3_expectativa text check (p3_expectativa in (
    'constancia', 'organizarme', 'fuerza', 'aprender', 'energia',
    'resultado_garantizado', 'plan_profesional_salud')),
  recibido_en    timestamptz not null default now()
);
alter table public.piloto_encaje_respuestas enable row level security;
revoke all on public.piloto_encaje_respuestas from anon, authenticated, public;
grant insert on public.piloto_encaje_respuestas to anon, authenticated;
grant select, update, delete on public.piloto_encaje_respuestas to authenticated;

-- La hora de recepción la pone el servidor: el navegador no puede fechar su envío.
create or replace function public.piloto_encaje_recibido_del_servidor()
returns trigger language plpgsql set search_path = public as $$
begin
  new.recibido_en := now();
  return new;
end;
$$;
revoke execute on function public.piloto_encaje_recibido_del_servidor() from public, anon, authenticated;
drop trigger if exists trg_piloto_encaje_recibido on public.piloto_encaje_respuestas;
create trigger trg_piloto_encaje_recibido
  before insert on public.piloto_encaje_respuestas
  for each row execute function public.piloto_encaje_recibido_del_servidor();

-- Política: el FORMULARIO PÚBLICO solo INSERTA, y solo una fila completa. Va para anon y
-- para authenticated porque un asesorado con la sesión abierta en el mismo navegador
-- también llega como authenticated. No hay política de SELECT para ellos: el insert va
-- sin `returning` y nadie que no sea coach puede leer ni su propia fila.
drop policy if exists piloto_encaje_insertar_formulario on public.piloto_encaje_respuestas;
create policy piloto_encaje_insertar_formulario on public.piloto_encaje_respuestas
  for insert to anon, authenticated
  with check (
    p1_dias is not null and p1_horarios is not null and p2_lugar is not null
    and p2_modalidad is not null and p3_expectativa is not null
  );

-- Política: el COACH lee todo (para decidir el encaje y registrar el paso en la hoja).
drop policy if exists piloto_encaje_coach_lee on public.piloto_encaje_respuestas;
create policy piloto_encaje_coach_lee on public.piloto_encaje_respuestas
  for select to authenticated using (public.es_coach());

-- Política: el COACH actualiza, que es como se BORRA UN CAMPO (set ... = null) y como se
-- pone el cliente_id cuando el enlace no lo traía.
drop policy if exists piloto_encaje_coach_actualiza on public.piloto_encaje_respuestas;
create policy piloto_encaje_coach_actualiza on public.piloto_encaje_respuestas
  for update to authenticated using (public.es_coach()) with check (public.es_coach());

-- Política: el COACH borra la respuesta entera (plazo cumplido o petición de la persona).
drop policy if exists piloto_encaje_coach_borra on public.piloto_encaje_respuestas;
create policy piloto_encaje_coach_borra on public.piloto_encaje_respuestas
  for delete to authenticated using (public.es_coach());

-- ────────────────────────────────────────────────────────────────────────────
-- A.2 · PILOTO_AUTORIZACIONES (EVI) — AUTORIZACION-DATOS-SENSIBLES v0.3, §11
-- ────────────────────────────────────────────────────────────────────────────
-- La prueba de que se obtuvo la autorización (Ley 1581, art. 17 lit. b): versión del
-- texto, fecha y hora, canal, las cuatro casillas por separado y la declaración. Una fila
-- por envío, atada a su respuesta de encaje. Sin fila aquí, las cuatro casillas cuentan
-- como «no» y no se hacen preguntas de salud (PASO-A-PASO, paso 5).
create table if not exists public.piloto_autorizaciones (
  envio_id             uuid primary key
                       references public.piloto_encaje_respuestas (envio_id) on delete cascade,
  cliente_id           text check (cliente_id ~ '^(cli-[0-9]{1,9}|PRUEBA-[0-9]{1,9})$'),
  version_autorizacion text not null check (version_autorizacion ~ '^[0-9]+\.[0-9]+$'),
  -- La pone el servidor (trigger de abajo): la prueba no depende del reloj del teléfono.
  fecha_hora           timestamptz not null default now(),
  canal                text not null default 'formulario'
                       check (canal in ('formulario', 'whatsapp', 'papel')),
  casilla_a            text not null check (casilla_a in ('si', 'no')),
  casilla_b            text not null check (casilla_b in ('si', 'no')),
  casilla_c            text not null check (casilla_c in ('si', 'no')),
  casilla_d            text not null check (casilla_d in ('si', 'no')),
  declaracion_aceptada boolean not null check (declaracion_aceptada),
  -- §11 «revocaciones»: [{"fecha": "AAAA-MM-DD", "finalidad": "A"}, ...]. Solo el coach.
  revocaciones         jsonb not null default '[]'::jsonb
                       check (jsonb_typeof(revocaciones) = 'array')
);
alter table public.piloto_autorizaciones enable row level security;
revoke all on public.piloto_autorizaciones from anon, authenticated, public;
grant insert on public.piloto_autorizaciones to anon, authenticated;
grant select, update, delete on public.piloto_autorizaciones to authenticated;

-- La fecha de la evidencia la decide el servidor, diga lo que diga el navegador.
create or replace function public.piloto_autorizacion_fecha_del_servidor()
returns trigger language plpgsql set search_path = public as $$
begin
  new.fecha_hora := now();
  return new;
end;
$$;
revoke execute on function public.piloto_autorizacion_fecha_del_servidor() from public, anon, authenticated;
drop trigger if exists trg_piloto_autorizacion_fecha on public.piloto_autorizaciones;
create trigger trg_piloto_autorizacion_fecha
  before insert on public.piloto_autorizaciones
  for each row execute function public.piloto_autorizacion_fecha_del_servidor();

-- Política: el FORMULARIO PÚBLICO solo INSERTA su autorización, con el texto VIGENTE
-- (0.3), por el canal formulario y sin revocaciones. Publicar una versión nueva del texto
-- exige cambiar esta política: así no entra una evidencia de un texto que no existe.
-- Sin política de SELECT para anon: nunca lee, ni la suya.
drop policy if exists piloto_autorizacion_insertar_formulario on public.piloto_autorizaciones;
create policy piloto_autorizacion_insertar_formulario on public.piloto_autorizaciones
  for insert to anon, authenticated
  with check (
    version_autorizacion = '0.3'
    and canal = 'formulario'
    and revocaciones = '[]'::jsonb
  );

-- Política: el COACH lee las autorizaciones (tiene que poder demostrarlas).
drop policy if exists piloto_autorizacion_coach_lee on public.piloto_autorizaciones;
create policy piloto_autorizacion_coach_lee on public.piloto_autorizaciones
  for select to authenticated using (public.es_coach());

-- Política: el COACH actualiza (anotar revocaciones, poner el cliente_id).
drop policy if exists piloto_autorizacion_coach_actualiza on public.piloto_autorizaciones;
create policy piloto_autorizacion_coach_actualiza on public.piloto_autorizaciones
  for update to authenticated using (public.es_coach()) with check (public.es_coach());

-- Política: el COACH borra al vencer el plazo (mapa §3, fila EVI).
drop policy if exists piloto_autorizacion_coach_borra on public.piloto_autorizaciones;
create policy piloto_autorizacion_coach_borra on public.piloto_autorizaciones
  for delete to authenticated using (public.es_coach());

-- ────────────────────────────────────────────────────────────────────────────
-- B.1 · PILOTO_CODIGOS — la única fuente para validar un código
-- ────────────────────────────────────────────────────────────────────────────
-- `codigo` es la clave primaria de la tabla ENTERA, no por tipo: un código de creador y
-- uno de cliente nunca pueden coincidir (DATOS.md). Se guardan ya normalizados.
create table if not exists public.piloto_codigos (
  codigo      text primary key check (codigo ~ '^[A-Z0-9]{1,32}$'),
  codigo_tipo text not null check (codigo_tipo in ('creador', 'cliente')),
  creador_id  text check (creador_id ~ '^ig:[0-9]+$'),
  cliente_id  text check (cliente_id ~ '^(cli-[0-9]{1,9}|PRUEBA-[0-9]{1,9})$'),
  fecha_alta  date not null default current_date,
  estado      text not null default 'activo' check (estado in ('activo', 'retirado')),
  -- El dueño va en la columna de su tipo, y solo en esa.
  constraint piloto_codigos_dueno_segun_tipo check (
    (codigo_tipo = 'creador' and creador_id is not null and cliente_id is null)
    or (codigo_tipo = 'cliente' and cliente_id is not null and creador_id is null)
  )
);
alter table public.piloto_codigos enable row level security;
revoke all on public.piloto_codigos from anon, authenticated, public;
grant select, insert, update on public.piloto_codigos to authenticated;

-- Un código retirado no se reutiliza NUNCA: no vuelve a `activo`, y ni el código ni su
-- tipo ni su dueño cambian. (Borrarlo lo dejaría libre para reinsertarse; por eso el
-- coach no tiene DELETE — ver la política.)
create or replace function public.piloto_codigo_no_se_reutiliza()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.codigo <> old.codigo or new.codigo_tipo <> old.codigo_tipo
     or new.creador_id is distinct from old.creador_id
     or new.cliente_id is distinct from old.cliente_id then
    raise exception 'piloto_codigos: el código, su tipo y su dueño no cambian; se retira y se crea otro';
  end if;
  if old.estado = 'retirado' and new.estado <> 'retirado' then
    raise exception 'piloto_codigos: un código retirado no se reutiliza nunca';
  end if;
  return new;
end;
$$;
revoke execute on function public.piloto_codigo_no_se_reutiliza() from public, anon, authenticated;
drop trigger if exists trg_piloto_codigo_no_se_reutiliza on public.piloto_codigos;
create trigger trg_piloto_codigo_no_se_reutiliza
  before update on public.piloto_codigos
  for each row execute function public.piloto_codigo_no_se_reutiliza();

-- Política: solo el COACH lee, crea y retira códigos. Sin política de DELETE: un código
-- borrado quedaría libre para reutilizarse. (Anon no lee: el formulario no valida el
-- código; lo valida Bryan en el paso 2.)
drop policy if exists piloto_codigos_coach_lee on public.piloto_codigos;
create policy piloto_codigos_coach_lee on public.piloto_codigos
  for select to authenticated using (public.es_coach());
drop policy if exists piloto_codigos_coach_crea on public.piloto_codigos;
create policy piloto_codigos_coach_crea on public.piloto_codigos
  for insert to authenticated with check (public.es_coach());
drop policy if exists piloto_codigos_coach_retira on public.piloto_codigos;
create policy piloto_codigos_coach_retira on public.piloto_codigos
  for update to authenticated using (public.es_coach()) with check (public.es_coach());

-- ────────────────────────────────────────────────────────────────────────────
-- B.2 · PILOTO_INTERESADOS — una fila por persona que escribe, compre o no
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.piloto_interesados (
  cliente_id            text primary key check (cliente_id ~ '^(cli-[0-9]{1,9}|PRUEBA-[0-9]{1,9})$'),
  fecha_primer_contacto timestamptz not null,
  codigo                text check (codigo ~ '^[A-Z0-9]{1,32}$'),
  creador_id            text,
  -- `creador_id`, `directo`, `referido:<cliente_id>` o uno de los tres que no comisionan.
  origen                text check (
    origen in ('directo', 'cliente_existente', 'autorreferido', 'codigo_filtrado')
    or origen ~ '^referido:(cli-[0-9]{1,9}|PRUEBA-[0-9]{1,9})$'
    or origen ~ '^ig:[0-9]+$'
  ),
  origen_historial      text,
  como_nos_conocio      text check (como_nos_conocio in ('seguidor_antiguo', 'audiencia_nueva', 'recomendacion')),
  paso_actual           text not null default 'primer_contacto' check (paso_actual in (
    'primer_contacto', 'codigo', 'encaje_enviado', 'encaje_respondido', 'oferta',
    'autorizacion', 'pago_enviado', 'pago_confirmado', 'alta_fallida', 'alta_hecha',
    'primer_uso', 'perdida', 'reabierto')),
  estado_embudo         text not null default 'abierto' check (estado_embudo in ('abierto', 'cliente', 'perdido')),
  motivo_perdida        text check (motivo_perdida in ('precio', 'encaje', 'expectativa', 'demora', 'no_observado')),
  fecha_cierre          date,
  -- Perdido ⇔ con motivo. Al reabrir se vacían los dos (PASO-A-PASO, paso 9).
  constraint piloto_interesados_perdida_con_motivo check (
    (estado_embudo = 'perdido') = (motivo_perdida is not null)
  )
);

-- ────────────────────────────────────────────────────────────────────────────
-- B.3 · PILOTO_CLIENTES — la fila nace al confirmarse el pago, con fecha_alta vacía
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.piloto_clientes (
  cliente_id       text primary key check (cliente_id ~ '^(cli-[0-9]{1,9}|PRUEBA-[0-9]{1,9})$'),
  codigo           text check (codigo ~ '^[A-Z0-9]{1,32}$'),
  creador_id       text,
  origen           text check (
    origen in ('directo', 'cliente_existente', 'autorreferido', 'codigo_filtrado')
    or origen ~ '^referido:(cli-[0-9]{1,9}|PRUEBA-[0-9]{1,9})$'
    or origen ~ '^ig:[0-9]+$'
  ),
  origen_historial text,
  como_nos_conocio text check (como_nos_conocio in ('seguidor_antiguo', 'audiencia_nueva', 'recomendacion')),
  fecha_alta       date -- vacía = alta pendiente
);

-- ────────────────────────────────────────────────────────────────────────────
-- B.4 · PILOTO_COBROS — una fila por operacion_id (el de la pasarela)
-- ────────────────────────────────────────────────────────────────────────────
-- Los importes desconocidos quedan NULL, nunca 0 (`comision_pasarela`, `impuestos`,
-- `credito_aplicado`): el tablero no puede calcular un neto con costes inventados.
create table if not exists public.piloto_cobros (
  operacion_id      text primary key,
  cliente_id        text not null references public.piloto_clientes (cliente_id),
  creador_id        text,
  fecha             date not null,
  numero_cobro      integer not null check (numero_cobro >= 1),
  ciclo_creador     integer check (ciclo_creador >= 1),
  monto_bruto       numeric(12, 2) not null check (monto_bruto >= 0),
  comision_pasarela numeric(12, 2) check (comision_pasarela >= 0),
  impuestos         numeric(12, 2) check (impuestos >= 0),
  estado            text not null default 'cobrado'
                    check (estado in ('cobrado', 'devuelto_total', 'devuelto_parcial', 'contracargo')),
  monto_devuelto    numeric(12, 2) check (monto_devuelto >= 0 and monto_devuelto <= monto_bruto),
  fecha_liquidacion date,
  credito_aplicado  numeric(12, 2) check (credito_aplicado >= 0),
  fecha_devolucion  date
);

-- ────────────────────────────────────────────────────────────────────────────
-- B.5 · PILOTO_EVENTOS — SOLO SE AÑADE
-- ────────────────────────────────────────────────────────────────────────────
-- Nunca se corrige una fila: si algo estuvo mal, se agrega otra que lo corrige. `detalle`
-- lleva metadatos operativos SIN salud, sin nombres y sin contenido de encaje.
create table if not exists public.piloto_eventos (
  id           bigint generated always as identity primary key,
  fecha_hora   timestamptz not null default now(),
  cliente_id   text,
  paso         text not null check (paso in (
    'primer_contacto', 'codigo', 'encaje_enviado', 'encaje_respondido', 'oferta',
    'autorizacion', 'pago_enviado', 'pago_confirmado', 'alta_fallida', 'alta_hecha',
    'primer_uso', 'perdida', 'reabierto', 'dato_salud_recibido_borrado',
    'pago_duplicado_ignorado', 'atribucion_corregida', 'aviso_creador_enviado',
    'liquidacion', 'compensacion', 'devolucion')),
  detalle      text,
  operacion_id text,
  min_bryan    numeric(6, 1) check (min_bryan >= 0),
  -- En `encaje_respondido` el detalle va VACÍO: ni la respuesta ni cuál no encajó.
  constraint piloto_eventos_encaje_sin_detalle check (
    paso <> 'encaje_respondido' or detalle is null or detalle = ''
  )
);

-- Solo añadir: ningún UPDATE, venga de quien venga (también del SQL Editor). El DELETE
-- no se bloquea con trigger a propósito: el coach no tiene política de DELETE, pero una
-- petición legal de borrado (Ley 1581) se atiende desde el SQL Editor sin desmontar nada.
create or replace function public.piloto_eventos_solo_se_anaden()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'piloto_eventos es de solo añadir: agrega una fila que corrija, no edites esta';
end;
$$;
revoke execute on function public.piloto_eventos_solo_se_anaden() from public, anon, authenticated;
drop trigger if exists trg_piloto_eventos_solo_se_anaden on public.piloto_eventos;
create trigger trg_piloto_eventos_solo_se_anaden
  before update on public.piloto_eventos
  for each row execute function public.piloto_eventos_solo_se_anaden();

-- ────────────────────────────────────────────────────────────────────────────
-- B.6 · PILOTO_SALDOS_POR_RECUPERAR — devolución de un cobro YA liquidado (ACUERDO 9.3–9.4)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.piloto_saldos_por_recuperar (
  id           bigint generated always as identity primary key,
  fecha        date not null,
  creador_id   text not null,
  operacion_id text not null references public.piloto_cobros (operacion_id),
  importe      numeric(12, 2) not null check (importe > 0),
  estado       text not null default 'por_recuperar' check (estado in ('por_recuperar', 'recuperado')),
  -- Lo compensado de verdad. Empieza en 0; el saldo sigue siendo coste hasta que suba.
  recuperado   numeric(12, 2) not null default 0 check (recuperado >= 0 and recuperado <= importe),
  constraint piloto_saldos_estado_coherente check ((estado = 'recuperado') = (recuperado = importe))
);

-- ────────────────────────────────────────────────────────────────────────────
-- B.7 · PILOTO_AVISOS_CREADOR — evidencia de cada corrección de atribución avisada
-- ────────────────────────────────────────────────────────────────────────────
-- El texto enviado NO lleva nombre, teléfono, cliente_id ni salud (PASO-A-PASO,
-- «Corrección de atribución»); lo escribe Bryan con la plantilla de allí.
create table if not exists public.piloto_avisos_creador (
  id         bigint generated always as identity primary key,
  fecha_hora timestamptz not null default now(),
  creador_id text not null,
  canal      text not null,
  texto      text not null
);

-- ────────────────────────────────────────────────────────────────────────────
-- B.8 · RLS DE LA HOJA: solo el coach
-- ────────────────────────────────────────────────────────────────────────────
alter table public.piloto_interesados          enable row level security;
alter table public.piloto_clientes             enable row level security;
alter table public.piloto_cobros               enable row level security;
alter table public.piloto_eventos              enable row level security;
alter table public.piloto_saldos_por_recuperar enable row level security;
alter table public.piloto_avisos_creador       enable row level security;

-- Anon no tiene NINGÚN privilegio sobre la hoja; authenticated solo lo justo, y aun así
-- cada fila pasa por `es_coach()`: un asesorado con sesión no ve ni toca nada.
revoke all on public.piloto_interesados, public.piloto_clientes, public.piloto_cobros,
              public.piloto_eventos, public.piloto_saldos_por_recuperar,
              public.piloto_avisos_creador
  from anon, authenticated, public;
grant select, insert, update, delete on public.piloto_interesados, public.piloto_clientes,
              public.piloto_cobros, public.piloto_saldos_por_recuperar
  to authenticated;
-- Eventos y avisos: solo leer y añadir.
grant select, insert on public.piloto_eventos, public.piloto_avisos_creador to authenticated;

-- Política (una por tabla): el COACH lee, añade, corrige y borra filas de interesados,
-- clientes, cobros y saldos. Borrar es como se atiende una petición de borrado (mapa §3,
-- fila HOJA: «borrar filas y verificar con una consulta»).
drop policy if exists piloto_interesados_coach on public.piloto_interesados;
create policy piloto_interesados_coach on public.piloto_interesados
  for all to authenticated using (public.es_coach()) with check (public.es_coach());

drop policy if exists piloto_clientes_coach on public.piloto_clientes;
create policy piloto_clientes_coach on public.piloto_clientes
  for all to authenticated using (public.es_coach()) with check (public.es_coach());

drop policy if exists piloto_cobros_coach on public.piloto_cobros;
create policy piloto_cobros_coach on public.piloto_cobros
  for all to authenticated using (public.es_coach()) with check (public.es_coach());

drop policy if exists piloto_saldos_coach on public.piloto_saldos_por_recuperar;
create policy piloto_saldos_coach on public.piloto_saldos_por_recuperar
  for all to authenticated using (public.es_coach()) with check (public.es_coach());

-- Política: el COACH lee los eventos.
drop policy if exists piloto_eventos_coach_lee on public.piloto_eventos;
create policy piloto_eventos_coach_lee on public.piloto_eventos
  for select to authenticated using (public.es_coach());
-- Política: el COACH añade eventos. No hay política de UPDATE ni de DELETE (solo añadir).
drop policy if exists piloto_eventos_coach_anade on public.piloto_eventos;
create policy piloto_eventos_coach_anade on public.piloto_eventos
  for insert to authenticated with check (public.es_coach());

-- Política: el COACH lee los avisos a creadores.
drop policy if exists piloto_avisos_coach_lee on public.piloto_avisos_creador;
create policy piloto_avisos_coach_lee on public.piloto_avisos_creador
  for select to authenticated using (public.es_coach());
-- Política: el COACH añade avisos. Son evidencia: sin UPDATE ni DELETE desde la app.
drop policy if exists piloto_avisos_coach_anade on public.piloto_avisos_creador;
create policy piloto_avisos_coach_anade on public.piloto_avisos_creador
  for insert to authenticated with check (public.es_coach());

commit;

-- ============================================================================
-- CÓMO SE BORRA Y SE COMPRUEBA (SQL Editor; sustituir el envio_id)
-- ============================================================================
-- Borrar UN CAMPO de una respuesta de encaje, y comprobarlo:
--   update public.piloto_encaje_respuestas set p3_expectativa = null where envio_id = '<uuid>';
--   select p3_expectativa from public.piloto_encaje_respuestas where envio_id = '<uuid>';  -- NULL
-- Borrar la respuesta entera (se lleva su autorización por el `on delete cascade`):
--   delete from public.piloto_encaje_respuestas where envio_id = '<uuid>';
--   select count(*) from public.piloto_autorizaciones where envio_id = '<uuid>';           -- 0
-- Respuestas de encaje con más de 3 meses de alguien que no compró (plazo del mapa §4):
--   select e.envio_id from public.piloto_encaje_respuestas e
--    where e.recibido_en < now() - interval '3 months'
--      and not exists (select 1 from public.piloto_clientes c where c.cliente_id = e.cliente_id);
