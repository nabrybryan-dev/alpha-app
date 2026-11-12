import { PRAXIS_UN_TOQUE_ACTIVO } from './banderas'
import { CapaPraxisConectada } from './CapaPraxisConectada'

/** El único punto por donde los layouts montan la capa: con la bandera apagada devuelve `null` y no se renderiza nada. */
export function CapaDeUnToque() {
  return PRAXIS_UN_TOQUE_ACTIVO ? <CapaPraxisConectada /> : null
}
