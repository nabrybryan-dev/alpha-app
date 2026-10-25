/**
 * La derivación de alarmas al coach, en una lista (maqueta 7, paso 9; regla 2 del encargo).
 *
 * El dolor de 4/10 ya avisa dentro del check-in (`domain/senales/dolor`) y el coach ya lo ve en
 * la ficha. Lo que faltaba era que la Bandeja y el Hoy del equipo lo tuvieran delante: por eso
 * la maqueta pide que «la seguridad salga siempre», con cualquier filtro de sombrero.
 *
 * Esto NO decide nada clínico: solo encuentra a quién mirar. Qué hacer con el dolor es del coach.
 */

import type { CheckinDiario } from '../types'
import { UMBRAL_DOLOR_QUE_AVISA } from '../senales/dolor'

/** El mismo umbral que usa el resto de la app. Se exporta para que nadie escriba otro 4. */
export const UMBRAL_ALARMA_DE_DOLOR = UMBRAL_DOLOR_QUE_AVISA

export interface PersonaDeLaAlarma {
  id: string
  nombre: string
}

export interface AlarmaDeDolor {
  usuarioId: string
  nombre: string
  fecha: string
  dolor: number
  donde?: string
}

/**
 * El ÚLTIMO check-in de cada persona manda: un 7 de la semana pasada que ya bajó a 1 no es una
 * alarma de hoy, y una alarma de hoy no se tapa con el historial. Se ordena de más dolor a menos
 * porque lo primero que hay que mirar es lo que más duele.
 */
export function alarmasDeDolor(
  personas: readonly PersonaDeLaAlarma[],
  checkinsPorPersona: Readonly<Record<string, readonly CheckinDiario[] | undefined>>,
): AlarmaDeDolor[] {
  const alarmas: AlarmaDeDolor[] = []
  for (const persona of personas) {
    const checkins = checkinsPorPersona[persona.id]
    if (!checkins || checkins.length === 0) continue
    const ultimo = checkins.reduce((a, b) => (a.fecha >= b.fecha ? a : b))
    const dolor = ultimo.dolor
    if (dolor === undefined || dolor < UMBRAL_ALARMA_DE_DOLOR) continue
    alarmas.push({
      usuarioId: persona.id,
      nombre: persona.nombre,
      fecha: ultimo.fecha,
      dolor,
      ...(ultimo.dolorDonde ? { donde: ultimo.dolorDonde } : {}),
    })
  }
  return alarmas.sort((a, b) => b.dolor - a.dolor || a.nombre.localeCompare(b.nombre))
}
