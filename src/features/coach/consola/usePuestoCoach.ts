import type { Capacidad } from '../../../data/consola/capacidadesStaff'
import { useCapacidades } from './useCapacidades'

/**
 * ¿Quien mira ocupa el PUESTO de coach? Es cierto para el coach (rol) y para la cuenta PERSONAL de
 * Bryan (0106): una cuenta que sigue siendo `asesorado` —entrena con su propio microciclo, está en
 * la cartera, la cadena y el ranking— y a la que la base le da el puesto de coach con la capacidad
 * `puesto_de_coach` (`es_coach()` y `es_staff()` la reconocen). El rol NO cambia a propósito: con dos
 * coaches, el chat de los asesorados, el ranking y la cadena no sabrían cuál es «el» coach.
 *
 * Mientras la capacidad se consulta, quien es asesorado NO es coach (el resultado seguro); quien
 * decide una redirección con esto mira `cargando` para no echar a Bryan antes de saberlo.
 */
export function ocupaPuestoCoach(
  rol: string | undefined,
  cargando: boolean,
  tiene: (capacidad: Capacidad) => boolean,
): boolean {
  return rol === 'coach' || (rol === 'asesorado' && !cargando && tiene('puesto_de_coach'))
}

export function usePuestoCoach(rol: string | undefined): {
  esCoach: boolean
  cargando: boolean
  tiene: (capacidad: Capacidad) => boolean
} {
  const { cargando, tiene } = useCapacidades()
  return { esCoach: ocupaPuestoCoach(rol, cargando, tiene), cargando, tiene }
}
