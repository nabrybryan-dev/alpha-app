/**
 * Límites de valores (DISENO §4.3). Tres veredictos:
 *
 *  - `ok`: pasa.
 *  - `aviso`: es posible pero raro; se guarda y la tarjeta lo dice.
 *  - `imposible`: no cabe en el campo. NO se trunca ni se corrige en silencio:
 *    el resolutor pregunta.
 *
 * Una diferencia con el diseño, elegida por el corpus (D12): 900 kg no es «raro»,
 * es imposible, así que la carga cae en `imposible` por encima de 500 kg (el
 * máximo visto en producción es 240) en vez de esperar a 999.
 */
export type Veredicto = { tipo: 'ok' } | { tipo: 'aviso'; aviso: string } | { tipo: 'imposible'; motivo: string }

const OK: Veredicto = { tipo: 'ok' }

export const CARGA_MAX_PLAUSIBLE_KG = 240
export const CARGA_MAX_POSIBLE_KG = 500

export function revisarCarga(kg: number, ultimaKg?: number | null): Veredicto {
  if (!Number.isFinite(kg) || kg < 0) return { tipo: 'imposible', motivo: 'carga negativa' }
  if (kg > CARGA_MAX_POSIBLE_KG) return { tipo: 'imposible', motivo: `${kg} kg no parece posible` }
  if (kg > CARGA_MAX_PLAUSIBLE_KG) return { tipo: 'aviso', aviso: 'Carga muy alta: revísala antes de guardar' }
  if (ultimaKg && ultimaKg > 0 && kg > ultimaKg * 2.5) {
    return { tipo: 'aviso', aviso: 'Es mucho más que tu última serie: revísala antes de guardar' }
  }
  return OK
}

export function revisarReps(reps: number, rango?: string): Veredicto {
  if (!Number.isFinite(reps) || reps < 1 || reps > 50) return { tipo: 'imposible', motivo: `${reps} repeticiones no cabe` }
  const m = rango?.match(/(\d+)\s*-\s*(\d+)/)
  if (m && (reps < Number(m[1]) || reps > Number(m[2]))) {
    // Fuera de rango se guarda igual (CE-007): no es un error, es información.
    return { tipo: 'aviso', aviso: `fuera del rango ${m[1]}-${m[2]}` }
  }
  return OK
}

export function revisarHorasSueno(h: number): Veredicto {
  if (!Number.isFinite(h) || h < 0 || h > 14) return { tipo: 'imposible', motivo: `${h} horas no cabe en el campo (0 a 14)` }
  if (h < 3 || h > 11) return { tipo: 'aviso', aviso: 'Dato fuera de lo habitual' }
  return OK
}

export function revisarPasos(p: number): Veredicto {
  if (!Number.isFinite(p) || p < 0 || p > 100_000) return { tipo: 'imposible', motivo: `${p} pasos no cabe (0 a 100.000)` }
  if (p > 40_000) return { tipo: 'aviso', aviso: 'Dato fuera de lo habitual' }
  return OK
}

export function revisarAguaDeltaMl(ml: number, totalDiaMl = 0): Veredicto {
  if (!Number.isFinite(ml) || ml <= 0 || ml > 3000) return { tipo: 'imposible', motivo: `${ml} mL de una vez no cabe` }
  if (totalDiaMl + ml > 6000) return { tipo: 'aviso', aviso: 'El total del día pasa de 6 litros' }
  return OK
}

export function revisarGramos(g: number): Veredicto {
  if (!Number.isFinite(g) || g <= 0 || g > 2000) return { tipo: 'imposible', motivo: `${g} g por ítem no cabe` }
  return OK
}

export function revisarRpeSesion(rpe: number): Veredicto {
  if (!Number.isFinite(rpe) || rpe < 6 || rpe > 10) return { tipo: 'imposible', motivo: 'La escala de la app va de 6 a 10' }
  return OK
}

export function revisarPesoCorporal(kg: number): Veredicto {
  if (!Number.isFinite(kg) || kg < 25 || kg > 300) return { tipo: 'imposible', motivo: `${kg} kg no cabe como peso corporal (25 a 300)` }
  return OK
}
