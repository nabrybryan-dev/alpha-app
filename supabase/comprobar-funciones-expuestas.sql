-- ¿Qué función de `public` puede llamar cualquiera con la anon key?
--
-- Pegar en: Supabase → SQL Editor → New query → Run. SOLO LEE.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ EXISTE
-- ─────────────────────────────────────────────────────────────────────────────
-- `create function` concede `EXECUTE` a `PUBLIC` por defecto, y todo lo que vive
-- en `public` se expone como RPC. Así que una función recién creada es, por
-- omisión, llamable por cualquiera que tenga la anon key — y la anon key va
-- dentro del bundle de la app, o sea que la tiene todo el mundo.
--
-- El 2026-08-27 se encontraron así `tmp_cargar_siguiente` y `tmp_nuevo_micro`,
-- las dos funciones que ESCRIBEN microciclos. No eran explotables —son SECURITY
-- INVOKER y RLS las contenía— pero estaban a una equivocación de RLS de serlo.
--
-- Y lo que más importa: **el código estaba bien**. La plantilla de carga trae su
-- `revoke` debajo de cada función, y los ficheros `_app-cargar-*.sql` también.
-- Fue producción la que se desvió de los ficheros, que es el riesgo del flujo de
-- pegar SQL a mano y que ya está escrito en `comprobar-migraciones.sql`:
--
--   «Un pegado truncado no da ningún error.»
--
-- Por eso esto no comprueba el código: comprueba la BASE. Correrlo después de
-- cada carga de microciclos y antes de cada despliegue.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CÓMO SE LEE
-- ─────────────────────────────────────────────────────────────────────────────
-- La columna `veredicto`:
--
--   OK        conocida y con motivo escrito abajo
--   REVISAR   nadie ha dicho que ésta deba estar abierta ← mirar SIEMPRE
--
-- Una fila `REVISAR` no significa «hay un agujero». Significa que alguien tiene
-- que decidir, y que si la respuesta es «no debía estar abierta», el arreglo es
-- una línea:
--
--   revoke execute on function public.<nombre>(<argumentos>) from public;
--
-- Si la función es legítima y debe seguir abierta, se añade a la lista de abajo
-- CON SU MOTIVO. Una lista blanca sin motivos deja de ser una lista blanca al
-- tercer nombre que alguien añade con prisa.

with permitidas(nombre, motivo) as (values
  -- Catálogo de alimentos: dato de referencia (TCAC 2018 del ICBF), igual para
  -- todo el mundo y sin nada personal dentro. Su RLS ya acota a lo público:
  -- `creado_por is null or creado_por = auth.uid() or es_staff()`.
  ('buscar_alimento', 'catalogo publico de alimentos, sin dato personal'),
  ('sin_tildes',      'ayudante puro de texto, no toca ninguna tabla'),

  -- Funciones de TRIGGER. PostgREST no las expone -no se pueden llamar por RPC-
  -- así que el `execute` abierto no las alcanza desde fuera.
  --
  -- Y NO se les revoca a propósito: son las que mantienen `actualizado_en` (21
  -- triggers) y la que resuelve la comida de un item. Tocarles los permisos por
  -- cosmética arriesga cada escritura de la app a cambio de nada.
  ('marcar_actualizado',      'funcion de trigger, PostgREST no la expone'),
  ('resolver_comida_de_item', 'funcion de trigger, PostgREST no la expone')
)
select
  case when pr.nombre is null then 'REVISAR' else 'OK' end as veredicto,
  p.proname                                       as funcion,
  pg_get_function_identity_arguments(p.oid)       as argumentos,
  case when p.prosecdef then 'SECURITY DEFINER ⚠' else 'invoker' end as modo,
  coalesce(pr.motivo, '← nadie ha dicho que esta deba estar abierta') as motivo
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join permitidas pr on pr.nombre = p.proname
where n.nspname = 'public'
  and p.prokind = 'f'
  and has_function_privilege('anon', p.oid, 'execute')
order by veredicto, p.proname;

-- ─────────────────────────────────────────────────────────────────────────────
-- Y el caso que más duele: una función `tmp_` que sobrevivió a su carga
-- ─────────────────────────────────────────────────────────────────────────────
-- La regla de CLAUDE.md es que se borran al terminar. `plantilla-carga-microciclo.sql`
-- las recrea con `create or replace` en cada carga, así que borrarlas nunca
-- pierde nada — y dejarlas puestas es lo que permitió lo del 2026-08-27.
--
-- Esto debe devolver CERO FILAS entre carga y carga.

select p.proname as tmp_que_sobrevivio,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       has_function_privilege('anon', p.oid, 'execute') as la_alcanza_anon,
       'drop function if exists public.' || p.proname || '('
         || pg_get_function_identity_arguments(p.oid) || ');' as como_se_borra
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'tmp\_%'
order by p.proname;
