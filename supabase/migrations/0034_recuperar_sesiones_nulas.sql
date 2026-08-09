-- 0034 · Recuperar las seis sesiones que la carga del 2026-08-09 dejó en null
--
-- QUÉ PASÓ. La carga de la semana del 2026-08-09 19:56:32 UTC escribió un
-- `null` dentro del array `sesiones` de seis microciclos activos, en la
-- posición exacta donde iba una sesión real. No es un hueco de más: es una
-- sesión perdida. Al abrir la app, la sección se cae y sale "Esta sección no se
-- pudo mostrar / Reintentar".
--
-- A QUIÉN. Las seis, todas en su microciclo ACTIVO -la semana en curso-:
--
--   Manuela Quintero      #4   pos 3   METABÓLICO · TABATA + KETTLEBELL
--   Mariana Mora          #13  pos 1   CARDIO METABÓLICO + POSTURAL
--   Juliana Garcia        #12  pos 1   CARDIO HIIT + ZONA 2
--   Juliana Garcia        #12  pos 4   CIRCUITO METABÓLICO + ZONA 2
--   Juan Camilo Gutiérrez #21  pos 3   LEG C · HIIT METABÓLICO
--   Lina Mejía            #25  pos 3   CARDIO TABATA
--   María Isabel          #12  pos 4   HIGIENE DEL SACRO EN EL TRABAJO
--
-- POR QUÉ JUSTO ESAS. Las siete comparten un rasgo y solo uno: `ejercicios` es
-- un array VACÍO. Son sesiones de cardio, tabata, metabólico o de hábito, que
-- no llevan ejercicios de sala.
--
-- LA CAUSA. `jsonb_agg` de cero filas devuelve SQL NULL, no un array vacío. Un
-- clonador que haga `jsonb_set(s, '{ejercicios}', (select jsonb_agg(...) ...))`
-- sin envolver ese subselect en `coalesce(..., '[]')` recibe NULL, y jsonb_set
-- con un argumento NULL devuelve NULL: la sesión entera desaparece. Después
-- `jsonb_agg` la vuelve a meter en el array como un `null` de JSON.
--
-- `supabase/plantilla-carga-microciclo.sql` SÍ lleva ese coalesce y no produce
-- el fallo -se comprobó corriendo su lógica contra las siete sesiones perdidas,
-- y ninguna se anula-. La carga de hoy no salió de la plantilla.
--
-- QUÉ HACE ESTA MIGRACIÓN. Repone cada sesión nula con la de la MISMA POSICIÓN
-- del microciclo inmediatamente anterior, pasada por la misma limpieza que
-- exige el repo: se hereda la prescripción, nunca la ejecución. Se comprobó
-- antes que los seis microciclos anteriores tienen el mismo número de sesiones
-- y ningún nulo, así que la correspondencia por posición no es una suposición.
--
-- RESPALDO PRIMERO. La tabla de respaldo lleva RLS en el mismo paso que su
-- creación: guarda datos reales de salud y sin política queda legible con la
-- anon key.

-- ── 0 · Respaldo ────────────────────────────────────────────────────────────
create table if not exists public.respaldo_0034_microciclos (
  id text primary key,
  usuario_id uuid not null,
  numero int not null,
  datos jsonb not null,
  guardado_en timestamptz not null default now()
);
alter table public.respaldo_0034_microciclos enable row level security;
revoke all on table public.respaldo_0034_microciclos from anon, authenticated;

insert into public.respaldo_0034_microciclos (id, usuario_id, numero, datos)
select m.id, m.usuario_id, m.numero, m.datos
from public.microciclos m
where exists (select 1 from jsonb_array_elements(m.datos -> 'sesiones') e
              where jsonb_typeof(e) = 'null')
on conflict (id) do nothing;

-- ── 1 · Limpieza: la misma que la plantilla, para no heredar ejecución ──────
create or replace function public.tmp_0034_sin_marcas(p_items jsonb)
returns jsonb language sql immutable as $fn$
  select coalesce((
    select jsonb_agg((i - 'hechoEn') order by ord)
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(i, ord)
  ), '[]'::jsonb);
$fn$;
revoke execute on function public.tmp_0034_sin_marcas(jsonb) from public;

-- Deja la sesión lista para estrenar: sin marcas de preparación ni de cardio,
-- sin test post y con las series de cada ejercicio vacías.
--
-- El `coalesce` del final es EXACTAMENTE lo que faltaba en la carga que rompió
-- esto. Sin él, una sesión sin ejercicios vuelve a salir NULL de aquí.
create or replace function public.tmp_0034_en_limpio(p_s jsonb)
returns jsonb language sql immutable as $fn$
  select (
           case when con_prep ? 'preparacion'
                then jsonb_set(con_prep, '{preparacion}',
                               public.tmp_0034_sin_marcas(con_prep -> 'preparacion'))
                else con_prep
           end
         ) - 'testPost'
    from (
      select jsonb_set(
               case when p_s ? 'bloquesCardio'
                    then jsonb_set(p_s, '{bloquesCardio}',
                                   public.tmp_0034_sin_marcas(p_s -> 'bloquesCardio'))
                    else p_s
               end,
               '{ejercicios}',
               coalesce((
                 select jsonb_agg(jsonb_set(e, '{series}', '[]'::jsonb) order by ord)
                   from jsonb_array_elements(p_s -> 'ejercicios') with ordinality as t(e, ord)
               ), '[]'::jsonb)
             )
    ) as t(con_prep);
$fn$;
revoke execute on function public.tmp_0034_en_limpio(jsonb) from public;

-- ── 2 · Reponer ─────────────────────────────────────────────────────────────
--
-- Las tres condiciones del final no son adorno: si el microciclo anterior no
-- tiene el mismo número de sesiones, o tiene nulos él también, la
-- correspondencia por posición deja de significar nada y la fila NO se toca.
-- Preferimos dejarla rota y que se vea, antes que rellenarla con la sesión
-- equivocada -que es un error que nadie notaría-.
update public.microciclos m
set datos = jsonb_set(m.datos, '{sesiones}', (
      select jsonb_agg(
               case when jsonb_typeof(e.value) = 'null'
                    then public.tmp_0034_en_limpio(prev.value)
                    else e.value
               end
               order by e.o)
        from jsonb_array_elements(m.datos -> 'sesiones') with ordinality as e(value, o)
        join lateral (
          select x.value
            from jsonb_array_elements(ant.datos -> 'sesiones') with ordinality as x(value, o2)
           where x.o2 = e.o
        ) prev on true
    )),
    actualizado_en = now()
from public.microciclos ant
where ant.usuario_id = m.usuario_id
  and ant.numero = (select max(m2.numero) from public.microciclos m2
                     where m2.usuario_id = m.usuario_id and m2.numero < m.numero)
  and exists (select 1 from jsonb_array_elements(m.datos -> 'sesiones') e2
              where jsonb_typeof(e2) = 'null')
  and jsonb_array_length(ant.datos -> 'sesiones') = jsonb_array_length(m.datos -> 'sesiones')
  and not exists (select 1 from jsonb_array_elements(ant.datos -> 'sesiones') e3
                  where jsonb_typeof(e3) = 'null');

-- ── 3 · Recoger ─────────────────────────────────────────────────────────────
-- Las funciones son temporales: se crean, se usan y se borran. Dejarlas vivas
-- en `public` las expone como RPC.
drop function if exists public.tmp_0034_en_limpio(jsonb);
drop function if exists public.tmp_0034_sin_marcas(jsonb);
