import type { Macros, TipoDia } from '../types'

/** El aviso que ve el asesorado cuando su plan no trae los macros del tipo de día. */
export const AVISO_SIN_MACROS = 'Tu plan no trae los macros de este tipo de día; avísale a tu coach.'

/**
 * Los macros de un tipo de día, o `null` si el plan no los trae. Un plan puede
 * llegar sin `macrosPorDia` o sin alguno de los tres tipos; leerlo con
 * `plan.macrosPorDia[tipo].kcal` reventaba la pantalla entera. Aquí no se
 * inventa ninguna cifra: sin dato, `null`, y cada pantalla dice la verdad.
 */
export function macrosDelDia(
  plan: { macrosPorDia?: Partial<Record<TipoDia, Macros>> | null } | null | undefined,
  tipo: TipoDia,
): Macros | null {
  const m = plan?.macrosPorDia?.[tipo]
  if (!m || typeof m.kcal !== 'number' || !Number.isFinite(m.kcal)) return null
  return m
}
