import type { AdherenciaNutricional } from '../types'

/**
 * Adherencia al plan, 0–100, sobre los días que la persona marcó.
 *
 * "Parcial" vale medio día a propósito: el asesorado que comió casi todo su
 * plan no hizo lo mismo que el que no lo siguió, y contarlos igual borra la
 * diferencia que el coach necesita ver.
 *
 * Los días sin marcar NO cuentan como incumplidos: no registrar no es lo mismo
 * que no cumplir, y castigarlo empujaría a marcar por marcar.
 */
export function porcentajeAdherencia(adherencias: readonly AdherenciaNutricional[]): number {
  if (adherencias.length === 0) return 0
  const suma = adherencias.reduce(
    (total, a) => total + (a.estado === 'si' ? 1 : a.estado === 'parcial' ? 0.5 : 0),
    0,
  )
  return Math.round((suma / adherencias.length) * 100)
}
