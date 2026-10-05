-- ============================================================================
-- 0092 · El bucket `creadores-cuadros` queda PRIVADO aunque ya existiera
-- ============================================================================
--
-- Hallazgo E-07 de la revisión de Codex del 28-sep: la 0090 crea el bucket con
-- `insert … on conflict (id) do nothing`. Si `creadores-cuadros` ya existía con
-- `public = true` (creado a mano desde el panel, por ejemplo), la 0090 lo dejaba así y las
-- hojas de cuadros de la etapa 2 quedaban servibles por URL pública, sin pasar por la
-- política `creadores_cuadros_leer`. No está demostrado que ocurra en producción; esta
-- migración lo garantiza igual, que es más barato que comprobarlo a mano cada vez.
--
-- QUÉ CAMBIA. Solo la columna `public` de ESE bucket, a false. Idempotente: pasarla dos
-- veces no cambia nada. Una sola sentencia (atómica por sí misma), sin begin/commit, para
-- que la prueba `supabase/test/110-creadores-tablero.sql` la pueda volver a pasar dentro
-- de su transacción con `\ir` y deshacerla con su rollback.
--
-- Solo usa (id, public) de `storage.buckets`, que el CI monta a mano en
-- `supabase/test/00-suplantar-supabase.sql` (la lección de la 0082: nada más allá de eso).
--
-- NO SE APLICA A PRODUCCIÓN desde aquí: la aplica Bryan. Su señal está en
-- `supabase/comprobar-migraciones.sql` («0092 - …»).
-- ============================================================================

update storage.buckets
   set public = false
 where id = 'creadores-cuadros'
   and public is distinct from false;
