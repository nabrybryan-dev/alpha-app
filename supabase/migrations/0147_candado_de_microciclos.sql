-- ============================================================================
-- 0147 · Candado de microciclos: la app y la cadena no se pisan en silencio
-- ============================================================================
--
-- DECISION DE BRYAN (28-oct-2026): «encender con candado». Si la cadena de agentes ya cargó o
-- activó la semana de una persona, la app NO la pisa: avisa al coach, le dice quién la cargó y
-- cuándo, y no hace nada sin una confirmación explícita. Al revés también: si la app ya cargó la
-- semana, la cadena no la pisa en silencio.
--
-- POR QUÉ EN LA BASE. La cadena no pasa por la app: carga con `plantilla-carga-microciclo.sql`
-- (insert directo). Un candado solo en la pantalla no la frenaría a ella. Y `activar_microciclo`
-- (0060/0066) solo garantiza «un único activo» (índice de la 0069): el segundo en llegar cierra al
-- primero y nadie se entera.
--
-- LA REGLA (una sola, en `microciclo_choque`). Al ACTIVAR un microciclo de la persona P con número N
-- y origen O, hay choque si P ya tiene otro microciclo (activo o cerrado) de OTRO origen con número
-- >= N. Es decir: la semana N ya la cargó (o la activó) el otro. Un número MAYOR sobre uno de otro
-- origen no es choque: es el relevo normal (la app abre M9 sobre el M8 de la cadena al vencer).
--
-- ORIGEN. `microciclos.origen` es 'cadena' o 'app'. Lo pone un trigger al INSERTAR: sesión de usuario
-- (auth.uid() no nulo) = 'app'; contexto de servicio (SQL Editor, service_role) = 'cadena'. Así la
-- app no manda ninguna columna nueva y no se rompe si esta migración aún no está aplicada. Todo lo
-- que existe hoy lo cargó la cadena (el motor de la app estuvo apagado): se rellena 'cadena'.
--
-- EVIDENCIA de que la cadena NUNCA carga con sesión de usuario (revisada el 29-oct-2026; las rutas
-- cuelgan de la carpeta dev/ del equipo de Bryan):
--   · cerebro-alpha-agentes/tuberia/README.md:36-37: «Los scripts generan SQL, no lo ejecutan. No
--     leen credenciales»; el SQL se corre con el MCP de Supabase (`execute_sql`) o con `psql`.
--   · cerebro-alpha-agentes/tuberia/cargar_perfil_prueba.py:31: mismo reparto (execute_sql o psql).
--   · cerebro-alpha-agentes/tuberia/cargar.py:135: la carga real se ejecuta con `psql`.
--   · cerebro-alpha-agentes/tuberia/guardar_borrador_plan.py:19 y activar_plan.py:93: «service_role
--     (`supabase db query --linked`)»; subir_a_consola.py:92 y :828, igual.
--   · supabase/plantilla-carga-microciclo.sql (sección 4): se usa en un archivo `begin; select
--     tmp_cargar_siguiente(...); commit;` que se ejecuta por esas mismas vías, sin app de por medio.
--   · scripts/rellenar-carga.mjs:35-43: `SUPABASE_SERVICE_KEY` (service_role); solo hace UPDATE de
--     `datos`, sin insertar. scripts/semilla-sql.mjs genera SQL puro.
--   Ninguna de esas vías hace `signIn`: psql, execute_sql, db query y la clave de servicio entran
--   sin claim `sub`, es decir con auth.uid() nulo, que es lo que lee el trigger (comportamiento
--   estándar de Supabase, no ejecutado aquí). No hay ninguna carga de la cadena con sesión de
--   usuario en ese código. Lo que NO se puede comprobar desde el repo es un uso manual futuro con
--   sesión: si pasara, esa carga quedaría con origen 'app'.
--
-- QUÉ HACE CADA PIEZA
--   1 · columnas origen / cargado_en / cargado_por en `microciclos`.
--   2 · trigger que las rellena al insertar.
--   3 · `microciclo_choque(...)`: la regla.
--   4 · trigger que IMPIDE activar con choque (es lo que frena a la cadena) sin levantar excepción:
--       deja la fila sin activar y otro trigger (AFTER) registra el aviso. Se salta con la
--       confirmación (punto 7).
--   5 · tabla `microciclos_choques`: el aviso para el coach (quién, cuándo, qué propuesta).
--   6 · `activar_microciclo` (misma firma): con choque NO levanta excepción —una excepción pararía
--       la cola del teléfono, ver 0060—; no activa y deja el aviso en (5).
--   8 · `decidir_primer_plan` / `vencer_primer_plan` redefinidas: un choque deja el plan en `espera_bryan`.
--   7 · `confirmar_pisar_microciclo` / `descartar_choque_microciclo`: la decisión explícita del
--       coach mediante confirmar_pisar_microciclo; una variable de sesión no autoriza a pisar.
--      Además (decidido por Bryan, 29-oct): «Activar igualmente» sobre un primer plan que quedó en
--      `espera_bryan` por choque lo pasa a `aprobado` en el mismo paso (aprobado por quien confirma),
--      solo con capacidades de aprobar, liberar y autorizar excepción, y si quedó activa;
--      un plan en espera por otro motivo no se toca.
-- PLANTILLA DE LA CADENA ante un choque (decidido por Bryan, 29-oct): avisa y devuelve «CHOQUE · ...»,
-- sin fallar.
--
-- NO TOCA nada que ya exista salvo `activar_microciclo` (mismo cuerpo + el candado) y, en el punto 8,
-- `decidir_primer_plan` / `vencer_primer_plan` (M2: 0137/0141), que ahora no dan por activado lo que el candado frenó.
-- Aplicación: a mano en el SQL Editor, con la casilla de Bryan. NO está aplicada.
-- Comprobación: `comprobar-migraciones.sql` fila «0147» y `supabase/test/216-candado-de-microciclos.sql`.
-- ============================================================================

begin;

-- ── 1 · Quién cargó y cuándo ───────────────────────────────────────────────
alter table public.microciclos
  add column if not exists origen      text,
  add column if not exists cargado_en  timestamptz,
  add column if not exists cargado_por uuid;

update public.microciclos
   set origen     = coalesce(origen, 'cadena'),
       cargado_en = coalesce(cargado_en, actualizado_en)
 where origen is null or cargado_en is null;

alter table public.microciclos
  alter column origen set default 'cadena',
  alter column origen set not null,
  alter column cargado_en set default now(),
  alter column cargado_en set not null;

alter table public.microciclos drop constraint if exists microciclos_origen_check;
alter table public.microciclos
  add constraint microciclos_origen_check check (origen in ('cadena', 'app'));

-- ── 2 · Se rellenan al insertar ────────────────────────────────────────────
create or replace function public.microciclos_poner_origen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    -- Una sesión de usuario es la app (el coach cargando o preparando desde la pantalla).
    new.origen := 'app';
    new.cargado_por := auth.uid();
  else
    new.origen := coalesce(new.origen, 'cadena');
  end if;
  new.cargado_en := coalesce(new.cargado_en, now());
  return new;
end;
$$;

-- ORDEN DE LOS TRIGGERS. Postgres dispara los del mismo momento y evento POR ORDEN ALFABETICO del
-- nombre. El candado (4) lee `new.origen`, así que el que lo fija tiene que dispararse antes: por eso
-- los nombres llevan a_ / b_ (y c_ el del aviso, ya AFTER). Si alguien renombra uno y los invierte, el
-- candado evaluaría con el origen por defecto 'cadena' en vez del definitivo; el test 216 comprueba
-- el orden por nombre y, aparte, un insert `activo` con sesión.
drop trigger if exists trg_microciclos_poner_origen on public.microciclos;  -- nombre del borrador
drop trigger if exists trg_microciclos_a_origen on public.microciclos;
create trigger trg_microciclos_a_origen
  before insert on public.microciclos
  for each row execute function public.microciclos_poner_origen();

-- ── 3 · La regla ───────────────────────────────────────────────────────────
-- Devuelve el microciclo AJENO que ya ocupa esa semana (el más reciente), o ninguna fila.
create or replace function public.microciclo_choque(
  p_usuario uuid, p_id text, p_numero int, p_origen text
)
returns table (id text, numero int, estado text, origen text, cargado_en timestamptz, cargado_por uuid)
language sql
stable
set search_path = public
as $$
  select m.id, m.numero, m.estado, m.origen, m.cargado_en, m.cargado_por
    from public.microciclos m
   where m.usuario_id = p_usuario
     and m.id <> p_id
     and m.estado in ('activo', 'cerrado')
     and m.origen <> p_origen
     and m.numero >= p_numero
   order by m.numero desc, m.cargado_en desc
   limit 1;
$$;

revoke all on function public.microciclo_choque(uuid, text, int, text) from public, anon;
grant execute on function public.microciclo_choque(uuid, text, int, text) to authenticated, service_role;

-- H5: señal no forjable, ligada a propuesta, actor y transacción (patrón 0138).
-- Solo confirmar_pisar_microciclo (definer) escribe; no se concede acceso a la tabla.
create table if not exists public.pisadas_microciclo_autorizadas (
  propuesta_id text not null,
  xid bigint not null default txid_current(),
  autorizada_por uuid,
  creada_en timestamptz not null default clock_timestamp(),
  primary key (propuesta_id, xid)
);
alter table public.pisadas_microciclo_autorizadas enable row level security;
revoke all on public.pisadas_microciclo_autorizadas from public, anon, authenticated, service_role;

create or replace function public.pisada_microciclo_autorizada(p_propuesta_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pisadas_microciclo_autorizadas a
     where a.propuesta_id = p_propuesta_id and a.xid = txid_current()
       and a.autorizada_por is not distinct from auth.uid()
  );
$$;
revoke all on function public.pisada_microciclo_autorizada(text) from public, anon;
grant execute on function public.pisada_microciclo_autorizada(text) to authenticated, service_role;

-- ── 4 · Nadie activa con choque sin confirmar (frena a la cadena Y deja el aviso) ──
-- DECISION (hallazgo H3): el candado NO levanta excepción. Una excepción deshace la transacción
-- entera, el aviso incluido (Postgres no tiene transacciones autónomas), y el contrato es «todo
-- choque queda registrado». Así que el candado BLOQUEA y REGISTRA:
--   · BEFORE (b_candado): si activar chocaría, el estado nuevo no se aplica (INSERT -> 'propuesto';
--     UPDATE -> se queda el estado que tenía) y se anota en una variable local de la transacción
--     qué microciclo quedó bloqueado. Un `raise notice` lo dice a quien corra el SQL a mano.
--   · AFTER (c_registrar_choque): ya existe la fila (la tabla de avisos la referencia), así que
--     llama a `registrar_choque_microciclo`. La carga de la cadena termina SIN error y SIN activar;
--     la plantilla lo comprueba antes de cerrar nada y devuelve «CHOQUE · ...» (ver allí).
create or replace function public.microciclos_candado()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ch record;
begin
  if new.estado = 'activo' and (tg_op = 'INSERT' or old.estado is distinct from 'activo') then
    if not public.pisada_microciclo_autorizada(new.id) then
      select * into v_ch from public.microciclo_choque(new.usuario_id, new.id, new.numero, new.origen);
      if found then
        new.estado := case when tg_op = 'INSERT' then 'propuesto' else old.estado end;
        perform set_config('alpha.choque_bloqueado', new.id, true);
        raise notice
          'candado_microciclo: la semana M% de esta persona ya la cargó "%" (%, microciclo %, %). '
          'M% (%) NO se activó y queda un aviso para el coach. Pisar a propósito: '
          'usar confirmar_pisar_microciclo con sesión de coach y liberación vigente.',
          v_ch.numero, v_ch.origen, v_ch.cargado_en, v_ch.id, v_ch.estado, new.numero, new.id;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_microciclos_candado on public.microciclos;  -- nombre del borrador
drop trigger if exists trg_microciclos_b_candado on public.microciclos;
create trigger trg_microciclos_b_candado
  before insert or update of estado on public.microciclos
  for each row execute function public.microciclos_candado();

-- security definer + la función interna (sin guarda de staff): el aviso se registra SIEMPRE que el
-- BEFORE bloqueó una activación, también cuando la escritura la hace una sesión que no es de staff
-- (PWA vieja del asesorado que sube un microciclo con estado 'activo'). Con la guarda de staff, el
-- AFTER lanzaba 42501 y el upsert entero fallaba: se perdían las series (lo que la 0021 evitaba).
-- Quien escribe conserva sus datos, el estado no cambia y el coach ve el aviso.
create or replace function public.microciclos_registrar_choque()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('alpha.choque_bloqueado', true), '') = new.id then
    perform set_config('alpha.choque_bloqueado', '', true);
    perform public.registrar_choque_microciclo_interno(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_microciclos_c_registrar_choque on public.microciclos;
create trigger trg_microciclos_c_registrar_choque
  after insert or update of estado on public.microciclos
  for each row execute function public.microciclos_registrar_choque();

-- ── 5 · El aviso para el coach ─────────────────────────────────────────────
create table if not exists public.microciclos_choques (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references public.usuarios_app (id) on delete cascade,
  propuesta_id     text not null references public.microciclos (id) on delete cascade,
  propuesta_numero int  not null,
  propuesta_origen text not null,
  existente_id     text,
  existente_numero int  not null,
  existente_origen text not null,
  existente_en     timestamptz,
  existente_por    uuid,
  estado           text not null default 'pendiente'
                   check (estado in ('pendiente', 'confirmado', 'descartado')),
  creado_en        timestamptz not null default now(),
  resuelto_por     uuid,
  resuelto_en      timestamptz
);

-- Un reintento de la cola no duplica el aviso: una propuesta, un aviso pendiente.
create unique index if not exists microciclos_choques_uno_pendiente
  on public.microciclos_choques (propuesta_id) where estado = 'pendiente';

alter table public.microciclos_choques enable row level security;

drop policy if exists microciclos_choques_leer on public.microciclos_choques;
create policy microciclos_choques_leer on public.microciclos_choques
  for select to authenticated using (public.es_staff());

-- Lección de la 0084: sin el revoke explícito el privilegio por defecto se queda.
revoke all on public.microciclos_choques from public, anon, authenticated;
grant select on public.microciclos_choques to authenticated;
grant all on public.microciclos_choques to service_role;

create or replace function public.registrar_choque_microciclo_interno(p_propuesta_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p  record;
  ch record;
begin
  select * into p from public.microciclos where id = p_propuesta_id;
  if not found then return; end if;
  select * into ch from public.microciclo_choque(p.usuario_id, p.id, p.numero, p.origen);
  if not found then return; end if;
  insert into public.microciclos_choques
    (usuario_id, propuesta_id, propuesta_numero, propuesta_origen,
     existente_id, existente_numero, existente_origen, existente_en, existente_por)
  values
    (p.usuario_id, p.id, p.numero, p.origen,
     ch.id, ch.numero, ch.origen, ch.cargado_en, ch.cargado_por)
  on conflict (propuesta_id) where estado = 'pendiente' do nothing;
end;
$$;

-- Solo la llama el trigger AFTER (que es security definer) y el envoltorio de abajo: nadie más.
revoke all on function public.registrar_choque_microciclo_interno(text) from public, anon, authenticated;
grant execute on function public.registrar_choque_microciclo_interno(text) to service_role;

-- Llamada directa (consola, coach): sigue pidiendo staff, igual que antes.
create or replace function public.registrar_choque_microciclo(p_propuesta_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.es_staff() then
    raise exception 'registrar_choque_microciclo: solo el staff' using errcode = '42501';
  end if;
  perform public.registrar_choque_microciclo_interno(p_propuesta_id);
end;
$$;

revoke all on function public.registrar_choque_microciclo(text) from public, anon;
grant execute on function public.registrar_choque_microciclo(text) to authenticated, service_role;

-- ── 6 · activar_microciclo con candado (misma firma, base M2 de 0138 sobre 0135) ─
create or replace function public.activar_microciclo(p_propuesta_id text)
returns void
language plpgsql
set search_path = public
as $function$
-- Protege: sesion/staff/capacidad, huella/persona liberada, cerrado y unico activo (0135);
-- autorizacion no forjable por transaccion (0138); choque con aviso sin excepcion (0147).
declare
  v_uid    uuid;
  v_estado text;
  v_activos int;
  v_numero int;
  v_origen text;
begin
  -- Guardas de liberacion (0135), en este orden: sesion, staff, capacidad. Antes de mirar si la fila existe.
  if auth.uid() is null then
    raise exception 'activar_microciclo: se requiere sesion' using errcode = '42501';
  end if;
  if not public.es_staff() then
    raise exception 'activar_microciclo: el estado del microciclo lo decide el staff' using errcode = '42501';
  end if;
  if not public.tiene_capacidad('liberar_prescripcion') then
    raise exception 'activar_microciclo: falta la capacidad de liberar' using errcode = '42501';
  end if;

  select usuario_id, estado, numero, origen into v_uid, v_estado, v_numero, v_origen
    from public.microciclos
   where id = p_propuesta_id;

  -- Sin fila no hay nada que activar.
  if v_uid is null then
    return;
  end if;

  -- Un bloque cerrado no se reabre.
  if v_estado = 'cerrado' then
    return;
  end if;

  -- Una version se activa solo si esa huella exacta fue liberada por un humano autorizado.
  if v_estado <> 'activo' and not public.microciclo_liberado(p_propuesta_id) then
    raise exception 'activar_microciclo: esta version no tiene liberacion vigente' using errcode = '42501';
  end if;

  -- EL CANDADO. Solo al pasar de propuesto a activo: re-afirmar uno ya activo es el reintento
  -- inofensivo de la cola. Sin excepción (pararía la cola del teléfono): no se activa y queda el aviso.
  if v_estado = 'propuesto'
     and not public.pisada_microciclo_autorizada(p_propuesta_id)
     and exists (select 1 from public.microciclo_choque(v_uid, p_propuesta_id, v_numero, v_origen)) then
    perform public.registrar_choque_microciclo(p_propuesta_id);
    return;
  end if;

  -- 0138: la autorizacion NO es una senal que el actor pueda fijar: la escribe una funcion definer en una tabla sin privilegios (ver trigger).
  perform public.autorizar_activacion(p_propuesta_id);

  -- CERRAR PRIMERO Y ABRIR DESPUES, dentro de la misma transaccion.
  update public.microciclos
     set estado = 'cerrado'
   where usuario_id = v_uid
     and id <> p_propuesta_id
     and estado = 'activo';

  update public.microciclos
     set estado = 'activo'
   where id = p_propuesta_id;

  select count(*) into v_activos
    from public.microciclos
   where usuario_id = v_uid
     and estado = 'activo';

  if v_activos <> 1 then
    raise exception 'activar_microciclo: quedaron % activos para el usuario %', v_activos, v_uid;
  end if;
end;
$function$;

revoke all on function public.activar_microciclo(text) from public, anon;
grant execute on function public.activar_microciclo(text) to authenticated, service_role;

-- ── 7 · La decisión explícita del coach ────────────────────────────────────
create or replace function public.confirmar_pisar_microciclo(p_propuesta_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
begin
  if auth.uid() is not null and not public.es_coach() then
    raise exception 'confirmar_pisar_microciclo: solo el coach confirma' using errcode = '42501';
  end if;
  delete from public.pisadas_microciclo_autorizadas
   where xid <> txid_current() and creada_en < clock_timestamp() - interval '1 day';
  insert into public.pisadas_microciclo_autorizadas (propuesta_id, autorizada_por)
  values (p_propuesta_id, auth.uid());
  perform public.activar_microciclo(p_propuesta_id);
  -- `activar_microciclo` vuelve en silencio si la propuesta ya se cerró o se borró. Marcar el aviso
  -- «confirmado» sin que nada se haya activado dejaría un registro falso: se corta, el aviso
  -- sigue pendiente (puede descartarse) y el coach ve el error.
  select m.estado into v_estado from public.microciclos m where m.id = p_propuesta_id;
  if v_estado is distinct from 'activo' then
    raise exception 'confirmar_pisar_microciclo: la propuesta % no quedó activa (estado: %)',
      p_propuesta_id, coalesce(v_estado, 'no existe') using errcode = '22023';
  end if;
  update public.microciclos_choques
     set estado = 'confirmado', resuelto_por = auth.uid(), resuelto_en = now()
   where propuesta_id = p_propuesta_id and estado = 'pendiente';
  -- Decidido por Bryan, 29-oct: si ese choque dejó un primer plan en `espera_bryan` (punto 8), «Activar
  -- igualmente» lo aprueba EN EL MISMO PASO si quien confirma tiene las capacidades de 0137.
  -- Mismos campos que la 0086 deja en un plan aprobado: estado, decidido_por (quien confirma),
  -- decidido_en y motivo (su check exige autor y fecha). Solo el motivo de choque: un plan en espera
  -- por otra causa no se toca. Con auth.uid() nulo (la cadena, vía service_role) no hay autor humano
  -- que firme y el check lo rechazaría: ahí el plan se queda como está.
  -- H4: activar no equivale a aprobar. Espera_bryan exige excepción incluso con riesgo bajo.
  -- Sin estas capacidades se conserva íntegra la aprobación.
  if auth.uid() is not null
     and public.tiene_capacidad('aprobar_primer_plan')
     and public.tiene_capacidad('liberar_prescripcion') then
    update public.aprobaciones_primer_plan a
       set estado = 'aprobado', decidido_por = auth.uid(), decidido_en = now(),
           motivo = 'Activado igualmente tras el choque de microciclo', actualizado_en = now()
     where a.microciclo_id = p_propuesta_id
       and a.estado = 'espera_bryan'
       and a.motivo_espera like 'Choque de microciclo%'
       and (not (a.riesgo = 'alto' or a.estado = 'espera_bryan')
            or public.tiene_capacidad('autorizar_excepcion'));
  end if;
  delete from public.pisadas_microciclo_autorizadas
   where propuesta_id = p_propuesta_id and xid = txid_current();
end;
$$;

revoke all on function public.confirmar_pisar_microciclo(text) from public, anon;
grant execute on function public.confirmar_pisar_microciclo(text) to authenticated, service_role;

create or replace function public.descartar_choque_microciclo(p_choque_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.es_coach() then
    raise exception 'descartar_choque_microciclo: solo el coach decide' using errcode = '42501';
  end if;
  update public.microciclos_choques
     set estado = 'descartado', resuelto_por = auth.uid(), resuelto_en = now()
   where id = p_choque_id and estado = 'pendiente';
end;
$$;

revoke all on function public.descartar_choque_microciclo(uuid) from public, anon;
grant execute on function public.descartar_choque_microciclo(uuid) to authenticated, service_role;

-- ── 8 · Aprobar un primer plan que choca NO lo deja 'aprobado' sin activar ──
-- Conserva M2 (0137/0141) y suma el candado; firma solo despues de activar (0145).

create or replace function public.decidir_primer_plan(aprobacion_id uuid, decision text, motivo text default null)
returns public.aprobaciones_primer_plan
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
-- Protege: sesion, capacidad, decision valida, bloqueo de fila, rechazo motivado,
-- excepcion alto/espera, propuesta y liberacion de huella/persona (0137/0135);
-- firma unica solo tras activar (0145); choque en espera sin firma (0147).
declare
  quien        uuid := auth.uid();
  fila         public.aprobaciones_primer_plan%rowtype;
  v_estado_mc  text;
  v_motivo     text := nullif(btrim(coalesce(motivo, '')), '');
begin
  if quien is null then
    raise exception 'Falta sesión' using errcode = '28000';
  end if;

  if not public.tiene_capacidad('aprobar_primer_plan') then
    raise exception 'No tienes permiso para decidir primeros planes' using errcode = '42501';
  end if;

  if decision is null or decision not in ('aprobar', 'rechazar') then
    raise exception 'Decisión desconocida: %', decision using errcode = '22023';
  end if;

  select a.* into fila
    from public.aprobaciones_primer_plan a
   where a.id = aprobacion_id
   for update;
  if not found then
    raise exception 'La aprobación no existe' using errcode = 'P0002';
  end if;

  if fila.estado not in ('propuesto', 'espera_bryan') then
    raise exception 'Este plan ya se decidió (estado actual: %)', fila.estado using errcode = '22023';
  end if;

  if decision = 'rechazar' then
    if v_motivo is null then
      raise exception 'Hace falta un motivo para rechazar' using errcode = '22023';
    end if;
    update public.aprobaciones_primer_plan a
       set estado = 'rechazado', decidido_por = quien, decidido_en = now(),
           motivo = v_motivo, actualizado_en = now()
     where a.id = aprobacion_id
    returning * into fila;
    return fila;
  end if;

  -- Aprobar. Lo clínico (riesgo alto) y lo que ya venció hacia Bryan solo lo aprueba quien
  -- tenga `autorizar_excepcion`.
  if (fila.riesgo = 'alto' or fila.estado = 'espera_bryan')
     and not public.tiene_capacidad('autorizar_excepcion') then
    raise exception 'Este plan lo aprueba Bryan (riesgo %, estado %)', fila.riesgo, fila.estado
      using errcode = '42501';
  end if;

  select m.estado into v_estado_mc from public.microciclos m where m.id = fila.microciclo_id;
  if v_estado_mc is distinct from 'propuesto' then
    raise exception 'El plan propuesto ya no está pendiente (estado del microciclo: %)', v_estado_mc
      using errcode = '22023';
  end if;

  -- 0137: aprobar ES la liberacion humana de ESTA version (guarda de 0135). Quien aprueba debe poder liberar; la huella se toma del contenido
  -- bloqueado en esta misma transaccion. Limite: la consola no manda la huella que vio la persona (propuesta C4: pasarla y compararla).
  if not public.tiene_capacidad('liberar_prescripcion') then
    raise exception 'Aprobar un primer plan exige tambien la capacidad de liberar prescripciones' using errcode = '42501';
  end if;
  insert into public.liberaciones_microciclo (propuesta_id, persona_id, huella, liberado_por)
    select m.id, m.usuario_id, public.huella_microciclo(m.datos), quien from public.microciclos m where m.id = fila.microciclo_id for share of m
  on conflict (propuesta_id, huella) do nothing;
  -- Publicar: el mismo camino que usa el resto de la app (cierra y abre en una operación).
  perform public.activar_microciclo(fila.microciclo_id);

  select m.estado into v_estado_mc from public.microciclos m where m.id = fila.microciclo_id;
  if v_estado_mc is distinct from 'activo' then
    -- 0147: con choque `activar_microciclo` NO activa y NO levanta excepción (dejó un aviso en
    -- `microciclos_choques`). Aprobar sin activar dejaba el plan 'aprobado' sobre un microciclo
    -- 'propuesto' para siempre. Estado que ya existe en la 0086 para «esto lo mira Bryan»:
    -- `espera_bryan`, con el motivo escrito. Sin autor ni fecha de decisión: nadie lo aprobó
    -- todavía. Y NO se levanta excepción: deshacería el aviso que acaba de quedar escrito.
    update public.aprobaciones_primer_plan a
       set estado = 'espera_bryan',
           motivo_espera = 'Choque de microciclo: ya hay una semana de otro origen que no se pisa '
                           'sin confirmar (ver el aviso del panel de Microciclos). Se aprobó, pero NO '
                           'se activó.',
           actualizado_en = now()
     where a.id = aprobacion_id
    returning * into fila;
    return fila;
  end if;

  update public.aprobaciones_primer_plan a
     set estado = 'aprobado', decidido_por = quien, decidido_en = now(),
         motivo = v_motivo, actualizado_en = now()
   where a.id = aprobacion_id
  returning * into fila;

  return fila;
end;
$$;

revoke all on function public.decidir_primer_plan(uuid, text, text) from public, anon;
grant execute on function public.decidir_primer_plan(uuid, text, text) to authenticated, service_role;

create or replace function public.vencer_primer_plan()
returns table (aprobados int, a_bryan int)
language plpgsql
security definer
set search_path = public
as $$
-- Protege: plazo servidor/skip locked, alto, dudas, estado, clasificacion sistema,
-- revision y regla apagada (0141); revalidacion de huella, auditoria y aviso por
-- activar_por_regla_ventana (0141); encendido auditado intacto (0143);
-- firma unica (0145); choque con aviso sin contar aprobacion (0147).
declare
  r           record;
  v_estado_mc text;
  n_aprob     int := 0;
  n_bryan     int := 0;
  v_espera    text;
  v_activa    boolean;
begin
  select activa into v_activa from public.regla_ventana_primer_plan;
  for r in
    select a.*
      from public.aprobaciones_primer_plan a
     where a.estado = 'propuesto' and a.plazo_hasta <= clock_timestamp()
     order by a.plazo_hasta
     for update skip locked
  loop
    select m.estado into v_estado_mc from public.microciclos m where m.id = r.microciclo_id;

    v_espera := case
      when r.riesgo = 'alto'  then 'Riesgo alto (clínico): nunca pasa sin Bryan.'
      when cardinality(r.dudas_pendientes) > 0 then
        'Dudas pendientes que frenan la progresión: ' || array_to_string(r.dudas_pendientes, '; ')
      when v_estado_mc is distinct from 'propuesto' then
        'El microciclo ya no está propuesto (estado: ' || coalesce(v_estado_mc, 'no existe') || ').'
      when r.clasificado_por is distinct from 'sistema' or r.clasificado_en is null then
        'Sin clasificacion del sistema: no pasa; la guarda de liberacion exige que una persona libere esta version.'
      when r.requiere_revision then 'El plan requiere aprobacion o revision: nunca pasa sin firma ni revision calificada.'
      when not coalesce(v_activa, false) then
        'Plazo vencido sin objeciones (riesgo bajo, sin dudas): la regla de ventana esta apagada y la guarda de liberacion exige que una persona libere esta version.'
      else null
    end;

    -- 0141 activa por UPDATE propio: comprobar antes de cerrar el activo anterior.
    -- Fuera del bloque de excepciones para conservar el aviso sin revertirlo.
    if v_espera is null
       and not public.pisada_microciclo_autorizada(r.microciclo_id)
       and exists (
         select 1 from public.microciclos m,
           lateral public.microciclo_choque(m.usuario_id, m.id, m.numero, m.origen) ch
          where m.id = r.microciclo_id
       ) then
      perform public.registrar_choque_microciclo(r.microciclo_id);
      v_espera := 'Choque de microciclo: ya hay una semana de otro origen que no se pisa sin confirmar. No se activo.';
    end if;
    if v_espera is null then
      begin
        perform public.activar_por_regla_ventana(r.id);
        n_aprob := n_aprob + 1;
        continue;
      exception when others then
        v_espera := 'La regla de ventana no pudo activar el plan (' || sqlerrm || '); la guarda de liberacion exige que una persona libere esta version.';
      end;
    end if;

    update public.aprobaciones_primer_plan
       set estado = 'espera_bryan', motivo_espera = v_espera, actualizado_en = now()
     where id = r.id;
    n_bryan := n_bryan + 1;
  end loop;

  aprobados := n_aprob;
  a_bryan := n_bryan;
  return next;
end;
$$;

revoke all on function public.vencer_primer_plan() from public, anon, authenticated;
grant execute on function public.vencer_primer_plan() to service_role;

commit;
