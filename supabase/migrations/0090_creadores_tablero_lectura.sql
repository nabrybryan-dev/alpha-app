-- ============================================================================
-- 0090 · Tablero de CREADORES en la consola — capa de lectura (fase F1)
-- ============================================================================
--
-- Pedido por Bryan el 28-sep-2026: «centralizar la bola de nieve en la plataforma», con el
-- mismo molde que los asesorados. Plan: `alpha-estudio/bola-de-nieve/PLAN-CENTRALIZACION.md`
-- §1, §2 y §7 (F1 = ver). Decisiones de Bryan del 28-sep (§9 del plan): la sección vive en la
-- consola de alpha-app; Bryan O Manuela desempatan y firman.
--
-- QUÉ ENTRA AQUÍ, Y QUÉ NO.
--   1. Tres tablas de PROYECCIÓN que escribe solo `service_role` (el importador que corre en
--      los equipos de casa, `bola-de-nieve/tablero/subir_creadores.py`); el navegador solo lee:
--        · `creadores_candidatos`  — una fila por creador, su carril del embudo y el porqué;
--        · `creadores_revisiones`  — una fila INMUTABLE por (revisión, revisor, reel);
--        · `creadores_eventos`     — historia del embudo, una fila por movimiento.
--   2. Dos capacidades nuevas: `revisar_creadores` (ver el tablero) y `firmar_creadores`
--      (firmar contactos y excepciones; F2). Asignadas a Bryan y a Manuela por UUID.
--   3. Un bucket PRIVADO `creadores-cuadros` para las hojas de cuadros de la etapa 2 (son
--      cuadros de reels públicos, pero no se publican: se leen con URL firmada).
--   NO entra: ningún botón, ninguna escritura desde el navegador, ningún dato de salud,
--   ningún token. La firma (F2) reutilizará `casos_firma` (0084) en otra migración.
--
-- SEGURIDAD, la regla de siempre (`GUIA-BRYAN.md` §10): cada tabla enciende RLS y pierde sus
-- privilegios por defecto (`revoke all … from anon, public`) antes de conceder nada; sin
-- políticas de insert/update/delete, la API con clave anónima o de usuario escribe 0 filas.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · CAPACIDADES NUEVAS
-- ────────────────────────────────────────────────────────────────────────────
-- El check se localiza por definición (patrón de la 0084 y la 0086) y se reescribe con la
-- lista COMPLETA vigente en producción el 28-sep (8 capacidades, comprobado con
-- pg_get_constraintdef) + las dos nuevas.
do $$
declare
  v_nombre text;
begin
  select conname into v_nombre
    from pg_constraint
   where conrelid = 'public.capacidades_staff'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%capacidad%'
   limit 1;
  if v_nombre is not null then
    execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  end if;
end
$$;

alter table public.capacidades_staff
  add constraint capacidades_staff_capacidad_check
  check (capacidad in (
    'leer_entrenamiento',
    'responder_por_asesorado',
    'detener_publicacion',
    'reportar_riesgo',
    'autorizar_excepcion',
    'firmar_politica',
    'aprobar_primer_plan',
    'aprobar_plan_estrategico',
    'revisar_creadores',
    'firmar_creadores'
  ));

-- Solo casa con filas reales (el CI arranca con la base vacía).
--   aa202ff5-… = Manuela (nutricionista)   28c3cfe8-… = Bryan (coach)
insert into public.capacidades_staff (usuario_id, capacidad)
select u.id, c.capacidad
  from public.usuarios_app u
 cross join (values ('revisar_creadores'), ('firmar_creadores')) as c(capacidad)
 where u.id in ('aa202ff5-74c1-4b76-9140-8ba44dc62f17', '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce')
on conflict do nothing;

-- Quién ve el tablero: el coach siempre, y quien tenga `revisar_creadores`.
create or replace function public.puede_ver_creadores()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_coach() or public.tiene_capacidad('revisar_creadores');
$$;
revoke all on function public.puede_ver_creadores() from public, anon;
grant execute on function public.puede_ver_creadores() to authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · CREADORES_CANDIDATOS — una fila por creador (estado vigente)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.creadores_candidatos (
  creador_id        text primary key check (creador_id ~ '^ig:[0-9]+$'),
  usuario_ig        text not null check (usuario_ig ~ '^[a-z0-9._]{1,30}$'),
  seguidores        integer check (seguidores >= 0),
  segmento          text not null default 'aliado'
                      check (segmento in ('aliado', 'entrenador', 'fuera')),
  carril            text not null check (carril in (
                      'descubierto', 'etapa1', 'etapa2', 'tambaleando',
                      'aprobado_contacto', 'mensaje_enviado', 'respondio', 'no_respondio',
                      'encuesta', 'microprueba', 'piloto', 'continua', 'pausa',
                      'descartado', 'entrenador')),
  -- Por qué está en ese carril, en frases cortas que un humano lee sin abrir nada
  -- (p. ej. ["C 1,8", "sin audio", "Astra NO / Claude límite"]).
  motivos           jsonb not null default '[]'::jsonb check (jsonb_typeof(motivos) = 'array'),
  nota_a            numeric(5,1),
  version_rubrica   text,
  -- Métricas de la etapa 1 tal como las deja el radar (sin tokens ni datos personales).
  metricas          jsonb not null default '{}'::jsonb check (jsonb_typeof(metricas) = 'object'),
  senal_colombia    boolean,
  -- Cuándo es el dato y cuándo llegó aquí: nunca el mismo campo (Q4 de Astra, 0083).
  fecha_dato        timestamptz not null,
  fecha_recepcion   timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);

comment on table public.creadores_candidatos is
  'Tablero de creadores (F1, 2026-09-28). Estado VIGENTE por creador; la historia está en '
  'creadores_eventos. La escribe solo service_role (importador de casa); el navegador lee '
  'con puede_ver_creadores().';

create index if not exists creadores_candidatos_por_carril
  on public.creadores_candidatos (carril, actualizado_en desc);

alter table public.creadores_candidatos enable row level security;
revoke all on public.creadores_candidatos from anon, authenticated, public;
grant select on public.creadores_candidatos to authenticated;
grant all on public.creadores_candidatos to service_role;

create policy creadores_candidatos_leer on public.creadores_candidatos
  for select to authenticated
  using ((select public.puede_ver_creadores()));

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · CREADORES_REVISIONES — notas de la etapa 2, inmutables
-- ────────────────────────────────────────────────────────────────────────────
-- Una fila por (revisión, revisor, reel). Una segunda vuelta es OTRA revision_id, nunca una
-- reescritura: así se ve qué dijo cada revisor y cuándo.
create table if not exists public.creadores_revisiones (
  id               uuid primary key default gen_random_uuid(),
  revision_id      text not null check (revision_id ~ '^[a-z0-9._-]{1,80}$'),
  creador_id       text not null references public.creadores_candidatos(creador_id) on delete cascade,
  revisor          text not null check (revisor in ('claude', 'astra', 'bryan', 'manuela')),
  rol_reel         text not null check (rol_reel ~ '^(reciente|aleatorio)_[0-9]$'),
  media_id         text not null check (media_id ~ '^[0-9]{1,30}$'),
  permalink        text check (permalink ~ '^https://www\.instagram\.com/(reel|p)/[A-Za-z0-9_-]+/?$'),
  -- {"H":2,"C":2,"P":2,"T":2,"CTA":0,"S":2} y las dimensiones nuevas de la rúbrica v3.
  -- null en una dimensión = pendiente (p. ej. el reel no cargó); nunca se inventa.
  notas            jsonb not null check (jsonb_typeof(notas) = 'object'),
  sin_audio        boolean not null default true,
  descripcion      text,
  -- Ruta dentro del bucket privado `creadores-cuadros` (no una URL).
  hoja_cuadros     text check (hoja_cuadros ~ '^[a-z0-9._/-]{1,200}$'),
  semilla          text,
  fecha_revision   timestamptz not null,
  fecha_recepcion  timestamptz not null default now(),
  unique (revision_id, revisor, rol_reel)
);

comment on table public.creadores_revisiones is
  'Notas de la etapa 2 por reel y revisor (F1, 2026-09-28). INMUTABLE: una vuelta nueva es '
  'otra revision_id. La escribe solo service_role.';

create index if not exists creadores_revisiones_por_creador
  on public.creadores_revisiones (creador_id, fecha_revision desc);

alter table public.creadores_revisiones enable row level security;
revoke all on public.creadores_revisiones from anon, authenticated, public;
grant select on public.creadores_revisiones to authenticated;
grant all on public.creadores_revisiones to service_role;

create policy creadores_revisiones_leer on public.creadores_revisiones
  for select to authenticated
  using ((select public.puede_ver_creadores()));

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · CREADORES_EVENTOS — historia del embudo
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.creadores_eventos (
  id               uuid primary key default gen_random_uuid(),
  -- Idempotencia: el importador reintenta con el mismo event_id y no duplica.
  event_id         text not null unique check (event_id ~ '^[a-z0-9:._-]{1,120}$'),
  creador_id       text not null references public.creadores_candidatos(creador_id) on delete cascade,
  carril_anterior  text,
  carril_nuevo     text not null,
  motivo           text,
  actor            text not null check (actor in ('radar', 'claude', 'astra', 'bryan', 'manuela', 'importador')),
  fecha_dato       timestamptz not null,
  fecha_recepcion  timestamptz not null default now()
);

comment on table public.creadores_eventos is
  'Historia del embudo de creadores (F1, 2026-09-28): una fila por movimiento de carril. '
  'La escribe solo service_role.';

create index if not exists creadores_eventos_por_creador
  on public.creadores_eventos (creador_id, fecha_dato desc);

alter table public.creadores_eventos enable row level security;
revoke all on public.creadores_eventos from anon, authenticated, public;
grant select on public.creadores_eventos to authenticated;
grant all on public.creadores_eventos to service_role;

create policy creadores_eventos_leer on public.creadores_eventos
  for select to authenticated
  using ((select public.puede_ver_creadores()));

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · BUCKET PRIVADO para las hojas de cuadros
-- ────────────────────────────────────────────────────────────────────────────
-- Solo (id, name, public), como la 0084: el CI no tiene `file_size_limit` ni
-- `allowed_mime_types` (la lección de la 0082). El límite de tamaño lo pone el importador.
insert into storage.buckets (id, name, public)
values ('creadores-cuadros', 'creadores-cuadros', false)
on conflict (id) do nothing;

drop policy if exists creadores_cuadros_leer on storage.objects;
create policy creadores_cuadros_leer on storage.objects
  for select to authenticated
  using (bucket_id = 'creadores-cuadros' and (select public.puede_ver_creadores()));
-- Sin políticas de insert/update/delete: sube solo service_role.

commit;
