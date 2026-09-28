import type { Candidato, Carril } from '../../../data/consola/creadores'

/**
 * Las cinco cifras del embudo de la bola de nieve (maqueta «Espacios de Alpha», 28-sep),
 * contadas sobre los carriles REALES de `creadores_candidatos`. Pura: no lee nada.
 *
 *   · Evaluados: todos los que el radar ya midió, o sea todos menos los recién descubiertos.
 *   · Esperan video: los que pasaron los números y esperan la revisión de la etapa 2.
 *   · Tambaleando: los que necesitan criterio humano con sonido.
 *   · Contactados: los que ya recibieron el mensaje, en cualquier paso posterior.
 *   · Entrenadores: el segmento de alquiler, que va aparte.
 *
 * Los descartados cuentan como evaluados (se midieron) y en nada más.
 */
export interface Embudo {
  evaluados: number
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
    evaluados: candidatos.filter((c) => c.carril !== 'descubierto').length,
    esperanVideo: en('etapa2'),
    tambaleando: en('tambaleando'),
    contactados: candidatos.filter((c) => CONTACTADOS.includes(c.carril)).length,
    entrenadores: en('entrenador'),
  }
}
