-- ============================================================================
-- 0116 · Todo bloqueo es visible y se anula con un toque; contexto clínico firmado; registro de entreno
-- ============================================================================
--
-- NO APLICADA. La escribió la rama `claude/r2-registro-20261012` el 12-oct-2026 y la aplica Bryan, a mano,
-- en el SQL Editor. Sin ella nada se rompe: la tarjeta «Alertas del coach» dice que no pudo cargar, la
-- pantalla «¿entrenaste?» guarda en el dispositivo y deja la subida en la cola hasta que exista `registro_entreno`,
-- y la ficha no muestra el contexto clínico. `adherencias` (la dieta) no se toca en esta migración.
--
-- QUÉ PEDIDO RESUELVE. La regla R2 de `DECISION-REGLAS-FALSOS-BLOQUEOS-20261012.md`: cuando un agente frena,
-- retira o deja un plan inactivo, el coach lo ve en el acto, entiende por qué y puede anularlo con un toque,
-- eligiendo qué hacer. Todo queda registrado: quién, cuándo y con qué razón. El esquema es el de
-- `CONTRATO-DATOS-R2-CAMPOS.md`; esta migración no lo cambia.
--
-- QUÉ CREA (cuatro cosas, ninguna toca `adherencias`):
--   1. `alertas_coach`: una fila por bloqueo. La escribe SOLO el agente (service_role); el coach la lee y la
--      atiende por la RPC. El asesorado NO la lee. La razón es una etiqueta, nunca texto clínico libre.
--   2. La orden `anular_bloqueo` (en `ordenes`) y la RPC `anular_bloqueo(alerta, accion, nota)`:
--        S1 · si la alerta exige firma (retiro/recorte), `continuar_*` se rechaza: anular no salta la firma.
--        S2 · si el nivel es `agudo` (piso R7), `continuar_*` se rechaza: lo decide una persona por otra vía.
--        S3 · solo quien tiene la capacidad (`es_coach()` o `detener_publicacion`; riesgo alto además
--             `autorizar_excepcion`).
--        S4 · no se borra nada: la razón original queda; la anulación es otra fila (la orden) y la alerta
--             solo gana `atendida_*`.
--      La orden solo entra por la RPC: la política de alta de `ordenes` (0084) deja `else false` para todo
--      tipo que no nombre, así que insertar `anular_bloqueo` directo desde el navegador es rechazado.
--   3. `contexto_clinico_firmado`: zona, profesionales a cargo, dolor base y sustancias autodeclaradas, que
--      firma una persona por `firmar_contexto_clinico`. El asesorado NO lo lee. Un agente no escribe la zona:
--      solo la propone con una alerta `propuesta_zona`.
--   4. `registro_entreno`: el «¿entrenaste?» (sí / parcial / no, con porcentaje 0-100 si es sí o parcial), una fila
--      por persona y dia. Es tabla propia: adherencias registra dieta y alimenta el ranking.
--      `unique (usuario_id, fecha)`, y alimenta el ranking. Decisión de Bryan, 12-oct (`CONTRATO-DATOS-R2-CAMPOS.md` §5).
--
-- DECISIONES DE ESTA MIGRACIÓN QUE EL CONTRATO NO FIJABA (anotadas como DUDA en el RESULT):
--   · «Riesgo alto» = `nivel = 'agudo'` o `tipo in ('parada_cardiaca','piso_agudo')`. Para esas alertas,
--     además de la puerta general se exige `autorizar_excepcion` (la tiene Bryan; el rol coach solo no basta).
--   · Quién firma el contexto clínico: `es_coach()` o `autorizar_excepcion`. Leer: `es_coach()` o
--     `leer_entrenamiento`, como el resto de la consola.
--   · `usuario_id` referencia `usuarios_app(id)` (cuyo id ES el de auth.users), igual que `ordenes` y
--     `observaciones_agente`; el contrato decía auth.users.
--
-- SEGURIDAD, la regla de siempre (`GUIA-BRYAN.md` §10): RLS en el mismo paso que el `create table`,
-- `revoke all from anon, public, authenticated` antes de conceder nada, y las funciones `security definer`
-- con `search_path` fijo y sin `execute` para `public` ni `anon`.
--
-- CÓMO COMPROBAR (después de aplicar): las filas 0116 de `supabase/comprobar-migraciones.sql` dicen SI (ANTES
-- de aplicar, NO). El CI corre las sesiones de verdad: `supabase/test/216-bloqueo-visible-y-contexto.sql`.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · alertas_coach
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.alertas_coach (
  id                  uuid primary key default gen_random_uuid(),
  -- La persona afectada. Si se borra a la persona se borra la alerta.
  usuario_id          uuid not null references public.usuarios_app(id) on delete cascade,
  -- El lunes de la semana afectada.
  semana_inicio       date not null,
  -- `cadena_corridas.event_id` que originó la alerta; null si no viene de la cadena.
  evento_id           uuid,
  paso                smallint check (paso between 1 and 6),
  tipo                text not null
                        check (tipo in ('no_programar', 'parada_cardiaca', 'parada_paso3', 'bloqueado_paso4',
                                        'tachado', 'agotado', 'pausada', 'orden_detener', 'propuesta_zona',
                                        'registro_faltante', 'piso_agudo')),
  -- `agudo` = piso R7.
  nivel               text not null default 'normal' check (nivel in ('normal', 'agudo')),
  -- true si el bloqueo es un retiro/recorte que exige firma SSH (`casos_firma`).
  exige_firma         boolean not null default false,
  -- Etiqueta corta y legible; sin texto clínico libre (el literal ya está en la ficha).
  razon               text not null check (length(btrim(razon)) between 1 and 200),
  propuesta           text check (propuesta is null or length(propuesta) <= 300),
  acciones_permitidas text[] not null
                        check (cardinality(acciones_permitidas) > 0
                               and acciones_permitidas <@ array['continuar_ultima_carga', 'continuar_con_ajuste',
                                                                'mantener_y_preguntar', 'mantener_y_derivar']::text[]),
  creada_en           timestamptz not null default now(),
  -- La atención. Quién y cuándo los pone `anular_bloqueo`, nunca el cliente.
  atendida_en         timestamptz,
  atendida_por        uuid references public.usuarios_app(id) on delete set null,
  accion              text check (accion is null or accion in ('continuar_ultima_carga', 'continuar_con_ajuste',
                                                              'mantener_y_preguntar', 'mantener_y_derivar')),
  nota                text check (nota is null or length(nota) <= 500),

  -- Coherencia: sin atender = sin acción; atendida = con hora y con acción. `atendida_por` no se exige
  -- porque pasa a null si se borra esa cuenta (`on delete set null`).
  constraint alertas_coach_atencion_coherente
    check (
      (atendida_en is null and accion is null and atendida_por is null)
      or (atendida_en is not null and accion is not null)
    )
);

comment on table public.alertas_coach is
  'Una fila por bloqueo de la cadena de agentes, visible al coach o staff con detener_publicacion (0116, 2026-10-12, regla R2). La escribe solo el agente '
  '(service_role); se atiende por anular_bloqueo. Nunca se borra: la razón original queda tras anular. El asesorado no la ve.';

-- Una alerta abierta por (persona, semana, tipo, evento): reintentar la corrida no la duplica.
create unique index if not exists alertas_coach_abierta_unica
  on public.alertas_coach (usuario_id, semana_inicio, tipo,
                           coalesce(evento_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where atendida_en is null;

create index if not exists alertas_coach_por_persona
  on public.alertas_coach (usuario_id, creada_en desc);

alter table public.alertas_coach enable row level security;

drop policy if exists alertas_coach_leer on public.alertas_coach;
create policy alertas_coach_leer on public.alertas_coach
  for select to authenticated
  using (
    (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
    or (select public.tiene_capacidad('detener_publicacion'))
  );

-- Sin política de insert/update/delete: lo escribe el agente (service_role) y la única puerta para quien
-- tiene sesión es `anular_bloqueo`.
revoke all on public.alertas_coach from anon, public;
revoke all on public.alertas_coach from authenticated;
grant select on public.alertas_coach to authenticated;
grant all on public.alertas_coach to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · ordenes.tipo admite `anular_bloqueo`
-- ────────────────────────────────────────────────────────────────────────────
-- Igual que 0084/0086: el check de `tipo` se localiza por definición, no por el nombre adivinado. Se
-- conservan TODOS los tipos que ya existen (0083: detener, reportar_riesgo, pedir_correccion, responder;
-- 0084: reanudar, preparar_firma) y se añade uno.
do $$
declare
  v_nombre text;
begin
  select conname into v_nombre
    from pg_constraint
   where conrelid = 'public.ordenes'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%tipo%'
   limit 1;
  if v_nombre is not null then
    execute format('alter table public.ordenes drop constraint %I', v_nombre);
  end if;
end
$$;

alter table public.ordenes
  add constraint ordenes_tipo_check
  check (tipo in ('detener', 'reportar_riesgo', 'pedir_correccion', 'responder', 'reanudar', 'preparar_firma',
                  'anular_bloqueo'));

comment on constraint ordenes_tipo_check on public.ordenes is
  '0116: añade anular_bloqueo (solo por la RPC anular_bloqueo; la política de alta no lo admite directo) '
  'a los seis tipos de la 0083 y la 0084.';

-- La política de alta NO se toca: su `else false` ya rechaza `anular_bloqueo` insertado directo, que es lo
-- que queremos (S1 y S2 viven en la RPC y un insert directo las saltaría).

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · RPC anular_bloqueo
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.anular_bloqueo(
  p_alerta_id uuid,
  p_accion    text,
  p_nota      text default null
)
returns public.alertas_coach
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_nota  text := nullif(btrim(p_nota), '');
  v_fila  public.alertas_coach;
  v_alto  boolean;
begin
  -- S3 · la puerta general.
  if v_actor is null
     or not (public.es_coach() or public.tiene_capacidad('detener_publicacion')) then
    raise exception 'solo quien tiene permiso de detener o reanudar la publicación anula un bloqueo'
      using errcode = '42501';
  end if;
  if p_accion is null
     or p_accion not in ('continuar_ultima_carga', 'continuar_con_ajuste', 'mantener_y_preguntar', 'mantener_y_derivar') then
    raise exception 'la acción es una de: continuar_ultima_carga, continuar_con_ajuste, mantener_y_preguntar, mantener_y_derivar'
      using errcode = '22023';
  end if;
  if v_nota is not null and length(v_nota) > 500 then
    raise exception 'la nota va de 1 a 500 caracteres' using errcode = '22023';
  end if;

  -- `for update`: si dos personas atienden a la vez, la segunda espera y luego ve que ya está atendida.
  select * into v_fila from public.alertas_coach where id = p_alerta_id for update;
  if not found then
    raise exception 'la alerta no existe' using errcode = 'P0002';
  end if;
  if v_fila.atendida_en is not null then
    raise exception 'la alerta ya fue atendida' using errcode = '22023';
  end if;

  -- S3 · riesgo alto: además, la capacidad de excepción (la tiene Bryan).
  v_alto := v_fila.nivel = 'agudo' or v_fila.tipo in ('parada_cardiaca', 'piso_agudo');
  if v_alto and not public.tiene_capacidad('autorizar_excepcion') then
    raise exception 'una alerta de riesgo alto la atiende quien tiene autorizar_excepcion'
      using errcode = '42501';
  end if;

  -- La acción debe ser una de las que la alerta ofrece.
  if not (p_accion = any (v_fila.acciones_permitidas)) then
    raise exception 'esa acción no está permitida para esta alerta' using errcode = '22023';
  end if;

  -- S1 · anular no salta la firma exigida.
  if v_fila.exige_firma and p_accion like 'continuar\_%' then
    raise exception 'este bloqueo exige firma: hace falta la firma antes de continuar' using errcode = 'P0001';
  end if;
  -- S2 · el piso agudo (R7) no se apaga con un toque.
  if v_fila.nivel = 'agudo' and p_accion like 'continuar\_%' then
    raise exception 'señal aguda: no se continúa desde aquí; decide una persona por reportar riesgo o consulta'
      using errcode = 'P0001';
  end if;

  -- La orden (registro de quién, cuándo y qué) y la marca de atendida, en la misma transacción.
  insert into public.ordenes (actor_id, tipo, objetivo, idempotency_key)
  values (
    v_actor,
    'anular_bloqueo',
    jsonb_build_object(
      'alerta_id', v_fila.id,
      'usuario_id', v_fila.usuario_id,
      'semana_inicio', v_fila.semana_inicio,
      'accion', p_accion,
      'nota', v_nota
    ),
    'anular|' || v_fila.usuario_id || '|' || v_fila.semana_inicio || '|' || v_fila.id || '|' || v_actor
  );

  update public.alertas_coach
     set atendida_en  = now(),
         atendida_por = v_actor,
         accion       = p_accion,
         nota         = v_nota
   where id = p_alerta_id
   returning * into v_fila;

  return v_fila;
end;
$$;

revoke all on function public.anular_bloqueo(uuid, text, text) from public, anon;
grant execute on function public.anular_bloqueo(uuid, text, text) to authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · contexto_clinico_firmado
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.contexto_clinico_firmado (
  usuario_id                uuid primary key references public.usuarios_app(id) on delete cascade,
  zona                      text not null check (zona in ('verde', 'amarillo', 'rojo', 'no_determinada')),
  zona_firmada_por          uuid references public.usuarios_app(id) on delete set null,
  zona_firmada_en           timestamptz,
  zona_nota                 text check (zona_nota is null or length(zona_nota) <= 500),
  profesionales_a_cargo     boolean not null default false,
  profesionales_nota        text check (profesionales_nota is null or length(profesionales_nota) <= 500),
  -- Lista de {zona, eva_min, eva_max, desde, validado_por, fecha}.
  dolor_base                jsonb not null default '[]'::jsonb
                              check (jsonb_typeof(dolor_base) = 'array'),
  -- Lista de {nombre, autoadministrada:true, sin_prescripcion, declarada_en, nota}. NUNCA dosis, vía ni fuente:
  -- la base rechaza una entrada que las traiga o que no diga el nombre.
  sustancias_autodeclaradas jsonb not null default '[]'::jsonb
                              check (
                                jsonb_typeof(sustancias_autodeclaradas) = 'array'
                                and not jsonb_path_exists(sustancias_autodeclaradas,
                                      '$[*] ? (@.type() != "object" || !exists(@.nombre) || exists(@.dosis) || exists(@.via) || exists(@."vía") || exists(@.fuente))')
                              ),
  -- Para reglas «sin excepción»: plazo de revisión (por defecto 90 días lo pone la pantalla).
  revisar_antes_de          date,
  actualizado_en            timestamptz not null default now()
);

comment on table public.contexto_clinico_firmado is
  'Contexto clínico que firma una persona del equipo (0116, 2026-10-12, regla R2): zona, profesionales a cargo, dolor base y '
  'sustancias autodeclaradas (sin dosis, vía ni fuente). Se escribe solo por firmar_contexto_clinico. El asesorado no lo lee; '
  'un agente no escribe la zona: la propone con una alerta propuesta_zona.';

alter table public.contexto_clinico_firmado enable row level security;

drop policy if exists contexto_clinico_leer on public.contexto_clinico_firmado;
create policy contexto_clinico_leer on public.contexto_clinico_firmado
  for select to authenticated
  using (
    (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

revoke all on public.contexto_clinico_firmado from anon, public;
revoke all on public.contexto_clinico_firmado from authenticated;
grant select on public.contexto_clinico_firmado to authenticated;
grant all on public.contexto_clinico_firmado to service_role;

create or replace function public.firmar_contexto_clinico(
  p_usuario_id                uuid,
  p_zona                      text,
  p_zona_nota                 text default null,
  p_profesionales_a_cargo     boolean default false,
  p_profesionales_nota        text default null,
  p_dolor_base                jsonb default '[]'::jsonb,
  p_sustancias_autodeclaradas jsonb default '[]'::jsonb,
  p_revisar_antes_de          date default null
)
returns public.contexto_clinico_firmado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_fila  public.contexto_clinico_firmado;
begin
  -- La zona es criterio clínico: no basta con leer la consola.
  if v_actor is null
     or not (public.es_coach() or public.tiene_capacidad('autorizar_excepcion')) then
    raise exception 'solo el coach o quien tiene autorizar_excepcion firma el contexto clínico'
      using errcode = '42501';
  end if;
  if p_usuario_id is null or not exists (select 1 from public.usuarios_app where id = p_usuario_id) then
    raise exception 'la persona no existe' using errcode = 'P0002';
  end if;
  if p_zona is null or p_zona not in ('verde', 'amarillo', 'rojo', 'no_determinada') then
    raise exception 'la zona es verde, amarillo, rojo o no_determinada' using errcode = '22023';
  end if;
  if p_dolor_base is null or jsonb_typeof(p_dolor_base) <> 'array'
     or p_sustancias_autodeclaradas is null or jsonb_typeof(p_sustancias_autodeclaradas) <> 'array' then
    raise exception 'dolor base y sustancias van como lista' using errcode = '22023';
  end if;

  -- Los CHECK de la tabla rechazan dosis/vía/fuente; aquí se avisa con un mensaje que se entienda.
  if jsonb_path_exists(p_sustancias_autodeclaradas,
       '$[*] ? (@.type() != "object" || !exists(@.nombre) || exists(@.dosis) || exists(@.via) || exists(@."vía") || exists(@.fuente))') then
    raise exception 'cada sustancia lleva su nombre y nunca dosis, vía ni fuente' using errcode = '22023';
  end if;

  insert into public.contexto_clinico_firmado as c (
    usuario_id, zona, zona_firmada_por, zona_firmada_en, zona_nota,
    profesionales_a_cargo, profesionales_nota, dolor_base, sustancias_autodeclaradas,
    revisar_antes_de, actualizado_en
  ) values (
    p_usuario_id, p_zona, v_actor, now(), nullif(btrim(p_zona_nota), ''),
    coalesce(p_profesionales_a_cargo, false), nullif(btrim(p_profesionales_nota), ''),
    p_dolor_base, p_sustancias_autodeclaradas,
    p_revisar_antes_de, now()
  )
  on conflict (usuario_id) do update set
    zona                      = excluded.zona,
    zona_firmada_por          = excluded.zona_firmada_por,
    zona_firmada_en           = excluded.zona_firmada_en,
    zona_nota                 = excluded.zona_nota,
    profesionales_a_cargo     = excluded.profesionales_a_cargo,
    profesionales_nota        = excluded.profesionales_nota,
    dolor_base                = excluded.dolor_base,
    sustancias_autodeclaradas = excluded.sustancias_autodeclaradas,
    revisar_antes_de          = excluded.revisar_antes_de,
    actualizado_en            = excluded.actualizado_en
  returning * into v_fila;

  return v_fila;
end;
$$;

revoke all on function public.firmar_contexto_clinico(uuid, text, text, boolean, text, jsonb, jsonb, date) from public, anon;
grant execute on function public.firmar_contexto_clinico(uuid, text, text, boolean, text, jsonb, jsonb, date) to authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · registro_entreno («¿entrenaste?»; contrato §5)
-- ────────────────────────────────────────────────────────────────────────────
-- NO se toca `adherencias`: ni columnas, ni políticas, ni el ranking que la lee.
create table if not exists public.registro_entreno (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.usuarios_app(id) on delete cascade,
  -- El día de la sesión preguntada, en Bogotá.
  fecha          date not null,
  -- Campo heredado sin uso por la app: una respuesta diaria no identifica cuál sesión se hizo.
  sesion_ref     text check (sesion_ref is null or length(sesion_ref) <= 120),
  estado         text not null check (estado in ('si', 'parcial', 'no')),
  porcentaje     smallint check (porcentaje between 0 and 100),
  comentario     text check (comentario is null or length(comentario) <= 500),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  -- Con sí o parcial el porcentaje es obligatorio. Con no puede venir nulo (o un número, sin efecto).
  constraint registro_entreno_porcentaje_con_si_o_parcial
    check (estado = 'no' or porcentaje is not null)
);

comment on table public.registro_entreno is
  '0116 (2026-10-13): «¿entrenaste?» una vez por día planificado. Tabla propia: adherencias es la dieta (unique usuario+fecha) '
  'y alimenta el ranking. La persona inserta y actualiza lo suyo; no borra. El staff con leer_entrenamiento lee.';

-- Una fila por persona y día; `sesion_ref` no forma parte de la identidad diaria.
drop index if exists public.registro_entreno_unico;
create unique index registro_entreno_unico
  on public.registro_entreno (usuario_id, fecha);

create index if not exists registro_entreno_por_persona
  on public.registro_entreno (usuario_id, fecha desc);

drop trigger if exists trg_actualizado_en on public.registro_entreno;
create trigger trg_actualizado_en before update on public.registro_entreno
  for each row execute function public.marcar_actualizado();

alter table public.registro_entreno enable row level security;

revoke all on public.registro_entreno from anon, public;
revoke all on public.registro_entreno from authenticated;
grant select, insert, update on public.registro_entreno to authenticated;
-- Sin `delete` para nadie con sesión: lo que la persona dijo no se borra desde el navegador.

drop policy if exists registro_entreno_leer on public.registro_entreno;
create policy registro_entreno_leer on public.registro_entreno
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select public.es_coach())
    or (select public.tiene_capacidad('leer_entrenamiento'))
  );

drop policy if exists registro_entreno_insertar_propio on public.registro_entreno;
create policy registro_entreno_insertar_propio on public.registro_entreno
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

drop policy if exists registro_entreno_actualizar_propio on public.registro_entreno;
create policy registro_entreno_actualizar_propio on public.registro_entreno
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- service_role (los agentes, para R1) salta la RLS y conserva sus permisos por defecto.

commit;
