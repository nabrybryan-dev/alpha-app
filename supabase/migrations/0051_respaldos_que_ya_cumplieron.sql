-- Ocho tablas de respaldo que ya cumplieron su función.
--
-- Auditadas una a una el 2026-08-27. Diez tablas creadas «para un arreglo» que
-- llevaban entre cuatro días y un mes en producción, con datos de salud reales
-- dentro y sin fecha de caducidad.
--
-- Ninguna era un problema de ACCESO: todas tenían RLS activado, así que no se
-- leían desde la API. La regla de CLAUDE.md se cumplió. Lo que faltaba era
-- retención.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CÓMO SE DECIDIÓ CADA UNA
-- ─────────────────────────────────────────────────────────────────────────────
-- La pregunta no fue «¿es vieja?» sino «¿es la única copia de algo?». Se
-- comparó fila a fila contra `microciclos` buscando huérfanas: filas cuyo `id`
-- ya no existe vivo. Aparecieron seis, y cada una se miró por dentro.
--
-- `_backup_microciclos_20260823` tenía CINCO huérfanas. Las cinco `propuesto` y
-- con CERO series dentro: propuestas descartadas, no ejecución. Y las personas
-- afectadas conservan entre 4 y 6 microciclos vivos. (De paso: `m-lina-26-prop27`
-- estaba duplicada dentro del propio respaldo.)
--
-- `tmp_respaldo_20260824` tenía UNA, y es la que dio la vuelta al asunto:
-- `m-daniela-p2-3`, de una persona que YA NO EXISTE en `usuarios_app`. Fue
-- borrada, y el borrado en cascada limpió `auth.users`, `usuarios_app` y
-- `microciclos`... menos ese respaldo.
--
-- O sea que no era historia que conservar: era dato que sobrevivió a un borrado
-- que debía respetar. Por la jerarquía de este proyecto —privacidad primero—
-- ésa era la que más urgía, no la que había que dudar.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LAS DOS QUE SE QUEDAN, Y POR QUÉ
-- ─────────────────────────────────────────────────────────────────────────────
-- `respaldo_lina_m27_20260827`  — es de hoy. Demasiado reciente para tocarla.
--
-- `respaldo_tipo_zona2_20260825` — se conserva POR DUDA HONESTA. Su fila difiere
--   de la viva en las cinco sesiones, así que un cambio se aplicó, pero no se
--   pudo determinar cuál: el campo `tipo` sale nulo en las dos versiones, así
--   que la hipótesis que dio nombre a la tabla no se sostiene. No se borra dato
--   personal que no se puede confirmar que sobra. Son 48 kB.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Y LO QUE HAY QUE CAMBIAR PARA QUE NO VUELVA A PASAR
-- ─────────────────────────────────────────────────────────────────────────────
-- Que el `drop` viaje en el mismo script que el `create`, comentado al final,
-- igual que ya hace `plantilla-carga-microciclo.sql` con sus funciones `tmp_`.
-- Un respaldo sin fecha de caducidad se queda para siempre, y nadie vuelve a
-- mirarlo.
--
-- Dos también llevaban un nombre de persona en el nombre de la tabla. Un
-- respaldo no debería anunciar de quién es.

begin;

-- Contadores de una comprobación. Ni siquiera lleva dato personal:
-- `marcas_fosiles` y `tests_en_ceros`, dos números.
drop table if exists public.tmp_arreglo_20260824_antes;

-- 9 filas, 8 idénticas a lo vivo. Contenido editorial, sin dato personal.
drop table if exists public.respaldo_contenidos_20260827;

-- 113 filas, 108 idénticas a lo vivo. Es una foto de antes de una carga que
-- salió bien.
drop table if exists public.respaldo_microciclos_20260827;

-- 1 fila, y el arreglo SE COMPROBÓ aplicado: `fechaInicio` pasó de 2026-08-24 a
-- 2026-08-25 en la fila viva. El respaldo ya no protege nada.
drop table if exists public.respaldo_fechainicio_20260825;

-- 5 filas, todas vivas y sin huérfanas. Y el nombre sobra.
drop table if exists public.tmp_respaldo_juliana_20260824;

-- 25 filas, ninguna huérfana.
drop table if exists public.tmp_respaldo_dup_20260824;

-- 10 filas con 5 huérfanas, todas propuestas descartadas sin series.
drop table if exists public._backup_microciclos_20260823;

-- 114 filas. La huérfana es de una persona borrada del sistema: esto no se
-- conserva, se cierra.
drop table if exists public.tmp_respaldo_20260824;

commit;

-- ── Comprobación ─────────────────────────────────────────────────────────────
--
-- Deben quedar EXACTAMENTE dos, y ninguna otra:
--
--   select c.relname
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'r'
--      and (c.relname like 'tmp\_%' or c.relname like '%respaldo%'
--           or c.relname like '\_backup%')
--    order by 1;
--
--   -- respaldo_lina_m27_20260827
--   -- respaldo_tipo_zona2_20260825
