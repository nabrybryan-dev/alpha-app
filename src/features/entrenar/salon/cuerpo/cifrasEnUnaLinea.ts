import type { EjercicioPrescrito } from '../../../../domain/types'

/** «3 series · 9 reps · 3 min · RIR 2»: las cuatro cifras de la pared, en una linea. */
export function cifrasEnUnaLinea(
  e: Pick<EjercicioPrescrito, 'sets' | 'repsDiana' | 'descansoMin' | 'rirObjetivo'>,
): string {
  const descanso = Number.isInteger(e.descansoMin) ? `${e.descansoMin} min` : `${String(e.descansoMin).replace('.', ',')} min`
  const rir = e.rirObjetivo === 'FALLO' ? 'fallo' : String(e.rirObjetivo)
  return `${e.sets} series · ${e.repsDiana} reps · ${descanso} · RIR ${rir}`
}

