import type { Candidato, Carril } from '../../../data/consola/creadores'

/**
 * Las cinco cifras del embudo de la bola de nieve (maqueta «Espacios de Alpha», 28-sep),
 * contadas sobre los carriles REALES de `creadores_candidatos`. Pura: no lee nada.
 *
 *   · Candidatos en el tablero: todas las filas que subió el importador. NO es «todo lo que
 *     el radar evaluó»: el importador deja fuera a los descartados con A < 50 (E-04 de la
 *     revisión de Codex del 28-sep), así que llamarlo «evaluados» prometía un universo
 *     que el tablero no tiene.
 *   · Esperan video: los que pasaron los números y esperan la revisión de la etapa 2.
 *   · Tambaleando: los que necesitan criterio humano con sonido.
 *   · Contactados: los que HOY están en un paso posterior al mensaje. Es el estado actual:
 *     un contactado que termina descartado deja de contar (la historia vive en
 *     `creadores_eventos`, que esta pantalla aún no lee).
 *   · Entrenadores: el SEGMENTO de alquiler (E-05), sea cual sea su carril: un entrenador en
 *     pausa sigue siendo entrenador.
 */
export interface Embudo {
  enTablero: number
  esperanVideo: number
  tambaleando: number
  contactados: number
  entrenadores: number
}

const CONTACTADOS: readonly Carril[] = [
  'mensaje_enviado',
  'respondio',
  'no_respondio',
  'encuesta',
  'microprueba',
  'piloto',
  'continua',
  'pausa',
]

export function embudoDe(candidatos: readonly Candidato[]): Embudo {
  const en = (carril: Carril) => candidatos.filter((c) => c.carril === carril).length
  return {
    enTablero: candidatos.length,
    esperanVideo: en('etapa2'),
    tambaleando: en('tambaleando'),
    contactados: candidatos.filter((c) => CONTACTADOS.includes(c.carril)).length,
    entrenadores: candidatos.filter((c) => c.segmento === 'entrenador' || c.carril === 'entrenador').length,
  }
}
