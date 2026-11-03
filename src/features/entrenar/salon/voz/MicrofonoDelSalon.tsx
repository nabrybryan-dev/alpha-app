import type { Microciclo, Sesion } from '../../../../domain/types'
import { destinoDeLaVuelta } from '../camara/vueltaDelCuerpo'
import type { EstadoDeLaGuia } from '../guia/useZonaDePraxis'
import { BotonDeVoz } from './BotonDeVoz'
import { ejecutarOrden } from './ejecutarOrden'
import { interpretarOrden, respuestaDeLaOrden } from './ordenesDeVoz'
import { useVozPermitida } from './useVozPermitida'

export interface MicrofonoDelSalonProps {
  vista: 'cuerpo' | 'movimiento'
  guia: EstadoDeLaGuia
  azimut: number
  sesion?: Sesion
  previo?: Microciclo
  ir: (destino: EstadoDeLaGuia) => void
  cambiarVista: (vista: 'cuerpo' | 'movimiento') => void
  irAlEjercicio?: (indice: number) => void
  girar?: (azimut: number) => void
  preguntar?: (frase: string) => void
}

/** El micrófono conectado al sujeto: lo dicho se vuelve una orden, y la orden mueve lo que ya mueven los toques. */
export function MicrofonoDelSalon({ azimut, ...mandos }: MicrofonoDelSalonProps) {
  const permitida = useVozPermitida()
  if (!permitida) return null
  const alOir = (dicho: string) => {
    const orden = interpretarOrden(dicho, mandos.sesion)
    ejecutarOrden(orden, { ...mandos, darLaVuelta: () => mandos.girar?.(destinoDeLaVuelta(azimut)) })
    return respuestaDeLaOrden(orden)
  }
  return <BotonDeVoz alOir={alOir} sobreElPanel={mandos.guia !== null} />
}
