/**
 * RIR dicho por la persona. Tres reglas que protegen al motor de progresión:
 *
 *  - Lo no dicho queda AUSENTE. Nunca se rellena con el `rirObjetivo`.
 *  - `fallo` NO es RIR 0 (son cosas distintas, `objetivoDeIntensidad.ts`): queda
 *    ausente y se avisa al coach.
 *  - La escala de la app llega a 5: «podía hacer 6 más» se guarda como 5 con
 *    aviso y confianza baja.
 */
import { numeroDeCita } from './numeros.ts'
import type { Confianza, ReservaExtraida, SenalEntreno } from './tipos.ts'
import { confianzaDe, type SenalConfianza } from './confianza.ts'

export const RIR_MAX = 5

export interface RirResuelto {
  rir?: number
  /** Confianza propia de este dato; `undefined` si no hay RIR. */
  confianza?: Confianza
  aviso?: string
  notaCoach?: string
}

export function resolverReserva(reserva: ReservaExtraida, senales: readonly SenalEntreno[]): RirResuelto {
  if (reserva.tipo === 'fallo') return { notaCoach: 'La persona dijo que llegó al fallo (no se guarda como RIR 0).' }
  if (reserva.tipo !== 'reserva_dicha') return {}
  const n = numeroDeCita(reserva.cita)
  if (!n) return {}
  const sen: SenalConfianza[] = []
  if (n.aproximado || senales.includes('aproximado')) sen.push('aproximado')
  if (senales.includes('maximo_o_minimo')) sen.push('maximo_o_minimo')
  if (senales.includes('no_recuerda')) sen.push('no_recuerda')
  let valor = n.valor
  let aviso: string | undefined
  if (!Number.isInteger(valor) || valor < 0) return {}
  if (valor > RIR_MAX) {
    aviso = `Dijiste ${valor} en reserva; la escala de la app llega a ${RIR_MAX} y se guardó ${RIR_MAX}`
    valor = RIR_MAX
    sen.push('recortado')
  }
  return { rir: valor, confianza: confianzaDe(sen), aviso }
}
