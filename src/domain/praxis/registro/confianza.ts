/**
 * Confianza por campo (DISENO §3.6). La calcula el CÓDIGO a partir de señales
 * observables; el modelo nunca da confianza. La del registro es la mínima de sus
 * campos.
 */
import type { Confianza } from './tipos.ts'

const ORDEN: Record<Confianza, number> = { baja: 0, media: 1, alta: 2 }

/** La menor de las confianzas dadas. Sin argumentos, `alta`. */
export function minConfianza(...cs: (Confianza | undefined | null)[]): Confianza {
  let peor: Confianza = 'alta'
  for (const c of cs) if (c && ORDEN[c] < ORDEN[peor]) peor = c
  return peor
}

export type SenalConfianza =
  | 'aproximado'
  | 'copiado'
  | 'del_perfil'
  | 'ejercicio_inferido'
  | 'no_recuerda'
  | 'maximo_o_minimo'
  | 'recortado'
  | 'medida_no_verificada'

/** Reglas de §3.6 en una sola tabla: cada señal impone un tope. */
const TOPE: Record<SenalConfianza, Confianza> = {
  aproximado: 'media',
  copiado: 'media',
  del_perfil: 'media',
  ejercicio_inferido: 'media',
  no_recuerda: 'baja',
  maximo_o_minimo: 'baja',
  recortado: 'baja',
  medida_no_verificada: 'baja',
}

export function confianzaDe(senales: readonly SenalConfianza[]): Confianza {
  return minConfianza(...senales.map((s) => TOPE[s]))
}
