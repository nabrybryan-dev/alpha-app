-- 0058 · Un solo microciclo activo por persona, garantizado por la base.
--
-- QUÉ FALLABA (R-01 del informe de riesgos del 2026-08-28, verificado el 2026-09-07).
-- `0001_esquema.sql:55-63` crea `microciclos_usuario` como índice NO único, y no hay
-- ningún otro. El único candado del servidor es el trigger de
-- `0021_estado_microciclo_solo_staff.sql`, y su propia cabecera declara el hueco:
-- «Solo aplica a UPDATE. En INSERT el estado que venga es el bueno». Además se desactiva
-- cuando `auth.uid()` es nulo, que es exactamente el contexto de servicio con el que
-- escribe la tubería.
--
-- Resultado: dos INSERT con `estado='activo'` para el mismo `usuario_id` entran sin una
-- queja. Y el cliente hace `find(m => m.estado === 'activo')`, que devuelve uno
-- cualquiera — está fijado como test en `src/data/mockDb.test.ts:202`.
--
-- No es teórico por dos caminos ya medidos:
--   · `sync.ts:281-286` encola *abrir* y *cerrar* como dos operaciones independientes, y
--     su propio comentario dice que un corte entre ambas «deja una ventana con DOS
--     activos».
--   · los tres cargadores de `agentes/salidas/carga-*.sql` resuelven el microciclo con
--     `select ... into` SIN `limit 1`: con dos activos, plpgsql coge una fila arbitraria
--     y no lanza, así que el prevuelo puede validar contra uno y el cargador escribir en
--     otro.
--
-- POR QUÉ EN LA BASE Y NO EN LA APP. Porque los caminos de escritura son varios —la app,
-- la tubería con service role, el SQL Editor a mano— y un candado en uno solo de ellos no
-- es un candado. Es el único sitio donde no se puede esquivar.
--
-- ESTADO DE LA BASE ANTES DE APLICAR (medido el 2026-09-07 contra la real):
--   usuarios con más de un activo ......... 0
--   microciclos activos en total .......... 23
--   índices únicos sobre `microciclos` .... solo `microciclos_pkey`, que es sobre `id`
--
-- ⚠ COMPROBAR ESO OTRA VEZ ANTES DE CORRER ESTO. Si alguien tiene dos activos en el
-- momento de aplicarla, la creación del índice FALLA y no se aplica nada. Eso es lo
-- correcto —no queremos que elija una fila por nosotros—, pero conviene saberlo antes y
-- no descubrirlo a mitad. La consulta está en `supabase/comprobar-0058.sql`.

create unique index if not exists microciclos_un_activo_por_usuario
  on public.microciclos (usuario_id)
  where estado = 'activo';

-- El índice es PARCIAL a propósito: solo restringe las filas activas. Los cerrados y los
-- propuestos siguen pudiendo ser tantos como haga falta, que es lo que el historial
-- necesita. Un índice único sobre `(usuario_id, estado)` no serviría: dejaría meter dos
-- activos si alguno cambiara de estado a mitad, y prohibiría dos cerrados, que es lo
-- normal.

comment on index public.microciclos_un_activo_por_usuario is
  'R-01 · impide dos microciclos activos para la misma persona por cualquier via de '
  'escritura, incluida la tuberia con service role, donde el trigger de 0021 no aplica.';
