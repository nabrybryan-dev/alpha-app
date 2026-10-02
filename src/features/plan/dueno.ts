import { useSesionOpcional } from '../../app/SessionProvider'
import { usePuestoCoach } from '../coach/consola/usePuestoCoach'
import type { Dueno } from '../../domain/planOrganizador'

/**
 * De quién es el plan que se abre: `bryan` si quien mira es el coach, `manuela` si es la
 * nutricionista (staff), nadie para el resto. Es lo mismo que decide `plan_dueno_actual()` en
 * la base; aquí solo sirve para mostrar la vista correcta, la seguridad la pone la RLS.
 */
export function duenoDeRol(rol: string | undefined, puestoDeCoach = false): Dueno | null {
  if (rol === 'coach' || puestoDeCoach) return 'bryan'
  if (rol === 'nutricionista') return 'manuela'
  return null
}

export function useDuenoDelPlan(): Dueno | null {
  const sesion = useSesionOpcional()
  const { esCoach } = usePuestoCoach(sesion?.usuario.rol)
  return duenoDeRol(sesion?.usuario.rol, esCoach)
}

/** La ruta de «Mi plan» según el espacio: el coach vive bajo /coach; Manuela, en sus cinco espacios. */
export function rutaMiPlan(dueno: Dueno): string {
  return dueno === 'bryan' ? '/coach/mi-plan' : '/mi-plan'
}
