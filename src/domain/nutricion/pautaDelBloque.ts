import type { Perfil } from '../types'
import type { Respuestas } from './encuesta'
import { calcularPerfil } from './perfilCalculado'

/**
 * Los tres números que resume la tarjeta "Tu bloque actual": fase energética,
 * proteína y pasos.
 *
 * POR QUÉ EXISTE. Hasta ahora los tres eran campos manuales del perfil, y como
 * el coach no los había cargado para nadie, la tarjeta no se pintaba para nadie.
 * Pero dos de los tres ya son deducibles: la encuesta pregunta el peso y los
 * pasos, y `calcularPerfil` saca de ahí los macros. Faltaba el puente.
 *
 * QUÉ NO HACE. No convierte un cálculo en una prescripción. Lo que cargó el
 * coach manda siempre, y lo que sale de la fórmula viaja marcado como
 * `calculado` para que la pantalla pueda decirlo. Esa distinción es la razón
 * por la que la tarjeta se dejó vacía en su día: mejor nada que un número que
 * nadie recetó haciéndose pasar por receta.
 *
 * NADA SE GUARDA. Igual que `perfilCalculado`: se recalcula desde el crudo de
 * la encuesta cada vez, así una fórmula corregida arregla sola los perfiles
 * viejos.
 */

/** Por debajo de esto el motor energético ya aplica factor 1,2 (sedentario). */
export const PISO_PASOS = 8000
/** Tope de NEAT: más allá deja de sumar y empieza a competir con la recuperación. */
export const TOPE_PASOS = 12000
/** Lo máximo que se le sube a alguien de una semana a la otra. */
export const RAMPA_SEMANAL = 2000

export type FaseDelBloque =
  | 'deficit-agresivo'
  | 'deficit'
  | 'mantenimiento'
  | 'recomposicion'
  | 'superavit'
  | 'reingreso'

/** Banda objetivo por contexto. El gasto es la palanca antes de recortar comida. */
const BANDA: Record<FaseDelBloque, number> = {
  'deficit-agresivo': 11000,
  deficit: 10000,
  recomposicion: 9000,
  mantenimiento: PISO_PASOS,
  superavit: PISO_PASOS,
  // Reingreso, patología o lesión: se entra por debajo del piso a propósito.
  reingreso: 7000,
}

export interface ValorConOrigen<T> {
  valor: T
  /** `coach` = lo prescribió él. `calculado` = sale de la encuesta. */
  origen: 'coach' | 'calculado'
}

export interface PautaDelBloque {
  faseEnergetica?: ValorConOrigen<string>
  proteinaGkg?: ValorConOrigen<number>
  pasosObjetivo?: ValorConOrigen<number>
}

const numero = (v: unknown): number | null => {
  // `Number(null)` es 0, no NaN: sin este guarda, "no contestó" se convertía en
  // "cero pasos" y de ahí salía un objetivo para alguien de quien no sabemos nada.
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Objetivo de pasos de ESTA semana, no del bloque.
 *
 * A quien está lejos de su banda no se le pone la banda: se le pone el
 * siguiente escalón. Un objetivo que triplica lo que la persona hace hoy no se
 * cumple, y un objetivo que no se cumple enseña a ignorar los objetivos.
 */
export function pasosObjetivoDe(
  pasosActuales: number | null | undefined,
  fase: FaseDelBloque,
): number | undefined {
  const actuales = numero(pasosActuales)
  if (actuales === null || actuales < 0) return undefined

  const meta = Math.min(BANDA[fase], TOPE_PASOS)
  if (actuales >= meta) return Math.min(Math.max(actuales, meta), TOPE_PASOS)

  const siguiente = Math.min(actuales + RAMPA_SEMANAL, meta)
  return Math.round(siguiente / 500) * 500
}

/** Proteína en g/kg a partir de lo que la encuesta ya sabe de la persona. */
export function proteinaGkgDe(respuestas: Respuestas, hoyIso: string): number | undefined {
  const peso = numero(respuestas.pesoKg)
  if (peso === null || peso <= 0) return undefined
  const calculado = calcularPerfil(respuestas, hoyIso)
  const prote = calculado.macros?.proteinaG
  if (prote === undefined || prote === null) return undefined
  return Math.round((prote / peso) * 10) / 10
}

export function pautaDelBloque(
  perfil: Perfil | undefined,
  respuestas: Respuestas | undefined,
  fase: FaseDelBloque,
  hoyIso: string,
): PautaDelBloque {
  const salida: PautaDelBloque = {}

  // La fase NO se deduce: es la única de las tres que no sale de la encuesta.
  // `fase` entra aquí solo para elegir la banda de pasos. Etiquetar como
  // "Mantenimiento" a quien está en déficit sería peor que no decir nada.
  if (perfil?.faseEnergetica) {
    salida.faseEnergetica = { valor: perfil.faseEnergetica, origen: 'coach' }
  }

  if (perfil?.proteinaGkg !== undefined) {
    salida.proteinaGkg = { valor: perfil.proteinaGkg, origen: 'coach' }
  } else if (respuestas) {
    const g = proteinaGkgDe(respuestas, hoyIso)
    if (g !== undefined) salida.proteinaGkg = { valor: g, origen: 'calculado' }
  }

  if (perfil?.pasosObjetivo !== undefined) {
    salida.pasosObjetivo = { valor: perfil.pasosObjetivo, origen: 'coach' }
  } else if (respuestas) {
    const p = pasosObjetivoDe(numero(respuestas.pasosDiarios), fase)
    if (p !== undefined) salida.pasosObjetivo = { valor: p, origen: 'calculado' }
  }

  return salida
}
