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
-- APLICADA a producción el 2026-07-30, junto con la carga de los 1.195 alimentos.
-- Al aplicarla salió a la luz un fallo que llevaba latente desde que se escribió:
-- el índice de trigramas usaba `unaccent()`, que es STABLE, y Postgres rechaza una
-- función STABLE en la expresión de un índice (42P17). Ver `sin_tildes` más abajo.

-- Búsqueda tolerante a errores de tecleo y a tildes. Trigramas y no búsqueda de
-- texto completo porque el asesorado escribe en un teléfono: "frijl" tiene que
-- llevar a "fríjol".
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- `unaccent(text)` es STABLE, no IMMUTABLE, porque depende del diccionario de
-- búsqueda que esté configurado. Postgres rechaza una función STABLE dentro de la
-- expresión de un índice:
--
--   ERROR 42P17: functions in index expression must be marked IMMUTABLE
--
-- La forma correcta de resolverlo es fijar el diccionario explícitamente con la
-- variante de dos argumentos: con el diccionario clavado, el resultado sí es
-- determinista y la función puede declararse IMMUTABLE con verdad.
--
-- El índice y `buscar_alimento()` TIENEN QUE USAR ESTA MISMA FUNCIÓN. Si una usa
-- `sin_tildes` y la otra `unaccent`, el índice existe pero el planificador no lo
-- usa nunca, y la búsqueda del asesorado se convierte en un recorrido completo de
-- la tabla sin que nada falle de forma visible.
create or replace function public.sin_tildes(texto text)
returns text
language sql
immutable
parallel safe
strict
set search_path = extensions, public
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, texto) $$;

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
  using gin (public.sin_tildes(nombre || ' ' || sinonimos) extensions.gin_trgm_ops);

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
--
-- POR QUÉ `word_similarity` Y NO `similarity`. El operador `%` compara la consulta
-- contra el nombre ENTERO, así que una palabra suelta se diluye en un nombre largo
-- y nunca pasa el umbral. Medido contra este catálogo: "frijl" saca 0,09-0,18 de
-- `similarity` frente a los fríjoles —por debajo del 0,3 de `%`— y devolvía CERO
-- resultados, justo el caso que esta migración dice resolver.
--
-- `word_similarity` compara la consulta contra la palabra más parecida del nombre
-- en vez de contra todo el texto. Los mismos fríjoles pasan a 0,667.
--
-- POR QUÉ EL UMBRAL VA ESCRITO Y NO COMO OPERADOR `<%`. El operador lee el umbral
-- de `pg_trgm.word_similarity_threshold`, y el rol de Supabase **no tiene permiso
-- para fijarlo** (42501): quedaría heredando el 0,6 del servidor, que deja "frijl"
-- a cuatro centésimas de fallar y tumba un error de tecleo un poco peor. Con la
-- comparación escrita el umbral es explícito y no depende de la configuración.
--
-- Coste: la comparación escrita no usa el índice de trigramas, así que este brazo
-- recorre la tabla. Con ~1.200 alimentos es del orden de milisegundos, y el índice
-- sigue sirviendo al brazo `ilike`. Si el catálogo creciera un orden de magnitud,
-- toca revisarlo.
--
-- DE DÓNDE SALE EL 0,40, medido contra este catálogo:
--   "frijl"        -> 0,667  (falta una letra)
--   "pechuga polo" -> 0,833  (dos palabras, una mal escrita)
--   "frjol"        -> 0,44   (falta la i)
-- El 0,44 de "frjol" es el que manda: con umbral 0,45 ese error devolvía cero
-- resultados mientras "frijl" sí funcionaba, distinción que no significa nada para
-- quien escribe en un teléfono. Bajar a 0,40 lo cubre sin abrir la mano de más.
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
         word_similarity(public.sin_tildes(consulta),
                         public.sin_tildes(a.nombre || ' ' || a.sinonimos)) as parecido
  from public.alimentos a
  where word_similarity(public.sin_tildes(consulta),
                        public.sin_tildes(a.nombre || ' ' || a.sinonimos)) >= 0.40
     or public.sin_tildes(a.nombre) ilike '%' || public.sin_tildes(consulta) || '%'
  order by
    case a.confianza when 'verificado' then 0 when 'estimado' then 1 else 2 end,
    case when a.creado_por = auth.uid() then 0 else 1 end,
    parecido desc,
    length(a.nombre)
  limit tope;
$$;

revoke execute on function public.buscar_alimento(text, int) from anon;
revoke execute on function public.sin_tildes(text) from anon;
