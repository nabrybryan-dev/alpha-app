/**
 * Unidades de carga: libras, «por mano», «por lado», «en total».
 *
 * Nunca duplica ni parte a ciegas. Si lo que dijo la persona contradice la
 * unidad del ejercicio, devuelve una PREGUNTA con el cálculo a la vista.
 */
import { normalizarTexto, redondear1 } from './numeros.ts'
import type { EjercicioCtx, Pregunta, PorCarga, UnidadCarga, UnidadSerie } from './tipos.ts'

export const LIBRA_A_KG = 0.45359237

/** Libras a kilos con un decimal: 135 lb = 61,2 kg. */
export function librasAKg(lb: number): number {
  return redondear1(lb * LIBRA_A_KG)
}

/** Tolera `por_mano`, `por mano`, `por-mano`, `POR MANO`... */
export function normalizarUnidadCarga(bruta: string | null | undefined): UnidadCarga | null {
  if (!bruta) return null
  const n = normalizarTexto(bruta).replace(/[\s_-]+/g, '_')
  if (n === 'kg' || n === 'kilos') return 'kg'
  if (n === 'total' || n === 'kg_total') return 'total'
  if (n === 'por_mano' || n === 'mano') return 'por_mano'
  if (n === 'por_lado' || n === 'lado') return 'por_lado'
  if (n === 'corporal' || n === 'peso_corporal') return 'corporal'
  if (n === 'banda') return 'banda'
  return null
}

/** ¿La cita habla de libras? («135 libras», «185 lb», «lbs»). */
export function dichoEnLibras(...citas: (string | null | undefined)[]): boolean {
  return citas.some((c) => !!c && /\b(libras?|lbs?)\b/.test(normalizarTexto(c)))
}

/** Lee «en cada mano», «por lado», «en total» en una cita libre. */
export function porDeCita(cita: string | null | undefined): PorCarga {
  if (!cita) return 'no_dicho'
  const n = normalizarTexto(cita)
  if (/\b(cada mano|por mano|cada brazo|por brazo)\b/.test(n)) return 'mano'
  if (/\b(por lado|cada lado|por pierna|cada pierna)\b/.test(n)) return 'lado'
  if (/\ben total\b|\btotal\b/.test(n)) return 'total'
  return 'no_dicho'
}

/** Cómo se guarda y se pinta la unidad de un ejercicio. `total` es `kg`. */
export function unidadDeSerie(u: UnidadCarga | null): UnidadSerie {
  if (u === 'por_mano') return 'por_mano'
  if (u === 'por_lado') return 'por_lado'
  if (u === 'corporal') return 'corporal'
  if (u === 'banda') return 'banda'
  return 'kg'
}

export interface UnidadResuelta {
  unidad: UnidadSerie
  /** La unidad salió del ejercicio y no de lo dicho: la tarjeta la dice explícita. */
  delEjercicio: boolean
  pregunta?: Pregunta
}

function fmt(n: number): string {
  return String(n).replace('.', ',')
}

/**
 * Cruza lo dicho («en cada mano») con lo que es el ejercicio (`por_mano`).
 * Coinciden → se guarda tal cual. No dijo → la del ejercicio. Se contradicen →
 * pregunta.
 */
export function resolverUnidad(
  ej: Pick<EjercicioCtx, 'unidad' | 'nombre'>,
  por: PorCarga,
  cargaKg: number,
): UnidadResuelta {
  const u = ej.unidad
  if (u === 'corporal' || u === 'banda') return { unidad: u, delEjercicio: true }
  const base = unidadDeSerie(u)
  if (por === 'no_dicho') return { unidad: base, delEjercicio: true }
  if (por === 'mano') {
    if (u === 'por_mano') return { unidad: 'por_mano', delEjercicio: false }
    return {
      unidad: base,
      delEjercicio: false,
      pregunta: {
        texto: `${ej.nombre} va en ${u === 'por_lado' ? 'kilos por lado' : 'kilos en total'}. ¿Los ${fmt(cargaKg)} kg fueron en cada mano?`,
        opciones: [`${fmt(cargaKg)} kg en cada mano (${fmt(cargaKg * 2)} en total)`, `${fmt(cargaKg)} kg en total`],
        campo_bloqueante: 'unidad_carga',
      },
    }
  }
  if (por === 'lado') {
    if (u === 'por_lado') return { unidad: 'por_lado', delEjercicio: false }
    return {
      unidad: base,
      delEjercicio: false,
      pregunta: {
        texto: `¿Los ${fmt(cargaKg)} kg fueron por cada lado?`,
        opciones: [`${fmt(cargaKg)} kg por lado (${fmt(cargaKg * 2)} en total)`, `${fmt(cargaKg)} kg en total`],
        campo_bloqueante: 'unidad_carga',
      },
    }
  }
  // por === 'total'
  if (u === 'por_mano' || u === 'por_lado') {
    const mitad = redondear1(cargaKg / 2)
    const que = u === 'por_mano' ? 'mano' : 'lado'
    return {
      unidad: base,
      delEjercicio: false,
      pregunta: {
        texto: `${ej.nombre} se anota por ${que}. ¿${fmt(cargaKg)} en total son ${fmt(mitad)} por ${que}?`,
        opciones: [`Sí, ${fmt(mitad)} por ${que}`, `No, ${fmt(cargaKg)} por ${que}`],
        campo_bloqueante: 'unidad_carga',
      },
    }
  }
  return { unidad: base, delEjercicio: false }
}
