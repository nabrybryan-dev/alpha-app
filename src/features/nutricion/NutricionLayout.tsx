import { Outlet } from 'react-router-dom'
import { CompuertaNutricion } from './CompuertaNutricion'

/**
 * Todo el apartado de Nutrición pasa por aquí.
 *
 * Que la compuerta esté en el layout y no en cada página es lo que la hace
 * completa: una ruta nueva que alguien añada mañana queda protegida sin que
 * tenga que acordarse de nada.
 */
export default function NutricionLayout() {
  return (
    <CompuertaNutricion>
      <Outlet />
    </CompuertaNutricion>
  )
}
