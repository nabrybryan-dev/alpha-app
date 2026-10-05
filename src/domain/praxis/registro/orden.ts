/**
 * Asignar el `orden` de la serie (DISENO §1.4, `orden.ts`).
 *
 *  - Sin ordinal dicho: `series.length + 1`, y las siguientes en fila.
 *  - Con ordinal («la segunda», «la última»): ese orden. Si ya existe, es un
 *    REEMPLAZO y la tarjeta lo muestra («65×10 → 65×12») porque `registrarSerie`
 *    pisa por `orden` sin avisar.
 *  - Nunca se crean series por encima de `sets` sin preguntar.
 */
import type { EjercicioCtx, SerieHecha } from './tipos.ts'

export interface PlanDeOrden {
  ordenes: number[]
  /** Series ya hechas que estas van a pisar. */
  reemplazos: SerieHecha[]
  /** Cuántas series pasarían de lo prescrito (`sets`). */
  exceso: number
}

export function siguienteOrden(ej: Pick<EjercicioCtx, 'series'>): number {
  return ej.series.length + 1
}

/**
 * @param cantidad cuántas series salen de este mensaje para el ejercicio
 * @param ordinal `null` = las que siguen; número = esa; `'ultima'` = la última prescrita
 */
export function planificarOrdenes(
  ej: Pick<EjercicioCtx, 'series' | 'sets'>,
  cantidad: number,
  ordinal: number | 'ultima' | 'otra' | null,
  desde?: number,
): PlanDeOrden {
  let inicio: number
  if (typeof ordinal === 'number') inicio = ordinal
  else if (ordinal === 'ultima') inicio = ej.sets
  else inicio = desde ?? siguienteOrden(ej)
  const ordenes = Array.from({ length: cantidad }, (_, i) => inicio + i)
  const reemplazos = ordenes.map((o) => ej.series.find((s) => s.orden === o)).filter((s): s is SerieHecha => !!s)
  const exceso = ordenes.filter((o) => o > ej.sets).length
  return { ordenes, reemplazos, exceso }
}

/** Series que le quedarán al ejercicio después de guardar `ordenes`. */
export function quedanDespues(ej: Pick<EjercicioCtx, 'series' | 'sets'>, ordenes: number[]): number {
  const hechas = new Set([...ej.series.map((s) => s.orden), ...ordenes])
  return Math.max(0, ej.sets - hechas.size)
}
