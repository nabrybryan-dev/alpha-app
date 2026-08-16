/**
 * Qué máquinas ha «abierto» el asesorado en esta sesión.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SE DESBLOQUEA CON SERIES, NO CON TOQUES
 * ─────────────────────────────────────────────────────────────────────────────
 * La regla es la misma que ya usa el resto de la sesión: un ejercicio cuenta
 * cuando tiene todas sus series registradas (`ejercicioCompleto`). No cuando se
 * mira, no cuando se tira de la palanca, no cuando se pasa por encima.
 *
 * Es lo único que hace que el contador signifique algo. Si se desbloqueara al
 * verlas, en diez segundos de scroll estarían las cinco y el número dejaría de
 * hablar de entrenamiento para hablar de navegación — y entonces sobra.
 *
 * No se guarda nada: se deriva de las series que ya están en el microciclo. Un
 * contador persistido se desincroniza en cuanto alguien corrige una serie, y
 * este se corrige solo.
 */

import { ejercicioCompleto } from './cumplimiento'
import type { EjercicioPrescrito } from './types'

export interface SalonDeMaquinas {
  /** Índices de los ejercicios ya completados: uno por máquina abierta. */
  abiertas: number[]
  total: number
  /** Todas las de la sesión, con al menos una. Es lo que da la insignia. */
  completo: boolean
}

export function salonDeMaquinas(ejercicios: readonly EjercicioPrescrito[]): SalonDeMaquinas {
  const abiertas = ejercicios.flatMap((e, i) => (ejercicioCompleto(e) ? [i] : []))
  return {
    abiertas,
    total: ejercicios.length,
    completo: ejercicios.length > 0 && abiertas.length === ejercicios.length,
  }
}
