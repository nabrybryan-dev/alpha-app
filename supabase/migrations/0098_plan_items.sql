-- ============================================================================
-- 0098 · Organizador de Bryan y Manuela: plan_items (objetivo -> hito -> tarea)
-- ============================================================================
--
-- Respalda la pantalla «Mi plan» (Hoy / Semana / 90 días) según
-- bola-de-nieve/organizador/ESPEC-ORGANIZADOR.md (30-sep-2026, H-A22d): el plan estratégico baja
-- en cascada a UNA tabla, con dueño por fila.
--
--   · objetivo (90 días) <- hito (semana, 2-3) <- tarea (día: 1 principal + 2 pequeñas, <= 50 min).
--   · Cada quien ve y edita lo SUYO. Bryan (coach) además LEE lo de Manuela para no sobrecargarla.
--   · Sin datos de salud: la tabla guarda títulos y pasos de trabajo, nunca datos de asesorados.
--
-- DUEÑO. `bryan` = quien es coach; `manuela` = quien tiene la capacidad nueva `organizar_plan`
-- sin ser coach (`plan_dueno_actual()`). El dueño de una fila no se cambia después de crearla.
--
-- ESCRITURA. A diferencia de las tablas de la fase 3 (que escriben solo funciones), aquí el
-- navegador escribe directo —empezar, marcar hecha y mover son toques diarios—, pero acotado:
-- `insert`/`update` con políticas por dueño, `update` solo sobre columnas de trabajo (no nivel,
-- padre, dueño ni origen) y SIN `delete` (descartar es un estado, no un borrado).
--
-- REGLAS EN LA BASE (no solo en la pantalla): un hito cuelga de un objetivo y una tarea de un
-- hito; máximo 3 tareas activas por dueño y día; 1 sola principal por dueño y día (índice
-- único parcial); tarea de 50 min como mucho.
--
-- SEGURIDAD, la regla de siempre: RLS en el mismo paso y `revoke all … from anon, authenticated,
-- public` antes de conceder nada; funciones `security definer` con `search_path` fijo.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · CAPACIDAD NUEVA: organizar_plan
-- ────────────────────────────────────────────────────────────────────────────
-- Un solo check compartido: se lee la lista VIGENTE de la base y se reescribe entera + la nueva.
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
  select array_agg(distinct x order by x) into v_lista
    from (
      select m[1] as x from regexp_matches(v_def, '''([a-z_]+)''', 'g') as t(m)
      union
      select regexp_split_to_table(substring(v_def from '''\{([a-z_,]+)\}'''), ',')
    ) s
   where x is not null;
  v_lista := array(select distinct x from unnest(v_lista || array['organizar_plan']) as x order by x);
  execute format('alter table public.capacidades_staff drop constraint %I', v_nombre);
  execute format(
    'alter table public.capacidades_staff add constraint capacidades_staff_capacidad_check check (capacidad in (%s))',
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(v_lista) as x)
  );
end
$$;

-- Solo casa con filas reales (el CI arranca con la base vacía).
--   aa202ff5-… = Manuela (nutricionista)   28c3cfe8-… = Bryan (coach)
insert into public.capacidades_staff (usuario_id, capacidad)
select u.id, 'organizar_plan'
  from public.usuarios_app u
 where u.id in ('aa202ff5-74c1-4b76-9140-8ba44dc62f17', '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce')
on conflict do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · QUIÉN ES QUIÉN
-- ────────────────────────────────────────────────────────────────────────────
-- 'bryan' si quien llama es coach; 'manuela' si tiene `organizar_plan` sin ser coach; si no, nulo.
create or replace function public.plan_dueno_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.es_coach() then 'bryan'
    when public.tiene_capacidad('organizar_plan') then 'manuela'
    else null
  end;
$$;
revoke all on function public.plan_dueno_actual() from public, anon;
grant execute on function public.plan_dueno_actual() to authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · PLAN_ITEMS
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.plan_items (
  id             uuid primary key default gen_random_uuid(),
  nivel          text not null check (nivel in ('objetivo', 'hito', 'tarea')),
  padre_id       uuid references public.plan_items(id) on delete restrict,
  titulo         text not null check (char_length(btrim(titulo)) between 1 and 160),
  -- El primer paso FÍSICO («abrir el tablero y filtrar etapa2»), no un verbo vago.
  primer_paso    text check (char_length(btrim(primer_paso)) between 1 and 240),
  dueno          text not null check (dueno in ('bryan', 'manuela')),
  palanca        text check (palanca in ('A', 'B', 'C', 'D', 'otro')),
  -- tarea: el día; hito: el lunes de la semana; objetivo: la fecha límite. Una tarea sin día
  -- está en «después».
  fecha          date,
  estimado_min   int check (estimado_min between 1 and 480),
  prioridad      text check (prioridad in ('principal', 'pequena')),
  estado         text not null default 'pendiente'
                   check (estado in ('pendiente', 'en_curso', 'hecha', 'movida', 'descartada')),
  iniciada_en    timestamptz,
  hecha_en       timestamptz,
  veces_movida   int not null default 0 check (veces_movida >= 0),
  -- Archivo o regla que la generó (importador del agente); texto de trabajo, no de salud.
  origen         text check (char_length(origen) between 1 and 200),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint plan_items_padre_por_nivel
    check ((nivel = 'objetivo' and padre_id is null) or (nivel in ('hito', 'tarea') and padre_id is not null)),
  -- Solo las tareas llevan prioridad y la tarea cabe en un bloque de 50 min.
  constraint plan_items_prioridad_solo_tarea
    check (prioridad is null or nivel = 'tarea'),
  constraint plan_items_tarea_hasta_50
    check (nivel <> 'tarea' or estimado_min is null or estimado_min <= 50),
  constraint plan_items_hecha_con_hora
    check ((estado = 'hecha') = (hecha_en is not null))
);

comment on table public.plan_items is
  'Organizador de Bryan y Manuela (0098, 2026-09-30): objetivo (90 días) -> hito (semana) -> tarea '
  '(día). Dueño por fila; cada quien edita lo suyo; el coach lee todo. Sin datos de salud; sin delete.';

create index if not exists plan_items_por_dueno_fecha on public.plan_items (dueno, fecha);
create index if not exists plan_items_por_padre on public.plan_items (padre_id);

-- 1 sola tarea PRINCIPAL viva por dueño y día.
create unique index if not exists plan_items_una_principal_por_dia
  on public.plan_items (dueno, fecha)
  where nivel = 'tarea' and prioridad = 'principal' and fecha is not null
    and estado in ('pendiente', 'en_curso', 'hecha');

-- Reglas que miran OTRA fila: el nivel del padre y el tope de 3 tareas por día.
create or replace function public.plan_items_valida()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_nivel_padre text;
  v_otras int;
begin
  new.actualizado_en := now();
  if new.padre_id is not null then
    select nivel into v_nivel_padre from public.plan_items where id = new.padre_id;
    if v_nivel_padre is null then
      raise exception 'el padre % no existe o no es visible', new.padre_id using errcode = '23503';
    end if;
    if (new.nivel = 'hito' and v_nivel_padre <> 'objetivo') or (new.nivel = 'tarea' and v_nivel_padre <> 'hito') then
      raise exception 'un % no puede colgar de un %', new.nivel, v_nivel_padre using errcode = '23514';
    end if;
  end if;
  if new.nivel = 'tarea' and new.fecha is not null and new.estado in ('pendiente', 'en_curso', 'hecha') then
    select count(*) into v_otras
      from public.plan_items t
     where t.nivel = 'tarea' and t.dueno = new.dueno and t.fecha = new.fecha
       and t.estado in ('pendiente', 'en_curso', 'hecha')
       and t.id <> new.id;
    if v_otras >= 3 then
      raise exception 'máximo 3 tareas por día: lo que no cabe va a «después»' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;
revoke all on function public.plan_items_valida() from public, anon;

drop trigger if exists plan_items_valida on public.plan_items;
create trigger plan_items_valida
  before insert or update on public.plan_items
  for each row execute function public.plan_items_valida();

alter table public.plan_items enable row level security;
-- Sin este revoke, un UPDATE sin política «pasa» sobre cero filas (lección de la 0084).
revoke all on public.plan_items from anon, authenticated, public;
grant select on public.plan_items to authenticated;
grant insert (nivel, padre_id, titulo, primer_paso, dueno, palanca, fecha, estimado_min, prioridad, estado,
              iniciada_en, hecha_en, veces_movida, origen)
  on public.plan_items to authenticated;
grant update (titulo, primer_paso, palanca, fecha, estimado_min, prioridad, estado, iniciada_en, hecha_en,
              veces_movida)
  on public.plan_items to authenticated;
grant all on public.plan_items to service_role;

-- Lee: el coach todo; quien tiene la capacidad, lo suyo.
create policy plan_items_leer on public.plan_items
  for select to authenticated
  using ((select public.es_coach())
         or ((select public.tiene_capacidad('organizar_plan')) and dueno = (select public.plan_dueno_actual())));

-- Escribe: cada dueño, solo lo suyo (el coach no escribe filas de Manuela ni al revés).
create policy plan_items_crear on public.plan_items
  for insert to authenticated
  with check (dueno = (select public.plan_dueno_actual()));

create policy plan_items_editar on public.plan_items
  for update to authenticated
  using (dueno = (select public.plan_dueno_actual()))
  with check (dueno = (select public.plan_dueno_actual()));
-- Sin política de delete (y sin privilegio): descartar es un estado.

commit;
