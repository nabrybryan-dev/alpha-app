-- 0014 · Catálogo de alimentos para el registro de comidas
--
-- Tres tablas: el alimento, sus medidas caseras, y la receta que explica de qué
-- se compone un plato estimado.
--
-- ATRIBUCIÓN OBLIGATORIA de los datos del ICBF, autorizada para este uso:
--   "Datos de composición nutricional tomados de la Tabla de Composición de
--    Alimentos Colombianos (TCAC 2018), Instituto Colombiano de Bienestar
--    Familiar - ICBF."
-- Los datos de USDA FoodData Central son de dominio público (CC0).
--
-- NO APLICADA a producción. Se aplica junto con la pantalla de registro.

-- Búsqueda tolerante a errores de tecleo y a tildes. Trigramas y no búsqueda de
-- texto completo porque el asesorado escribe en un teléfono: "frijl" tiene que
-- llevar a "fríjol".
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ── Alimento ────────────────────────────────────────────────────────────────
create table if not exists public.alimentos (
  id          text primary key,
  nombre      text not null,
  sinonimos   text not null default '',
  grupo       text not null,
  -- `estado` es la defensa contra un error de 1,5x a 5x: 100 g de arroz crudo
  -- no son 100 g de arroz cocido. Por eso NO admite nulo.
  estado      text not null
              check (estado in ('crudo','cocido','seco','en_lata','listo','preparado')),
  confianza   text not null
              check (confianza in ('verificado','estimado','declarado')),
  origen      text not null
              check (origen in ('tcac','usda','etiqueta','receta','asesorado')),
  origen_id   text,
  -- Los 14 nutrientes por 100 g. Un nutriente ausente va como null, NUNCA como
  -- cero: cero es una medición, ausente es un hueco.
  por_100g    jsonb not null,
  creado_por  uuid references public.usuarios_app (id) on delete cascade,
  creado_en   timestamptz not null default now(),

  -- Nadie se autopromociona: lo que crea un asesorado no nace verificado.
  constraint alimentos_verificado_sin_autor
    check (confianza <> 'verificado' or creado_por is null),
  -- Un alimento del catálogo no tiene autor; uno declarado sí.
  constraint alimentos_declarado_con_autor
    check (confianza <> 'declarado' or creado_por is not null),
  -- Un verificado tiene que traer energía; lo demás puede venir incompleto.
  constraint alimentos_verificado_con_kcal
    check (confianza <> 'verificado' or (por_100g -> 'kcal') is not null)
);

create index if not exists alimentos_grupo on public.alimentos (grupo);
create index if not exists alimentos_autor on public.alimentos (creado_por);

-- Índice de trigramas sobre nombre + sinónimos, sin tildes.
create index if not exists alimentos_busqueda on public.alimentos
  using gin (extensions.unaccent(nombre || ' ' || sinonimos) extensions.gin_trgm_ops);

-- ── Medidas caseras ─────────────────────────────────────────────────────────
-- Opcionales a propósito: la carne se pesa. No existe medida casera natural para
-- 150 g de lomo, y los menús del coach ya la prescriben en gramos.
create table if not exists public.alimento_medidas (
  id           bigserial primary key,
  alimento_id  text not null references public.alimentos (id) on delete cascade,
  nombre       text not null,
  gramos       real not null check (gramos > 0),
  fuente       text not null check (fuente in ('usda','tcac','estimada','receta','asesorado')),
  unique (alimento_id, nombre)
);

create index if not exists medidas_por_alimento on public.alimento_medidas (alimento_id);

-- ── Receta ──────────────────────────────────────────────────────────────────
-- Hace auditable un alimento `estimado`. Sin esto, un sancocho sería un número
-- caído del cielo; con esto, cualquiera puede abrirlo y ver que asumió 150 g de
-- yuca, y corregirlo.
create table if not exists public.alimento_recetas (
  id              bigserial primary key,
  alimento_id     text not null references public.alimentos (id) on delete cascade,
  ingrediente_id  text references public.alimentos (id) on delete restrict,
  que_es          text not null,
  gramos          real not null check (gramos > 0),
  unique (alimento_id, que_es)
);

create index if not exists recetas_por_alimento on public.alimento_recetas (alimento_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.alimentos enable row level security;
alter table public.alimento_medidas enable row level security;
alter table public.alimento_recetas enable row level security;

-- El catálogo (sin autor) lo lee cualquier usuario autenticado.
-- Un alimento que añadió un asesorado lo ven solo él y el staff.
create policy alimentos_leer on public.alimentos
  for select using (
    creado_por is null
    or creado_por = auth.uid()
    or public.es_staff()
  );

-- Un asesorado puede añadir alimentos, siempre a su nombre y nunca verificados.
create policy alimentos_crear_propio on public.alimentos
  for insert with check (
    creado_por = auth.uid() and confianza = 'declarado'
  );

create policy alimentos_editar_propio on public.alimentos
  for update using (creado_por = auth.uid())
  with check (creado_por = auth.uid() and confianza = 'declarado');

create policy alimentos_borrar_propio on public.alimentos
  for delete using (creado_por = auth.uid());

-- El coach mantiene el catálogo.
create policy alimentos_coach on public.alimentos
  for all using (public.es_coach()) with check (public.es_coach());

-- Medidas y recetas siguen la visibilidad de su alimento.
create policy medidas_leer on public.alimento_medidas
  for select using (
    exists (
      select 1 from public.alimentos a
      where a.id = alimento_id
        and (a.creado_por is null or a.creado_por = auth.uid() or public.es_staff())
    )
  );

create policy medidas_coach on public.alimento_medidas
  for all using (public.es_coach()) with check (public.es_coach());

create policy recetas_leer on public.alimento_recetas
  for select using (
    exists (
      select 1 from public.alimentos a
      where a.id = alimento_id
        and (a.creado_por is null or a.creado_por = auth.uid() or public.es_staff())
    )
  );

create policy recetas_coach on public.alimento_recetas
  for all using (public.es_coach()) with check (public.es_coach());

-- Supabase concede execute a anon por defecto en objetos nuevos: se revoca
-- explícitamente. Este patrón ya mordió antes en este proyecto.
revoke all on public.alimentos from anon;
revoke all on public.alimento_medidas from anon;
revoke all on public.alimento_recetas from anon;

-- ── Búsqueda ────────────────────────────────────────────────────────────────
-- Ordena por lo probable: primero lo verificado, luego lo propio, luego el resto.
create or replace function public.buscar_alimento(consulta text, tope int default 20)
returns table (
  id         text,
  nombre     text,
  grupo      text,
  estado     text,
  confianza  text,
  por_100g   jsonb,
  parecido   real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select a.id, a.nombre, a.grupo, a.estado, a.confianza, a.por_100g,
         similarity(unaccent(a.nombre || ' ' || a.sinonimos), unaccent(consulta)) as parecido
  from public.alimentos a
  where unaccent(a.nombre || ' ' || a.sinonimos) % unaccent(consulta)
     or unaccent(a.nombre) ilike '%' || unaccent(consulta) || '%'
  order by
    case a.confianza when 'verificado' then 0 when 'estimado' then 1 else 2 end,
    case when a.creado_por = auth.uid() then 0 else 1 end,
    parecido desc,
    length(a.nombre)
  limit tope;
$$;

revoke execute on function public.buscar_alimento(text, int) from anon;
