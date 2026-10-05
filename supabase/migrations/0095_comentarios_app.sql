-- ============================================================================
-- 0095 · Comentarios de la app (algo falla · una idea · no entiendo)
-- ============================================================================
--
-- Respalda el buzón «Tus comentarios sobre la app» de Mi entreno (maqueta «Espacios de
-- Alpha», 28-sep-2026) con el esquema de la habilidad `comentarios-app`
-- (`esquema-propuesto.md` §1, §4 y §5), en su versión MÍNIMA:
--
--   · UNA tabla, `comentarios_app`, con estado `nuevo` → `en_contrato` → `arreglado` y quién
--     cierra. Los grupos, los vínculos con `errores_navegador` y el triaje fino (duplicado,
--     derivado, rechazado, tardío…) quedan para cuando se implemente el resto del contrato
--     (CA7): aquí no se inventan.
--   · Quien escribe (asesorado, equipo o coach) inserta SOLO por `enviar_comentario()`: la
--     función pone el autor (auth.uid()), calcula el rol, tapa correos y teléfonos, acota el
--     largo y limita a 10 por persona y día.
--   · Quien comentó ve SOLO los suyos, y solo lo público (id, fecha, tipo, pantalla, texto,
--     estado), por la vista `mis_comentarios`. El coach y quien tenga `triar_comentarios` leen
--     todo y mueven el estado con `mover_comentario()`; CERRAR (`arreglado`) es solo del coach.
--
-- NUNCA DATOS DE SALUD. No hay campo de imagen (una captura de la app casi siempre trae datos
-- de la persona), la pantalla es solo `location.pathname` (sin `?` ni `#`), el texto tiene un
-- tope de 500 caracteres y la pantalla del asesorado avisa, antes del botón, que esto no es
-- para salud ni urgencias. El texto crudo puede borrarse con `purgar_texto_comentarios()`.
--
-- SEGURIDAD: RLS en el mismo paso, `revoke all … from anon, authenticated, public` antes de
-- conceder nada, sin insert/update/delete para la API; cada función `security definer` con
-- `search_path` fijo y `revoke … from public, anon`.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · CAPACIDAD NUEVA: triar_comentarios
-- ────────────────────────────────────────────────────────────────────────────
-- Se lee la lista VIGENTE del check compartido (DC4) y se reescribe entera + la nueva.
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
  v_lista := array(select distinct x from unnest(v_lista || array['triar_comentarios']) as x order by x);
  execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  -- `in (…)` con cada nombre citado: así la definición sigue en la forma que lee el bloque de arriba.
  execute format(
    'alter table public.capacidades_staff add constraint capacidades_staff_capacidad_check check (capacidad in (%s))',
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(v_lista) as x)
  );
end
$$;
-- Nadie la recibe por defecto: el coach ya puede triar por ser coach.

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · COMENTARIOS_APP
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.comentarios_app (
  id             bigint generated always as identity primary key,
  usuario_id     uuid not null default auth.uid() references public.usuarios_app(id) on delete cascade,
  creado_en      timestamptz not null default now(),
  rol_autor      text not null check (rol_autor in ('asesorado', 'equipo', 'coach')),
  tipo           text not null check (tipo in ('falla', 'idea', 'no_entiendo')),
  -- Solo `location.pathname`: sin query, sin fragmento.
  pantalla       text not null default 'desconocida'
                   check (char_length(pantalla) <= 200
                          and (pantalla = 'desconocida' or pantalla ~ '^/[A-Za-z0-9/_.:-]*$')),
  -- Crudo, con correos y teléfonos ya tapados. Se pone a null al purgar.
  texto          text check (char_length(texto) between 1 and 500),
  texto_saneado  text check (char_length(texto_saneado) between 1 and 500),
  version        text check (char_length(version) <= 64),
  estado         text not null default 'nuevo' check (estado in ('nuevo', 'en_contrato', 'arreglado')),
  contrato_id    text check (contrato_id ~ '^CT-[0-9]{8}-[0-9]+$'),
  triado_por     uuid references public.usuarios_app(id),
  triado_en      timestamptz,
  -- Quién cierra: solo el coach.
  cerrado_por    uuid references public.usuarios_app(id),
  cerrado_en     timestamptz,

  constraint comentarios_contrato_desde_en_contrato
    check (estado = 'nuevo' or contrato_id is not null),
  constraint comentarios_arreglado_con_cierre
    check (estado <> 'arreglado' or (cerrado_por is not null and cerrado_en is not null))
);

comment on table public.comentarios_app is
  'Comentarios de la app (0095, 2026-09-28): falla / idea / no entiendo, con su pantalla. '
  'Inserta solo enviar_comentario(); estado lo mueve solo mover_comentario(); cierra el coach. '
  'Sin datos de salud ni imágenes.';

create index if not exists comentarios_app_por_fecha on public.comentarios_app (creado_en desc);
create index if not exists comentarios_app_por_usuario on public.comentarios_app (usuario_id, creado_en desc);
create index if not exists comentarios_app_nuevos on public.comentarios_app (creado_en) where estado = 'nuevo';

alter table public.comentarios_app enable row level security;
revoke all on public.comentarios_app from anon, authenticated, public;
grant select on public.comentarios_app to authenticated;
grant all on public.comentarios_app to service_role;

-- La tabla la leen el coach y quien tría. Quien comentó lee lo suyo por la vista de abajo, para
-- que no vea los campos internos del triaje.
create policy comentarios_app_leer_equipo on public.comentarios_app
  for select to authenticated
  using ((select public.es_coach()) or (select public.tiene_capacidad('triar_comentarios')));

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · LO QUE VE QUIEN COMENTÓ
-- ────────────────────────────────────────────────────────────────────────────
-- Vista con los privilegios de su dueño y filtrada por auth.uid(): cada persona ve SOLO lo
-- suyo y solo lo público. Nunca contrato_id, quién trió ni el texto saneado.
drop view if exists public.mis_comentarios;
create view public.mis_comentarios as
select c.id, c.creado_en, c.tipo, c.pantalla, c.texto, c.estado
  from public.comentarios_app c
 where c.usuario_id = auth.uid();

revoke all on public.mis_comentarios from anon, authenticated, public;
grant select on public.mis_comentarios to authenticated;
grant all on public.mis_comentarios to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · FUNCIONES
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.enviar_comentario(
  p_tipo     text,
  p_pantalla text,
  p_texto    text,
  p_version  text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo       uuid := auth.uid();
  v_rol      text;
  v_pantalla text;
  v_texto    text;
  v_id       bigint;
begin
  if v_yo is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  if not exists (select 1 from public.usuarios_app where id = v_yo) then
    raise exception 'sin perfil' using errcode = '42501';
  end if;
  -- Tope por persona y día, para que un bucle no inunde la bandeja.
  if (select count(*) from public.comentarios_app
       where usuario_id = v_yo and creado_en > now() - interval '1 day') >= 10 then
    raise exception 'ya enviaste 10 comentarios hoy; mañana puedes seguir' using errcode = 'P0001';
  end if;

  v_rol := case
    when public.es_coach() then 'coach'
    when exists (select 1 from public.capacidades_staff where usuario_id = v_yo)
      or exists (select 1 from public.usuarios_app where id = v_yo and rol = 'nutricionista') then 'equipo'
    else 'asesorado'
  end;

  -- Solo la ruta: sin `?` ni `#`. Lo que no parece una ruta se guarda como «desconocida».
  v_pantalla := left(split_part(split_part(coalesce(p_pantalla, ''), '?', 1), '#', 1), 200);
  if v_pantalla !~ '^/[A-Za-z0-9/_.:-]*$' then
    v_pantalla := 'desconocida';
  end if;

  -- Correos y móviles colombianos, tapados antes de guardar; tope de 500.
  v_texto := btrim(coalesce(p_texto, ''));
  v_texto := regexp_replace(v_texto, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[correo]', 'g');
  v_texto := regexp_replace(v_texto, '(\+?57[ -]?)?3[0-9]{2}[ -]?[0-9]{3}[ -]?[0-9]{4}', '[teléfono]', 'g');
  v_texto := left(v_texto, 500);
  if v_texto = '' then
    raise exception 'el comentario está vacío' using errcode = '23514';
  end if;

  insert into public.comentarios_app (usuario_id, rol_autor, tipo, pantalla, texto, version)
  values (v_yo, v_rol, p_tipo, v_pantalla, v_texto, left(p_version, 64))
  returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.enviar_comentario(text, text, text, text) from public, anon;
grant execute on function public.enviar_comentario(text, text, text, text) to authenticated, service_role;

-- MOVER EL ESTADO. Triar (nuevo → en_contrato, con su contrato) lo hace el coach o quien tenga
-- `triar_comentarios`; CERRAR (en_contrato → arreglado) solo el coach. Un arreglado no vuelve.
create or replace function public.mover_comentario(
  p_id            bigint,
  p_estado        text,
  p_contrato_id   text default null,
  p_texto_saneado text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo    uuid := auth.uid();
  v_coach boolean;
  c       public.comentarios_app%rowtype;
begin
  if v_yo is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  v_coach := public.es_coach();
  if not (v_coach or public.tiene_capacidad('triar_comentarios')) then
    raise exception 'no puedes triar comentarios' using errcode = '42501';
  end if;
  select * into c from public.comentarios_app where id = p_id for update;
  if not found then
    raise exception 'ese comentario no existe' using errcode = 'P0002';
  end if;

  if p_estado = 'en_contrato' then
    if c.estado <> 'nuevo' then
      raise exception 'solo un comentario nuevo pasa a contrato' using errcode = '23514';
    end if;
    if p_contrato_id is null then
      raise exception 'pasar a contrato pide el número del contrato' using errcode = '23514';
    end if;
    update public.comentarios_app
       set estado = 'en_contrato', contrato_id = p_contrato_id, triado_por = v_yo, triado_en = now(),
           texto_saneado = coalesce(nullif(btrim(coalesce(p_texto_saneado, '')), ''), texto_saneado)
     where id = p_id;
  elsif p_estado = 'arreglado' then
    if not v_coach then
      raise exception 'cerrar un comentario es solo del coach' using errcode = '42501';
    end if;
    if c.estado <> 'en_contrato' then
      raise exception 'solo un comentario en contrato se da por arreglado' using errcode = '23514';
    end if;
    update public.comentarios_app
       set estado = 'arreglado', cerrado_por = v_yo, cerrado_en = now()
     where id = p_id;
  else
    raise exception 'estado no válido: %', p_estado using errcode = '23514';
  end if;
end
$$;
revoke all on function public.mover_comentario(bigint, text, text, text) from public, anon;
grant execute on function public.mover_comentario(bigint, text, text, text) to authenticated, service_role;

-- PURGA del texto crudo (lo programa quien lleve la base, con service_role). No hay una
-- política de días decidida todavía (H-04): quien la llame elige cuántos.
create or replace function public.purgar_texto_comentarios(p_dias integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'authenticated'
     or auth.uid() is not null then
    raise exception 'solo el servidor purga' using errcode = '42501';
  end if;
  if p_dias is null or p_dias < 1 then
    raise exception 'la purga pide un número de días positivo' using errcode = '22023';
  end if;
  update public.comentarios_app
     set texto = null
   where texto is not null and creado_en < now() - make_interval(days => p_dias);
  get diagnostics v_n = row_count;
  return v_n;
end
$$;
revoke all on function public.purgar_texto_comentarios(integer) from public, anon, authenticated;
grant execute on function public.purgar_texto_comentarios(integer) to service_role;

commit;
