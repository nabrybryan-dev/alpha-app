-- ============================================================================
-- 0096 · Buzón de mercadeo de Manuela (fase 3 de Administración)
-- ============================================================================
--
-- Respalda el «Tu buzón de mercadeo» de Estrategia y el «Buzón de mercadeo · Manuela» de
-- Administración (maqueta «Espacios de Alpha», 28-sep-2026) con el esquema de la habilidad
-- `mercadeo-manuela` (`esquema-propuesto.md` §1, §4 y CONTRATO.md), en su versión MÍNIMA:
--
--   · `mercadeo_preguntas`: la pregunta que le hace Claude a Manuela (la carga el servidor o
--     el coach), su respuesta y el ESTADO DE LA REGLA que salga de ahí
--     (`sin_regla` → `propuesta` → `vigente` → …).
--   · `mercadeo_referencias`: los enlaces (reel, carrusel, curso, artículo…) que Manuela deja
--     con su respuesta; solo `https://`, con una nota de lo observable.
--   · Manuela responde SOLO por `responder_buzon_mercadeo()` (con `responder_mercadeo`), una
--     vez por pregunta y antes de que venza; la regla la mueve SOLO el coach por
--     `mover_regla_mercadeo()`, y solo pasa a `vigente` con 3 referencias de reel, carrusel o
--     historia destacada distintas, con fecha de caducidad a 60 días (HM-03, HM-04, MF-01).
--
-- QUÉ NO ENTRA (sigue en la fase local de la habilidad): la cuarentena de respuestas, las
-- hipótesis y su conteo por cuentas, la bitácora `mercadeo_eventos`, la evidencia por regla y
-- `reglas_para_creadores()`. Hasta que haya portal del creador nada de esto sale a un creador.
--
-- NUNCA salud, medidas, asesorados ni contactos: la respuesta y las notas no admiten correos,
-- @ ni teléfonos (`mercadeo_sin_contactos`), y un curso se guarda como nombre y nota, nunca
-- el archivo.
--
-- SEGURIDAD: RLS en el mismo paso, `revoke all … from anon, authenticated, public` antes de
-- conceder nada, sin insert/update/delete para la API; funciones `security definer` con
-- `search_path` fijo y `revoke … from public, anon`.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · CAPACIDAD NUEVA: responder_mercadeo
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_nombre text;
  v_def    text;
  v_lista  text[];
begin
  select conname, pg_get_constraintdef(oid) into v_nombre, v_def
    from pg_constraint
   where conrelid = 'public.capacidades_staff'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%capacidad%'
   limit 1;
  if v_nombre is null then
    raise exception 'no se encontró el check de capacidades_staff: no se reescribe a ciegas';
  end if;
  -- La definición sale como ARRAY['a'::text, …] (cada nombre entre comillas) o, si alguien la
  -- reescribió con un literal, como '{a,b,…}'::text[]: se leen las dos formas.
  select array_agg(distinct x order by x) into v_lista
    from (
      select m[1] as x from regexp_matches(v_def, '''([a-z_]+)''', 'g') as t(m)
      union
      select regexp_split_to_table(substring(v_def from '''\{([a-z_,]+)\}'''), ',')
    ) s
   where x is not null;
  v_lista := array(select distinct x from unnest(v_lista || array['responder_mercadeo']) as x order by x);
  execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  -- `in (…)` con cada nombre citado: así la definición sigue en la forma que lee el bloque de arriba.
  execute format(
    'alter table public.capacidades_staff add constraint capacidades_staff_capacidad_check check (capacidad in (%s))',
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(v_lista) as x)
  );
end
$$;

-- Solo casa con filas reales (el CI arranca con la base vacía). aa202ff5-… = Manuela.
insert into public.capacidades_staff (usuario_id, capacidad)
select u.id, 'responder_mercadeo'
  from public.usuarios_app u
 where u.id = 'aa202ff5-74c1-4b76-9140-8ba44dc62f17'
on conflict do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · AYUDA PURA: sin correos, @ ni teléfonos
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.mercadeo_sin_contactos(p_texto text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_texto is null or not (
       p_texto ~ '@'
    or p_texto ~ '(^|[^0-9-])(\+?57[ -]?)?3[0-9]{2}[ -]?[0-9]{3}[ -]?[0-9]{4}([^0-9]|$)'
  );
$$;

create sequence if not exists public.mercadeo_reglas_codigo_seq;
revoke all on sequence public.mercadeo_reglas_codigo_seq from anon, authenticated, public;

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · MERCADEO_PREGUNTAS (pregunta + respuesta + estado de la regla)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.mercadeo_preguntas (
  id                     uuid primary key default gen_random_uuid(),
  codigo                 text not null unique check (codigo ~ '^[PS]-[0-9]{2}$'),
  texto                  text not null check (char_length(btrim(texto)) between 10 and 500),
  tema                   text not null check (tema in
                           ('gancho', 'corte', 'angulo', 'formato', 'brief', 'lectura_metricas')),
  -- `solo_contexto`: la respuesta explica, no genera regla.
  uso                    text not null default 'regla' check (uso in ('regla', 'solo_contexto')),
  destinataria_id        uuid not null references public.usuarios_app(id),
  enviada_en             timestamptz not null default now(),
  vence_en               date not null default (current_date + 7),
  estado                 text not null default 'pendiente'
                           check (estado in ('pendiente', 'respondida', 'caducada', 'descartada')),
  -- La respuesta de Manuela.
  respuesta              text check (char_length(btrim(respuesta)) between 1 and 2000
                                     and public.mercadeo_sin_contactos(respuesta)),
  respondida_por         uuid references public.usuarios_app(id),
  respondida_en          timestamptz,
  -- El estado de la regla que salga de la respuesta. `caducada` también se calcula al leer:
  -- una `vigente` pasada de `regla_revisar_antes_de` ya no vale.
  regla_estado           text not null default 'sin_regla'
                           check (regla_estado in
                             ('sin_regla', 'propuesta', 'vigente', 'suspendida', 'caducada', 'retirada', 'rechazada')),
  regla_codigo           text unique check (regla_codigo ~ '^R-[0-9]{2,}$'),
  regla_enunciado        text check (char_length(btrim(regla_enunciado)) between 5 and 240
                                     and position('@' in regla_enunciado) = 0),
  regla_aprobada_por     uuid references public.usuarios_app(id),
  regla_aprobada_en      timestamptz,
  regla_vigente_desde    date,
  regla_revisar_antes_de date,

  constraint mercadeo_respondida_con_respuesta
    check ((estado = 'respondida') = (respuesta is not null)),
  constraint mercadeo_respuesta_con_autora
    check (respuesta is null or (respondida_por is not null and respondida_en is not null)),
  constraint mercadeo_regla_solo_con_respuesta
    check (regla_estado = 'sin_regla'
           or (respuesta is not null and regla_codigo is not null and regla_enunciado is not null)),
  constraint mercadeo_contexto_no_es_regla
    check (uso = 'regla' or regla_estado = 'sin_regla'),
  -- MF-01: vigente exige firma con fecha y caducidad a 60 días.
  constraint mercadeo_vigente_firmada
    check (regla_estado <> 'vigente'
           or (regla_aprobada_por is not null and regla_aprobada_en is not null
               and regla_vigente_desde is not null
               and regla_revisar_antes_de = regla_vigente_desde + 60)),
  -- Quien contesta no aprueba su propia regla.
  constraint mercadeo_no_se_aprueba_sola
    check (regla_aprobada_por is null or regla_aprobada_por is distinct from respondida_por)
);

comment on table public.mercadeo_preguntas is
  'Buzón de mercadeo de Manuela (0096, 2026-09-28): pregunta, respuesta y estado de la regla. '
  'Responde solo responder_buzon_mercadeo(); la regla la mueve solo el coach. Sin salud ni contactos.';

create index if not exists mercadeo_preguntas_por_destinataria
  on public.mercadeo_preguntas (destinataria_id, estado, enviada_en desc);

alter table public.mercadeo_preguntas enable row level security;
revoke all on public.mercadeo_preguntas from anon, authenticated, public;
grant select on public.mercadeo_preguntas to authenticated;
grant all on public.mercadeo_preguntas to service_role;

-- Manuela lee las suyas; el coach, todas.
create policy mercadeo_preguntas_leer on public.mercadeo_preguntas
  for select to authenticated
  using (destinataria_id = (select auth.uid()) or (select public.es_coach()));

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · MERCADEO_REFERENCIAS (los enlaces que deja con su respuesta)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.mercadeo_referencias (
  id               uuid primary key default gen_random_uuid(),
  pregunta_id      uuid not null references public.mercadeo_preguntas(id) on delete cascade,
  -- Posición del enlace en la respuesta (1, 2, 3…).
  orden            integer not null check (orden >= 1),
  tipo             text not null check (tipo in
                     ('reel', 'carrusel', 'historia_destacada', 'curso', 'articulo', 'otro')),
  url              text not null check (url ~ '^https://[^[:space:]]+$' and char_length(url) <= 500),
  -- Sin `?…`, sin `#`, sin barra final, dominio en minúscula y sin `www.`: para no contar dos
  -- veces el mismo reel.
  url_normalizada  text not null check (char_length(url_normalizada) <= 500),
  -- Lo observable, con su segundo o lámina; un curso: nombre y módulo, nunca el material.
  nota             text not null check (char_length(btrim(nota)) between 5 and 280
                                        and public.mercadeo_sin_contactos(nota)),
  creada_en        timestamptz not null default now(),
  unique (pregunta_id, orden)
);

comment on table public.mercadeo_referencias is
  'Referencias de una respuesta del buzón de mercadeo (0096). Solo https, con nota observable. '
  'Escribe solo responder_buzon_mercadeo().';

create index if not exists mercadeo_referencias_por_pregunta on public.mercadeo_referencias (pregunta_id, orden);

alter table public.mercadeo_referencias enable row level security;
revoke all on public.mercadeo_referencias from anon, authenticated, public;
grant select on public.mercadeo_referencias to authenticated;
grant all on public.mercadeo_referencias to service_role;

-- Se ven las de las preguntas que se ven (la subconsulta pasa por la RLS de preguntas).
create policy mercadeo_referencias_leer on public.mercadeo_referencias
  for select to authenticated
  using (exists (select 1 from public.mercadeo_preguntas p where p.id = pregunta_id));

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · FUNCIONES
-- ────────────────────────────────────────────────────────────────────────────
-- RESPONDER: la destinataria (con `responder_mercadeo`), una vez, antes de `vence_en`.
-- `p_referencias`: arreglo JSON de {tipo, url, nota}, hasta 10.
create or replace function public.responder_buzon_mercadeo(
  p_pregunta_id uuid,
  p_texto       text,
  p_referencias jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo  uuid := auth.uid();
  q     public.mercadeo_preguntas%rowtype;
  r     jsonb;
  n     integer := 0;
  v_url text;
  v_norm text;
begin
  if v_yo is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  if not (public.tiene_capacidad('responder_mercadeo') or public.es_coach()) then
    raise exception 'no puedes responder el buzón de mercadeo' using errcode = '42501';
  end if;
  select * into q from public.mercadeo_preguntas where id = p_pregunta_id for update;
  if not found then
    raise exception 'esa pregunta no existe' using errcode = 'P0002';
  end if;
  if q.destinataria_id <> v_yo then
    raise exception 'esa pregunta no es tuya' using errcode = '42501';
  end if;
  if q.estado <> 'pendiente' then
    raise exception 'esa pregunta ya no espera respuesta (%)', q.estado using errcode = '23514';
  end if;
  if q.vence_en < current_date then
    raise exception 'esa pregunta caducó el %', q.vence_en using errcode = '23514';
  end if;
  if p_referencias is null or jsonb_typeof(p_referencias) <> 'array' then
    raise exception 'las referencias van en un arreglo' using errcode = '22023';
  end if;
  if jsonb_array_length(p_referencias) > 10 then
    raise exception 'máximo 10 referencias por respuesta' using errcode = '23514';
  end if;

  update public.mercadeo_preguntas
     set respuesta = btrim(coalesce(p_texto, '')), estado = 'respondida',
         respondida_por = v_yo, respondida_en = now()
   where id = p_pregunta_id;

  for r in select value from jsonb_array_elements(p_referencias) loop
    n := n + 1;
    v_url := btrim(coalesce(r->>'url', ''));
    -- https://www.Instagram.com/reel/AbC/?igsh=x  →  https://instagram.com/reel/AbC
    v_norm := regexp_replace(split_part(split_part(v_url, '#', 1), '?', 1), '/+$', '');
    v_norm := regexp_replace(v_norm, '^https://(www\.)?', '');
    v_norm := 'https://' || lower(split_part(v_norm, '/', 1)) || substr(v_norm, length(split_part(v_norm, '/', 1)) + 1);
    insert into public.mercadeo_referencias (pregunta_id, orden, tipo, url, url_normalizada, nota)
    values (p_pregunta_id, n, r->>'tipo', v_url, v_norm, btrim(coalesce(r->>'nota', '')));
  end loop;
end
$$;
revoke all on function public.responder_buzon_mercadeo(uuid, text, jsonb) from public, anon;
grant execute on function public.responder_buzon_mercadeo(uuid, text, jsonb) to authenticated, service_role;

-- MOVER LA REGLA: solo el coach. `vigente` exige 3 referencias de reel, carrusel o historia
-- destacada con enlaces distintos y `uso = 'regla'`; fija firma, fecha y caducidad a 60 días.
create or replace function public.mover_regla_mercadeo(
  p_id        uuid,
  p_estado    text,
  p_enunciado text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  q    public.mercadeo_preguntas%rowtype;
  v_n  integer;
  v_enunciado text;
begin
  if v_yo is null or not public.es_coach() then
    raise exception 'la regla la mueve solo el coach' using errcode = '42501';
  end if;
  if p_estado not in ('propuesta', 'vigente', 'suspendida', 'retirada', 'rechazada') then
    raise exception 'estado de regla no válido: %', p_estado using errcode = '23514';
  end if;
  select * into q from public.mercadeo_preguntas where id = p_id for update;
  if not found then
    raise exception 'esa pregunta no existe' using errcode = 'P0002';
  end if;
  if q.respuesta is null then
    raise exception 'sin respuesta no hay regla' using errcode = '23514';
  end if;
  if q.uso <> 'regla' then
    raise exception 'esa pregunta es solo de contexto: no genera regla' using errcode = '23514';
  end if;
  if q.regla_estado in ('retirada', 'rechazada') then
    raise exception 'una regla % no vuelve: se propone otra', q.regla_estado using errcode = '23514';
  end if;
  if q.regla_estado = 'sin_regla' and p_estado not in ('propuesta', 'vigente', 'rechazada') then
    raise exception 'una pregunta sin regla solo pasa a propuesta, vigente o rechazada' using errcode = '23514';
  end if;
  v_enunciado := coalesce(nullif(btrim(coalesce(p_enunciado, '')), ''), q.regla_enunciado);
  if v_enunciado is null then
    raise exception 'la regla necesita su enunciado' using errcode = '23514';
  end if;

  if p_estado = 'vigente' then
    select count(distinct url_normalizada) into v_n
      from public.mercadeo_referencias
     where pregunta_id = p_id and tipo in ('reel', 'carrusel', 'historia_destacada');
    if v_n < 3 then
      raise exception 'una regla vigente pide 3 referencias distintas (hay %)', v_n using errcode = '23514';
    end if;
    update public.mercadeo_preguntas
       set regla_estado = 'vigente', regla_enunciado = v_enunciado,
           regla_codigo = coalesce(regla_codigo, 'R-' || lpad(nextval('public.mercadeo_reglas_codigo_seq')::text, 2, '0')),
           regla_aprobada_por = v_yo, regla_aprobada_en = now(),
           regla_vigente_desde = current_date, regla_revisar_antes_de = current_date + 60
     where id = p_id;
  else
    update public.mercadeo_preguntas
       set regla_estado = p_estado, regla_enunciado = v_enunciado,
           regla_codigo = coalesce(regla_codigo, 'R-' || lpad(nextval('public.mercadeo_reglas_codigo_seq')::text, 2, '0'))
     where id = p_id;
  end if;
end
$$;
revoke all on function public.mover_regla_mercadeo(uuid, text, text) from public, anon;
grant execute on function public.mover_regla_mercadeo(uuid, text, text) to authenticated, service_role;

commit;
