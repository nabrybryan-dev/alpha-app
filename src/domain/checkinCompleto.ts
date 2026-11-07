import type { CheckinDiario } from './types'

/**
 * Un check-in cuenta como HECHO solo si está completo. Uno a medias (`parcial: true`, lo deja Praxis cuando la
 * persona contó parte de su día) no da puntos ni racha, ni cuenta en el ranking o en «check-ins de la semana»,
 * y deja el formulario abierto con lo ya anotado (decisión de Bryan, 7-nov-2026).
 *
 * Los check-ins anteriores a esta marca no la traen: ausente = completo.
 */
export function checkinCompleto(c: Pick<CheckinDiario, 'parcial'>): boolean {
  return c.parcial !== true
}

export function soloCompletos<T extends Pick<CheckinDiario, 'parcial'>>(checkins: readonly T[]): T[] {
  return checkins.filter(checkinCompleto)
}
