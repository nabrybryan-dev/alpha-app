import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { usePuestoCoach } from '../features/coach/consola/usePuestoCoach'
import { useSesion } from './SessionProvider'

/**
 * La puerta de las pantallas que son SOLO del equipo (paso 2 del plan 14): la mesa del encoder,
 * `/marca`, la Bandeja, Empresa y la ficha única.
 *
 * El marco del asesorado no aplica `soloEquipo` —lo aplica cada pantalla, y las pantallas
 * nuevas no deberían repetir la misma comprobación—. Esta pieza la aplica UNA vez, en el
 * router, con el mismo oráculo que la tabla de rutas (`ocupaPuestoCoach`): nutricionista, rol
 * coach o la cuenta personal con `puesto_de_coach`; el resto vuelve a `destino`.
 *
 * Mientras la capacidad se consulta no se decide nada: echar a Bryan de su propia ficha antes
 * de saber que ocupa el puesto sería el bug. Se muestra «Comprobando…» y se espera.
 */
export function SoloEquipo({
  destino = '/',
  children,
}: {
  destino?: string
  children: ReactNode
}) {
  const { usuario } = useSesion()
  const { esCoach, cargando } = usePuestoCoach(usuario.rol)

  if (usuario.rol === 'asesorado' && cargando) {
    return (
      <p className="p-6 text-center text-sm text-tenue" aria-busy="true">
        Comprobando tu acceso…
      </p>
    )
  }
  if (usuario.rol !== 'nutricionista' && !esCoach) return <Navigate to={destino} replace />
  return <>{children}</>
}
