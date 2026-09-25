-- ============================================================================
-- 0083 · Consola del coach — capa de SERVIDOR: proyección de lectura y permisos
-- ============================================================================
--
-- Fase 2 de la consola del coach (autorizada por Bryan, 24/25-sep-2026). Diseño:
-- `vigia-codex/consola-20260924/DISENO-CONSOLA-V2.md`, corregido por Astra en
-- `CONTEXTO-PARA-ASTRA-20260924.md` §4/§7 y `RESPUESTA-ASTRA-CONSOLA.md` (Q1, Q2, Q4).
--
-- NÚMERO. `main` llega a la 0082; la 0079 está reservada por el PR #296
-- (`feat/veto-24h`, sin fusionar) y no aparece en el registro de la base. Comprobado el
-- 25-sep contra `origin/main`, TODAS las ramas remotas vivas (incluida
-- `feat/consola-coach-lectura`, que trae UI de maqueta pero ningún archivo bajo
-- `supabase/migrations/` posterior a la 0079) y `mcp__supabase__list_migrations`: ninguna
-- trae una 0083. Es el siguiente número libre en las tres fuentes a la vez.
--
-- QUÉ ENTRA AQUÍ, Y QUÉ NO.
--   1. Proyección de LECTURA (`cadena_corridas`, `planes_estrategicos`): las escribe solo
--      la clave de servicio (`service_role`, que salta RLS); el navegador solo lee.
--      `cadena_corridas` no trae SQL de carga — ninguna fila real, solo el esquema y su
--      hash — porque el importador (`subir_a_consola.py`) es la fase 3 (cerebro-alpha-
--      agentes), no esta migración.
--   2. Órdenes y aprobaciones: esquema listo, SIN botón todavía en la UI. `ordenes` es el
--      registro idempotente de una acción humana (detener, reportar riesgo, pedir
--      corrección, responder); `aprobaciones` es la firma SSH verificada, y el navegador
--      NO puede insertar en ella bajo ninguna circunstancia: no tiene política de INSERT,
--      así que cualquier intento por la API afecta 0 filas antes de mirar el `with check`.
--   3. Permisos por CAPACIDAD (`capacidades_staff` + `tiene_capacidad()`), sin convertir a
--      Manuela en coach (decisión de Bryan, §4 de RESPUESTA-ASTRA-CONSOLA.md). RLS de
--      lectura ADITIVA — nunca sustituye una política existente — para quien tenga
--      `leer_entrenamiento`.
--   4. `responder_como_staff()`: el actor sale de `auth.uid()`, nunca de un parámetro
--      (Q2 de Astra: «`_respondido_por='coach'` dentro del JSON… no acredita autoría»).
--
-- SEGURIDAD, la misma regla de siempre en este repo (`GUIA-BRYAN.md` §10): toda función en
-- `public` queda expuesta como RPC a `anon` en cuanto se crea. Cada `security definer` de
-- aquí lleva `set search_path = public` fijo (Q2 de Astra) y su propio
-- `revoke … from public, anon`. Cada tabla nueva enciende RLS en el mismo `create table` y
-- pierde sus privilegios por defecto con `revoke all from anon, public` antes de conceder
-- nada.
--
-- NO HAY UUID REALES AQUÍ. El bloque «asignar capacidades» queda comentado al final para
-- que el director lo rellene AL APLICAR, con los UUID reales de Bryan y Manuela. Fusionar
-- esta migración no la aplica (`migracion-y-codigo-van-por-su-lado`), y aplicarla sin ese
-- bloque relleno deja la tabla de capacidades vacía — lo que es seguro: nadie tiene
-- `leer_entrenamiento` hasta que el director lo decida, así que el fallo por defecto es
-- «nadie ve de más», no al revés.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · CAPACIDADES DEL STAFF
-- ────────────────────────────────────────────────────────────────────────────
-- Tabla chica a propósito: (quién, qué puede). No es un rol nuevo — Manuela sigue siendo
-- 'nutricionista' en `usuarios_app.rol` — es una lista de permisos por acción, ortogonal al
-- rol. `tiene_capacidad()` es la única puerta que las políticas de abajo consultan.

create table if not exists public.capacidades_staff (
  usuario_id  uuid not null references public.usuarios_app(id) on delete cascade,
  capacidad   text not null check (capacidad in (
                'leer_entrenamiento',
                'responder_por_asesorado',
                'detener_publicacion',
                'reportar_riesgo',
                'autorizar_excepcion',
                'firmar_politica'
              )),
  creado_en   timestamptz not null default now(),
  primary key (usuario_id, capacidad)
);

comment on table public.capacidades_staff is
  'Permisos por acción del staff (consola del coach, 2026-09-25). Ortogonal al rol: no '
  'convierte a nadie en coach. La escribe solo el director/servicio; el navegador solo lee.';

alter table public.capacidades_staff enable row level security;

-- Lectura: la propia fila, y el coach todas (para poder administrar quién tiene qué).
create policy capacidades_staff_lee on public.capacidades_staff
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_coach()));

-- Sin política de insert/update/delete: nadie escribe esta tabla por la API, ni el propio
-- coach. Se asigna a mano (bloque comentado al final) o desde un panel de administración
-- futuro que use `service_role`, nunca desde el navegador con la clave anónima.
revoke all on public.capacidades_staff from anon, public;
grant select on public.capacidades_staff to authenticated;
grant all on public.capacidades_staff to service_role;

-- La función que consultan todas las políticas de abajo. `security definer` porque
-- `capacidades_staff` no tiene política que deje leer la fila de un tercero sin ser
-- coach, y esta función SÍ necesita comprobar la del que llama sin ese rodeo.
create or replace function public.tiene_capacidad(p_capacidad text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.capacidades_staff
    where usuario_id = auth.uid() and capacidad = p_capacidad
  );
$$;

revoke all on function public.tiene_capacidad(text) from public, anon;
grant execute on function public.tiene_capacidad(text) to authenticated, service_role;

comment on function public.tiene_capacidad(text) is
  'Puerta única de las políticas de la consola. `security definer` + `search_path` fijo '
  '(Q2 de Astra): sin esto, un search_path manipulado podría colar una tabla '
  '«capacidades_staff» de otro esquema.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · PROYECCIÓN DE LECTURA: cadena_corridas
-- ────────────────────────────────────────────────────────────────────────────
-- Una fila por EVENTO de paso de la cadena, no por corrida completa: el paso ①, su
-- reintento, el paso ②… cada uno emite su propio evento (Q4 de Astra). `event_id` es la
-- idempotencia: el importador reintenta con red mala y el `unique` lo protege sin que haga
-- falta un upsert con lógica propia aquí — eso vive en `subir_a_consola.py` (fase 3).

create table if not exists public.cadena_corridas (
  id                    uuid primary key default gen_random_uuid(),
  -- Idempotencia del evento (Q4 de Astra): un reintento del importador con el MISMO
  -- event_id no duplica fila. UUID y no text: lo genera quien emite el evento, no un
  -- humano, y no hace falta que sea legible.
  event_id              uuid not null unique,
  -- Todos los eventos de una misma ejecución ①→④ comparten run_id; sirve para agrupar en
  -- el tablero de agentes sin tener que adivinar por fecha.
  run_id                uuid not null,
  usuario_id            uuid not null references public.usuarios_app(id) on delete cascade,
  semana_inicio         date not null,
  paso                  int not null check (paso between 1 and 4),
  -- Una persona puede tener varios intentos en la misma semana (Q1 de Astra): un reintento
  -- no es una decisión nueva. Qué intento es el vigente lo decide quien lee, no esta tabla.
  intento               int not null default 1 check (intento >= 1),
  estado                text not null check (estado in ('en_curso', 'completado', 'fallido', 'descartado')),
  -- Orden dentro del run_id, para poder pedir "el último evento visto" sin fiarse del
  -- reloj de dos máquinas distintas (Q4: fecha del dato ≠ fecha de recepción ≠ reloj).
  secuencia             bigint not null,
  -- El hash del artefacto (dictamen/presupuesto/prescripción/veredicto/microciclo, según
  -- el paso) y la versión de reglas/prompts/modelo con la que se generó. Ninguno de los
  -- dos es opcional: sin ellos no se puede saber si un cambio "irrelevante" cambió algo.
  hash_artefacto        text not null,
  version_reglas        text not null,
  -- Cuándo pasó el hecho que describe el evento, y cuándo llegó aquí. Nunca el mismo
  -- campo: un ejecutor caído puede reconciliar horas después, y la consola tiene que poder
  -- decir "esto es de ayer" sin mentir sobre cuándo se enteró (riesgo de Q4: "actualizado
  -- hace un minuto" no es lo mismo que "de hoy").
  fecha_dato            timestamptz not null,
  fecha_recepcion       timestamptz not null default now(),
  -- Lo que un humano lee sin abrir el jsonb. No sustituye al documento del paso (eso
  -- sigue viviendo donde vive hoy); es el resumen para el tablero.
  resumen               text,
  avisos                jsonb not null default '[]'::jsonb,
  preguntas_pendientes  jsonb not null default '[]'::jsonb,
  creado_en             timestamptz not null default now()
);

comment on table public.cadena_corridas is
  'OBSERVACIÓN inmutable: una fila por evento de paso de la cadena (2026-09-25). La escribe '
  'solo service_role; el navegador solo lee. Sin SQL de carga: el importador es fase 3.';

create index if not exists cadena_corridas_por_usuario_semana
  on public.cadena_corridas (usuario_id, semana_inicio, paso, intento);
create index if not exists cadena_corridas_por_estado_recepcion
  on public.cadena_corridas (estado, fecha_recepcion);
create index if not exists cadena_corridas_por_run
  on public.cadena_corridas (run_id, secuencia);

alter table public.cadena_corridas enable row level security;

-- Lectura: el propio asesorado ve sus eventos (es su semana), el coach ve todo (paridad
-- con el resto de la app: `es_coach()` no depende de que el director haya rellenado
-- `capacidades_staff` todavía) y quien tenga `leer_entrenamiento` ve todo.
create policy cadena_corridas_leer on public.cadena_corridas
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

-- Sin política de insert/update/delete: nadie escribe por la API con la clave anónima ni
-- con una sesión de usuario. Solo `service_role` (bypassa RLS) inserta, y solo inserta —
-- una fila por evento, nunca se reescribe (§3 del diseño: "un reintento crea OTRA fila").
revoke all on public.cadena_corridas from anon, public;
grant select on public.cadena_corridas to authenticated;
grant all on public.cadena_corridas to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · PROYECCIÓN DE LECTURA: planes_estrategicos
-- ────────────────────────────────────────────────────────────────────────────
-- Revisiones INMUTABLES por persona: mover un markdown de sitio no crea una estrategia
-- nueva (Q1 de Astra), así que esto no guarda una ruta de archivo, guarda el contenido y
-- su hash. Un único vigente por persona, garantizado por índice único PARCIAL — el mismo
-- patrón que `microciclos_un_activo_por_usuario` (0069): un `unique` no parcial no se
-- puede diferir, así que quien escriba una versión nueva tiene que apagar `vigente` en la
-- anterior ANTES de insertar la siguiente, en la misma transacción. Esa disciplina es de
-- quien escribe (`service_role`, fase 3); aquí solo se garantiza el invariante.

create table if not exists public.planes_estrategicos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios_app(id) on delete cascade,
  version     int not null check (version >= 1),
  vigente     boolean not null default false,
  contenido   jsonb not null,
  hash        text not null,
  creado_en   timestamptz not null default now(),
  unique (usuario_id, version)
);

comment on table public.planes_estrategicos is
  'Revisiones inmutables del plan estratégico por persona (2026-09-25). Un único vigente '
  'por persona, forzado por índice único parcial. La escribe solo service_role.';

create unique index if not exists planes_estrategicos_un_vigente_por_persona
  on public.planes_estrategicos (usuario_id)
  where vigente;

comment on index public.planes_estrategicos_un_vigente_por_persona is
  'Un único plan vigente por persona. Parcial a propósito: las versiones no vigentes '
  '(el historial) no se limitan. Quien active una versión nueva debe apagar `vigente` en '
  'la anterior en la MISMA transacción — el índice no se puede diferir.';

alter table public.planes_estrategicos enable row level security;

create policy planes_estrategicos_leer on public.planes_estrategicos
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

revoke all on public.planes_estrategicos from anon, public;
grant select on public.planes_estrategicos to authenticated;
grant all on public.planes_estrategicos to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · ÓRDENES (comandos humanos idempotentes) — esquema listo, sin botón en la UI
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.ordenes (
  id               uuid primary key default gen_random_uuid(),
  -- El actor SALE DE LA SESIÓN, nunca de un valor que mande el cliente: si `actor_id`
  -- fuera una columna que el cliente puede fijar, cualquiera podría pedir una orden en
  -- nombre de otro. El default la fija; el `with check` de abajo la hace obligatoria.
  actor_id         uuid not null default auth.uid() references public.usuarios_app(id),
  tipo             text not null check (tipo in ('detener', 'reportar_riesgo', 'pedir_correccion', 'responder')),
  -- A qué apunta la orden (usuario_id, semana, corrida, cuestionario…). jsonb y no varias
  -- columnas porque el objetivo cambia de forma según el tipo, y esto es un registro, no
  -- una tabla que otra consulta vaya a filtrar por columna.
  objetivo         jsonb not null,
  idempotency_key  text not null unique,
  creada_en        timestamptz not null default now()
);

comment on table public.ordenes is
  'Comandos humanos idempotentes (2026-09-25): detener, reportar riesgo, pedir corrección, '
  'responder. Esquema listo; la UI que los dispara es de una fase posterior.';

create index if not exists ordenes_por_actor on public.ordenes (actor_id, creada_en desc);

alter table public.ordenes enable row level security;

-- Alta: el actor tiene que ser quien llama (no se puede fabricar), y además tiene que
-- tener la capacidad que ese TIPO de orden exige. `detener` y `reportar_riesgo` van con
-- su propia capacidad (§4 de RESPUESTA-ASTRA-CONSOLA.md: "cualquiera puede señalar una
-- alerta" — pero sigue siendo una capacidad, no un "cualquiera autenticado" literal).
-- `pedir_correccion` exige al menos poder leer el entrenamiento que se corrige, y
-- `responder` exige la misma capacidad que la RPC del punto 6.
create policy ordenes_crear_segun_capacidad on public.ordenes
  for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and case tipo
      when 'detener'           then (select public.tiene_capacidad('detener_publicacion'))
      when 'reportar_riesgo'   then (select public.tiene_capacidad('reportar_riesgo'))
      when 'pedir_correccion'  then (select public.tiene_capacidad('leer_entrenamiento'))
      when 'responder'         then (select public.tiene_capacidad('responder_por_asesorado'))
      else false
    end
  );

create policy ordenes_leer on public.ordenes
  for select to authenticated
  using (
    actor_id = (select auth.uid())
    or (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

-- Sin update ni delete: un registro de órdenes que se pudiera reescribir no serviría como
-- auditoría. Corregir una orden es emitir OTRA orden, no editar la vieja.
revoke all on public.ordenes from anon, public;
grant select, insert on public.ordenes to authenticated;
grant all on public.ordenes to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · APROBACIONES — la escribe SOLO el servidor tras verificar la firma SSH
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.aprobaciones (
  id             uuid primary key default gen_random_uuid(),
  plan_hash      text not null,
  usuario_id     uuid not null references public.usuarios_app(id) on delete cascade,
  semana         date not null,
  firmante       uuid not null references public.usuarios_app(id),
  firma          text not null,
  verificada_en  timestamptz not null default now()
);

comment on table public.aprobaciones is
  'Firma verificada de una versión de plan (2026-09-25). La escribe SOLO service_role, '
  'tras verificar la firma SSH fuera de la base: NO hay política de insert para '
  '`authenticated`, así que el navegador no puede insertar aquí bajo ninguna circunstancia.';

create index if not exists aprobaciones_por_usuario_semana
  on public.aprobaciones (usuario_id, semana);
create index if not exists aprobaciones_por_plan_hash
  on public.aprobaciones (plan_hash);

alter table public.aprobaciones enable row level security;

-- Lectura: el propio asesorado ve que su plan quedó firmado, el firmante ve lo que firmó,
-- el coach ve todo y quien tenga `leer_entrenamiento` también.
create policy aprobaciones_leer on public.aprobaciones
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or firmante = (select auth.uid())
    or (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

-- A PROPÓSITO no hay política de insert/update/delete para `authenticated`: el diseño
-- exige que el navegador NUNCA pueda insertar una aprobación (§1 del encargo). Sin
-- política, cualquier intento de insertar con la sesión de un usuario afecta 0 filas antes
-- de evaluar nada más — no hace falta un `with check (false)` porque la ausencia de
-- política YA deniega por defecto en RLS.
revoke all on public.aprobaciones from anon, public;
grant select on public.aprobaciones to authenticated;
grant all on public.aprobaciones to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 6 · RLS ADITIVA: quien tenga `leer_entrenamiento` lee microciclos, check-ins y
--     cuestionarios — SIN sustituir ninguna política existente
-- ────────────────────────────────────────────────────────────────────────────
-- RLS combina varias políticas PERMISSIVE del mismo comando con OR (ninguna de este
-- repo usa `AS RESTRICTIVE`): añadir una política de SELECT nueva solo puede AMPLIAR
-- quién lee, nunca quitarle acceso a quien ya lo tenía. Por eso esto es seguro sin tocar
-- ni una línea de las políticas de la 0001/0006/0058.
--
-- `respuestas` no está en la lista literal del encargo ("check-ins y cuestionarios"), pero
-- se añade aquí también: un cuestionario sin sus respuestas es ilegible para el staff que
-- va a decidir si responde por el asesorado (punto 7), así que "leer cuestionarios" sin
-- "leer respuestas" no cumple lo que la capacidad promete. Ver la sección del PR.

create policy microciclos_lee_capacidad on public.microciclos
  for select to authenticated
  using ((select public.tiene_capacidad('leer_entrenamiento')));

create policy checkins_lee_capacidad on public.checkins
  for select to authenticated
  using ((select public.tiene_capacidad('leer_entrenamiento')));

create policy cuestionarios_lee_capacidad on public.cuestionarios
  for select to authenticated
  using ((select public.tiene_capacidad('leer_entrenamiento')));

create policy respuestas_lee_capacidad on public.respuestas
  for select to authenticated
  using ((select public.tiene_capacidad('leer_entrenamiento')));

-- ────────────────────────────────────────────────────────────────────────────
-- 7 · RPC responder_como_staff(cuestionario_id, respuesta)
-- ────────────────────────────────────────────────────────────────────────────
-- `respuestas` no tenía forma de distinguir "contestó la persona" de "contestó el staff
-- por ella". Se añaden las dos columnas que lo acreditan EN EL SERVIDOR — nunca en un
-- campo del jsonb que manda el navegador (Q2 de Astra: "`_respondido_por='coach'` dentro
-- del JSON enviado por el navegador no acredita autoría").

alter table public.respuestas
  add column if not exists origen text not null default 'asesorado'
    check (origen in ('asesorado', 'staff')),
  add column if not exists respondido_por uuid references public.usuarios_app(id);

alter table public.respuestas
  drop constraint if exists respuestas_staff_tiene_actor;
alter table public.respuestas
  add constraint respuestas_staff_tiene_actor
    check (origen <> 'staff' or respondido_por is not null);

comment on column public.respuestas.origen is
  'asesorado (por defecto, incluye todo lo histórico) o staff (via responder_como_staff).';
comment on column public.respuestas.respondido_por is
  'uuid del staff que respondió por el asesorado. NULL cuando origen=asesorado.';

-- Los parámetros se llaman EXACTAMENTE `cuestionario_id` y `respuesta` —así lo pide el
-- encargo, y así los va a mandar `supabase.rpc('responder_como_staff', {...})` por nombre.
-- Eso choca con la columna `respuestas.cuestionario_id`: sin la directiva de abajo, el
-- `insert` de más adelante sería «column reference "cuestionario_id" is ambiguous» al
-- compilar. `#variable_conflict use_variable` es el mecanismo documentado de PL/pgSQL para
-- este choque exacto (nombre de parámetro = nombre de columna del destino del INSERT):
-- dentro de esta función, un identificador ambiguo se resuelve SIEMPRE a la variable, nunca
-- a la columna. Las columnas se referencian siempre calificadas (`c.id`, `c.asignado_a`)
-- para que no haya ninguna otra ambigüedad de la que fiarse en silencio.
create or replace function public.responder_como_staff(cuestionario_id text, respuesta jsonb)
returns public.respuestas
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  quien       uuid := auth.uid();
  v_usuario   uuid;
  fila        public.respuestas%rowtype;
begin
  if quien is null then
    raise exception 'Falta sesión' using errcode = '28000';
  end if;

  if not public.tiene_capacidad('responder_por_asesorado') then
    raise exception 'No tienes permiso para responder por el asesorado' using errcode = '42501';
  end if;

  if cuestionario_id is null or nullif(trim(cuestionario_id), '') is null then
    raise exception 'Falta el cuestionario';
  end if;

  -- La forma es jsonb, no texto libre: rechazar aquí lo que no sea un objeto evita que un
  -- valor mal formado llegue a `valores`, que el resto de la app da por hecho que SÍ es un
  -- objeto de pregunta→respuesta (lección de la 0062: cuidar los tipos EN LA FUNCIÓN, no
  -- confiar en que el cliente los mande bien).
  if respuesta is null or jsonb_typeof(respuesta) is distinct from 'object' then
    raise exception 'La respuesta debe ser un objeto' using errcode = '22023';
  end if;

  -- ¿De quién es este cuestionario? Solo se responde "por" alguien si el cuestionario
  -- está asignado a una única persona: con varias, "responder por el asesorado" no sabe
  -- decir por cuál, y adivinar sería peor que rechazar.
  select c.asignado_a[1] into v_usuario
    from public.cuestionarios c
    where c.id = cuestionario_id and array_length(c.asignado_a, 1) = 1;

  if v_usuario is null then
    raise exception 'El cuestionario no existe o no está asignado a una sola persona'
      using errcode = 'P0002';
  end if;

  -- INSERTA, no sobrescribe: la historia de respuestas se conserva completa. Corregir una
  -- respuesta del staff es insertar OTRA fila, igual que corregir una orden (punto 4).
  insert into public.respuestas (id, cuestionario_id, usuario_id, fecha_iso, valores, origen, respondido_por)
  values (gen_random_uuid()::text, cuestionario_id, v_usuario, now(), respuesta, 'staff', quien)
  returning * into fila;

  return fila;
end;
$$;

revoke all on function public.responder_como_staff(text, jsonb) from public, anon;
grant execute on function public.responder_como_staff(text, jsonb) to authenticated;

comment on function public.responder_como_staff(text, jsonb) is
  'El staff con `responder_por_asesorado` responde un cuestionario a nombre de un '
  'asesorado. El actor sale de auth.uid(), nunca de un parámetro; inserta, no sobrescribe.';

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- PARA APLICAR EN PRODUCCIÓN — bloque de capacidades, RELLENAR ANTES DE PEGAR
-- ════════════════════════════════════════════════════════════════════════════
-- Deliberadamente NO es parte de la transacción de arriba y NO trae UUID reales (el
-- encargo lo prohíbe: "NO pongas UUID reales en la migración"). El director lo completa
-- con los UUID de `auth.users` de Bryan y Manuela (los mismos que usa la 0006:
-- `select id from auth.users where email = 'alpha+bryan@gmail.com'`, etc.) y lo pega
-- COMO SENTENCIA APARTE, después de confirmar que las tablas de arriba ya existen.
--
-- Bryan: las seis capacidades. Manuela: todas MENOS `autorizar_excepcion` y
-- `firmar_politica` (decisión de Bryan, §4 de RESPUESTA-ASTRA-CONSOLA.md — "no levanta
-- una parada clínica" y "solo la clave de Bryan" respectivamente).
--
-- begin;
-- do $$
-- declare
--   v_bryan uuid;
--   v_manu  uuid;
-- begin
--   select id into v_bryan from auth.users where email = 'alpha+bryan@gmail.com';
--   select id into v_manu  from auth.users where email = 'alpha+manu@gmail.com';
--   if v_bryan is null then raise exception 'No existe la cuenta alpha+bryan@gmail.com'; end if;
--   if v_manu  is null then raise exception 'No existe la cuenta alpha+manu@gmail.com'; end if;
--
--   insert into public.capacidades_staff (usuario_id, capacidad) values
--     (v_bryan, 'leer_entrenamiento'),
--     (v_bryan, 'responder_por_asesorado'),
--     (v_bryan, 'detener_publicacion'),
--     (v_bryan, 'reportar_riesgo'),
--     (v_bryan, 'autorizar_excepcion'),
--     (v_bryan, 'firmar_politica'),
--     (v_manu,  'leer_entrenamiento'),
--     (v_manu,  'responder_por_asesorado'),
--     (v_manu,  'detener_publicacion'),
--     (v_manu,  'reportar_riesgo')
--   on conflict (usuario_id, capacidad) do nothing;
-- end $$;
-- commit;
