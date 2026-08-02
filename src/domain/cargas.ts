/**
 * Matriz CARGAS: reps × RIR → fracción del 1RM.
 *
 * Es la misma tabla que vive en la hoja `CARGAS` de los Excel del coach —
 * comprobado idéntica en los 21 libros de asesorados el 2026-08-01— y la que
 * documenta `wiki/motor-decision/02-intensidad-rir-rpe-cargas.md`. Se transcribe
 * literal a propósito: NO es una fórmula lineal (de reps 1 el salto RIR 0→1 es
 * 0,035 y el 1→2 es 0,030), así que aproximarla desviaría las estimaciones.
 *
 * Con carga real + reps + RIR se estima el 1RM del día, que es como el método
 * detecta progreso y estancamiento sin hacer tests de fuerza máxima.
 */

/** Índice 0 = RIR 0, hasta RIR 6. Filas de 1 a 15 reps. */
const COEFICIENTES: readonly (readonly number[])[] = [
  [1.0, 0.965, 0.935, 0.9, 0.865, 0.83, 0.795],
  [0.96, 0.925, 0.895, 0.86, 0.825, 0.79, 0.755],
  [0.925, 0.89, 0.86, 0.825, 0.79, 0.755, 0.72],
  [0.89, 0.855, 0.825, 0.79, 0.755, 0.72, 0.685],
  [0.855, 0.82, 0.79, 0.755, 0.72, 0.685, 0.65],
  [0.82, 0.785, 0.755, 0.72, 0.685, 0.65, 0.615],
  [0.785, 0.75, 0.72, 0.685, 0.65, 0.615, 0.58],
  [0.75, 0.715, 0.685, 0.65, 0.615, 0.58, 0.545],
  [0.715, 0.68, 0.65, 0.615, 0.58, 0.545, 0.51],
  [0.68, 0.645, 0.615, 0.58, 0.545, 0.51, 0.475],
  [0.645, 0.61, 0.58, 0.545, 0.51, 0.475, 0.44],
  [0.61, 0.575, 0.545, 0.51, 0.475, 0.44, 0.405],
  [0.575, 0.54, 0.51, 0.475, 0.44, 0.405, 0.37],
  [0.54, 0.505, 0.475, 0.44, 0.405, 0.37, 0.335],
  [0.505, 0.47, 0.44, 0.405, 0.37, 0.335, 0.3],
]

export const REPS_MAX = COEFICIENTES.length
export const RIR_MAX = COEFICIENTES[0].length - 1

/**
 * Fracción del 1RM que representa una serie de `reps` a `rir`.
 *
 * Fuera de tabla devuelve undefined en vez de extrapolar: una serie de 30 reps
 * a RIR 6 no dice nada útil sobre la fuerza máxima, y un número inventado ahí
 * contaminaría el histórico de 1RM del que sale el progreso.
 */
export function coeficienteCarga(reps: number, rir: number): number | undefined {
  if (!Number.isInteger(reps) || !Number.isInteger(rir)) return undefined
  if (reps < 1 || reps > REPS_MAX) return undefined
  if (rir < 0 || rir > RIR_MAX) return undefined
  return COEFICIENTES[reps - 1][rir]
}

/** 1RM estimado de una serie concreta, en kg. */
export function estimarUnRm(cargaKg: number, reps: number, rir: number): number | undefined {
  if (!Number.isFinite(cargaKg) || cargaKg <= 0) return undefined
  const coeficiente = coeficienteCarga(reps, rir)
  if (coeficiente === undefined) return undefined
  return Math.round((cargaKg / coeficiente) * 10) / 10
}
