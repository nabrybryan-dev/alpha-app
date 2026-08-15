-- App Alpha Athletics · Migración 0039 · El hambre que sí se puede ejecutar
-- Pegar completo en: Supabase → SQL Editor → New query → Run
--
-- POR QUÉ
-- `checkins_nutricion` se escribió en la 0013 (julio) y expone `datos->>'hambre'`,
-- el campo de tres categorías: POCO / REGULAR / MUCHO. Desde entonces el check-in
-- pregunta el hambre de 1 a 10 y la guarda en `hambreEscala`, que esta vista NO
-- expone. El motivo del cambio está escrito en `src/domain/types.ts`:
--
--   «Con tres categorías no se distinguía un 7 de un 9 — que es justo la
--    diferencia entre esperar cinco días y actuar en dos. La regla de la
--    nutricionista existía y no se podía ejecutar por eso.»
--
-- Medido contra producción el 2026-08-15, sobre 47 check-ins:
--
--   con `hambre` (viejo)          23
--   con `hambreEscala` (actual)   24   ← y son los MÁS RECIENTES
--   con `alimentacion`            47
--   con `pesoKg`                  44
--
-- O sea: la vista tal como está le enseña a la nutricionista el hambre de la
-- mitad vieja y blanco en la mitad que sirve para decidir hoy. Se arregla el
-- campo que se le añadió a la app para que su regla fuera ejecutable, y la vista
-- por la que ella lo va a leer se quedó sin él.
--
-- ESTO BLOQUEA al cambio de `hidratar.ts` (que la nutricionista lea la vista en
-- vez de la tabla) y, detrás, al cierre de las tres políticas RLS que la 0013
-- dejó sin aplicar. Sin esta migración, ese cambio no acotaría el dato: lo
-- mutilaría.
--
-- QUÉ NO CAMBIA
-- La vista sigue con `security_invoker = false` (el de por defecto) **a
-- propósito**, igual que la escribió la 0013: RLS filtra FILAS, no COLUMNAS, así
-- que la única forma de recortar el jsonb —y dejar fuera motivación, cansancio,
-- estrés, horas y calidad de sueño y comentarios libres— es que la vista lea la
-- tabla con sus propios permisos. El control de acceso es el `where` de abajo.
--
-- El linter de Supabase marca esta vista como ERROR (`security_definer_view`).
-- Es un FALSO POSITIVO deliberado. Pasarla a `security_invoker = true`
-- devolvería la fila entera y desharía la protección entera de la 0013. No
-- «arreglarlo».

-- `create or replace` y no `drop`+`create`: conserva el `grant select to
-- authenticated` que puso la 0013. Obliga a que la columna nueva vaya la ÚLTIMA
-- —Postgres no deja reordenar ni insertar en medio al reemplazar—, que es por lo
-- que `hambre_escala` no queda al lado de `hambre` aunque sea su sucesora.
create or replace view public.checkins_nutricion as
select
  c.id,
  c.usuario_id,
  c.fecha,
  (c.datos ->> 'pesoKg')::numeric as peso_kg,
  c.datos ->> 'hambre'            as hambre,
  c.datos ->> 'alimentacion'      as alimentacion,
  -- El hambre de 1 a 10. Convive con `hambre` en vez de sustituirlo: los 23
  -- check-ins viejos se leen como se respondieron. «MUCHO» no es un 8, y
  -- traducirlo fabricaría una precisión que nadie midió.
  (c.datos ->> 'hambreEscala')::numeric as hambre_escala
from public.checkins c
where public.es_staff() or c.usuario_id = auth.uid();

comment on view public.checkins_nutricion is
  'Lo nutricional del check-in y nada más. Deliberadamente sin `datos` completo: '
  'ahí viven motivación, cansancio, estrés, sueño y comentarios libres, que no son '
  'asunto de nutrición. security_invoker=false a propósito (0013): RLS no filtra '
  'columnas.';

-- ===== Comprobación =====
-- Las dos columnas de hambre tienen que estar, y la nueva traer datos:
--
--   select count(*)                          as filas,
--          count(hambre)                     as con_hambre_viejo,
--          count(hambre_escala)              as con_hambre_escala
--     from public.checkins_nutricion;
--
-- Medido el 2026-08-15 con la sesión del coach: 47 · 23 · 24.
