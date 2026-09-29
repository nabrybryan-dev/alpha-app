-- ============================================================================
-- 0101 · Tres avisos del advisor de seguridad de Supabase (dos de ellos aquí)
-- ============================================================================
--
-- 1. ERROR «Security Definer View» en `checkins_nutricion` (0013 → 0039 → 0049).
-- 2. WARN «anon puede ejecutar» `es_nutricionista()` y `firmo_yo(text)` (0067).
-- 3. «Contraseñas filtradas» es un ajuste del panel de Auth (Leaked password protection):
--    NO se toca desde una migración.
--
-- ── 1 · checkins_nutricion ──────────────────────────────────────────────────
-- La vista corría como su dueño A PROPÓSITO (0013): la RLS de `checkins` filtra filas, no
-- columnas, y la nutricionista NO puede leer la tabla (`checkins_lee_staff` = es_coach()).
-- Con `security_invoker = on` a secas pasaría esto:
--   · asesorado: seguiría viendo lo suyo (política de dueño) -> igual;
--   · Bryan (coach): ve todo -> igual;
--   · Manuela / cualquier staff nutricionista: perdería TODAS las filas de la cartera
--     (la tabla se las niega) -> CAMBIO, y rompería la hidratación de la app;
--   · anon: sin privilegio -> igual.
-- Por eso se usa el patrón de la 0100: la lectura cerrada va en una función
-- `security definer` con `search_path` fijo que aplica EXACTAMENTE el `where` de antes
-- (`es_staff() or usuario_id = auth.uid()`) y devuelve SOLO las ocho columnas nutricionales
-- (nunca `datos` entero: ánimo, estrés, sueño y comentarios libres siguen fuera). La vista
-- pasa a `security_invoker = on` y solo envuelve la función, con las mismas columnas, orden
-- y tipos, así que ni el front ni las funciones de la tasa (0073–0076) ni la firma de
-- sincronización (0049) cambian. La función queda sin execute para public y anon.
--
-- ── 2 · es_nutricionista() y firmo_yo(text) ─────────────────────────────────
-- Se revoca execute a public y anon (se deja authenticated y service_role). Comprobado
-- con grep en supabase/migrations y src/: solo las usan las políticas de `mensajes`
-- (0067), y ningún flujo sin sesión las necesita. Las políticas `mensajes_leer` y
-- `mensajes_firmar_borrador` no llevan `to`, pero anon no tiene por qué leer ni tocar
-- `mensajes` (todo el flujo es con sesión), así que no se pierde nada.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · checkins_nutricion
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.checkins_nutricion_datos()
returns table (
  id             text,
  usuario_id     uuid,
  fecha          date,
  peso_kg        numeric,
  hambre         text,
  alimentacion   text,
  hambre_escala  numeric,
  actualizado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.usuario_id,
    c.fecha,
    (c.datos ->> 'pesoKg')::numeric,
    c.datos ->> 'hambre',
    c.datos ->> 'alimentacion',
    (c.datos ->> 'hambreEscala')::numeric,
    c.actualizado_en
  from public.checkins c
  where public.es_staff() or c.usuario_id = auth.uid();
$$;

revoke all on function public.checkins_nutricion_datos() from public, anon;
grant execute on function public.checkins_nutricion_datos() to authenticated, service_role;

comment on function public.checkins_nutricion_datos() is
  'Lo nutricional del check-in (8 columnas, nunca `datos` entero) para es_staff() o el dueño (0101). '
  'security definer + search_path fijo; la envuelve la vista checkins_nutricion.';

create or replace view public.checkins_nutricion
  with (security_invoker = on) as
select f.id, f.usuario_id, f.fecha, f.peso_kg, f.hambre, f.alimentacion,
       f.hambre_escala, f.actualizado_en
  from public.checkins_nutricion_datos() f;

revoke all on public.checkins_nutricion from anon, public;
grant select on public.checkins_nutricion to authenticated;
grant all on public.checkins_nutricion to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · anon y public fuera de es_nutricionista() y firmo_yo(text)
-- ────────────────────────────────────────────────────────────────────────────
revoke execute on function public.es_nutricionista() from public, anon;
revoke execute on function public.firmo_yo(text) from public, anon;
grant execute on function public.es_nutricionista() to authenticated, service_role;
grant execute on function public.firmo_yo(text) to authenticated, service_role;

commit;
