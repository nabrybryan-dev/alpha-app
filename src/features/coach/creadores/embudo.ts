import type { Candidato, Carril, EventoCarril } from '../../../data/consola/creadores'

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
 *   · Contactados: PERSONAS a las que alguna vez se les escribió (E-05, segunda vuelta de la
 *     revisión de Codex del 28-sep). Sale de la historia (`creadores_eventos`: algún evento
 *     con un carril del mensaje en adelante) unida al carril de hoy, así que un contactado
 *     que después se descarta sigue contando. Sin la historia (no se pudo leer o aún no
 *     llega), la cifra es desconocida (`null`), no el estado de hoy disfrazado de total.
 *   · Entrenadores: el SEGMENTO de alquiler (E-05), sea cual sea su carril: un entrenador en
 *     pausa sigue siendo entrenador.
 */
export interface Embudo {
  enTablero: number
  esperanVideo: number
  tambaleando: number
  /** `null` = la historia no se pudo leer: la cifra no se conoce. */
  contactados: number | null
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

/** `eventos` = la historia de carriles; `null` si no se pudo leer. */
export function embudoDe(candidatos: readonly Candidato[], eventos: readonly EventoCarril[] | null): Embudo {
  const en = (carril: Carril) => candidatos.filter((c) => c.carril === carril).length
  let contactados: number | null = null
  if (eventos !== null) {
    const personas = new Set<string>()
    for (const c of candidatos) if (CONTACTADOS.includes(c.carril)) personas.add(c.creadorId)
    for (const e of eventos) if (CONTACTADOS.includes(e.carrilNuevo)) personas.add(e.creadorId)
    contactados = personas.size
  }
  return {
    enTablero: candidatos.length,
    esperanVideo: en('etapa2'),
    tambaleando: en('tambaleando'),
    contactados,
    entrenadores: candidatos.filter((c) => c.segmento === 'entrenador' || c.carril === 'entrenador').length,
  }
}
