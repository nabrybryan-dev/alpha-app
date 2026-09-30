import { NOMBRE_SECCION, type Seccion } from '../../../domain/adminTablero'
import { TarjetaPendiente } from './TarjetaPlegable'
import { TarjetaSeccion, type EnlaceSeccion } from './TarjetaSeccion'
import type { TableroAdmin } from './useTableroAdmin'

/** Una sección del tablero: su tarjeta con datos, o la tarjeta gris si todavía no se puede leer. */
export function SeccionTablero({
  t,
  seccion,
  soloAccion = false,
  enlace = null,
  visibles,
}: {
  t: TableroAdmin
  seccion: Seccion
  soloAccion?: boolean
  enlace?: EnlaceSeccion | null
  /** Si viene, la sección solo se pinta cuando está en la lista (el filtro «requiere acción»). */
  visibles?: readonly Seccion[]
}) {
  if (t.estado.tipo === 'pendiente') return <TarjetaPendiente nombre={NOMBRE_SECCION[seccion]} />
  if (t.estado.tipo !== 'ok') return null
  if (visibles && !visibles.includes(seccion)) return null
  const leida = t.estado.secciones.find((s) => s.seccion === seccion)
  if (!leida) return null
  return (
    <TarjetaSeccion
      leida={leida}
      nombre={NOMBRE_SECCION[seccion]}
      abierta={t.abiertas.includes(seccion)}
      soloAccion={soloAccion}
      enlace={enlace}
      onAlternar={() => t.alternar(seccion)}
    />
  )
}
