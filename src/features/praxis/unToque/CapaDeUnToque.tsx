import { useDisenoFinal } from '../../../app/organizacionViva'
import { PRAXIS_UN_TOQUE_ACTIVO } from './banderas'
import { CapaPraxisConectada } from './CapaPraxisConectada'

/**
 * El único punto por donde los layouts montan la capa: con la bandera apagada devuelve `null` y no se renderiza nada.
 * Encendida también para las cuentas con el diseño final (`CUENTAS_CON_DISENO_FINAL`, la personal de Bryan).
 */
export function CapaDeUnToque() {
  const disenoFinal = useDisenoFinal()
  return PRAXIS_UN_TOQUE_ACTIVO || disenoFinal ? <CapaPraxisConectada /> : null
}
