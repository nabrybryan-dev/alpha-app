import { useSesionOpcional } from '../../../../app/SessionProvider'
import { puedeVerPraxis, type Rol } from '../../../../domain/praxis/acceso'
import { usePuestoCoach } from '../../../coach/consola/usePuestoCoach'

/**
 * ¿Se pinta el micrófono? La misma puerta de Praxis: el equipo, y los asesorados solo cuando se abra
 * (`PRAXIS_ABIERTA_A_ASESORADOS`), porque lo dicho pasa por el reconocedor del navegador, un tercero.
 */
export function useVozPermitida(): boolean {
  const rol = useSesionOpcional()?.usuario.rol as Rol | undefined
  const { esCoach } = usePuestoCoach(rol)
  return rol ? puedeVerPraxis(rol, undefined, esCoach) : false
}
