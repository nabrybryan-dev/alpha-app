import { PATRON_POR_ID, type Patron } from './catalogo'
import type { ItemMarcable } from '../types'

/**
 * QUÉ SUJETO LE TOCA A UN BLOQUE DE CARDIO.
 *
 * El cardio no es un ejercicio: en la base vive en `sesion.bloquesCardio`, que son textos
 * —título, indicaciones, minutos—. Medido el 2026-09-07 sobre los microciclos activos: 44
 * bloques en 26 sesiones, y buena parte NO son cardio (notas del coach, pasos diarios,
 * estiramientos, propiocepción). Así que la modalidad hay que leerla del texto, y un bloque
 * que no nombre ninguna se queda sin sujeto, que es lo correcto.
 *
 * Lo pidió Bryan ese día: «integrar ejercicios de la parte de actividad cardiovascular en
 * las diferentes sesiones». Revierte su decisión anterior de dejar el cardio sin sujeto,
 * escrita en `SalonSinSujeto.tsx`; ahí queda anotado el cambio.
 *
 * ## El orden importa, y por qué
 *
 * «Bicicleta o caminadora» nombra dos modalidades: gana la primera de la lista, no la
 * primera del texto, porque la lista va de la más específica a la más general. Y la
 * carrera va después de la cinta a propósito: «40 min caminadora velocidad 6-7» no es
 * correr aunque diga velocidad, y «carrera en cinta» es correr EN la cinta, que es la ficha
 * de carrera —la cinta la pone la escena, no la ficha—.
 */
const MODALIDADES: readonly { patron: RegExp; id: string }[] = [
  { patron: /escaladora|stair|escaleras/, id: 'escaladora' },
  { patron: /el[ií]ptica|elliptical/, id: 'eliptica' },
  { patron: /bici|bicicleta|ciclo|spinning|rodillo|pedale/, id: 'bicicleta_estatica' },
  { patron: /carrera|correr|corre\b|trote|trotar|running|intervalos? de carrera|sprint/, id: 'carrera_en_cinta' },
  { patron: /caminadora|cinta|caminata|caminar|andar|marcha|liss|zona 2|treadmill/, id: 'caminata_en_cinta' },
]

/** Sin tildes ni mayúsculas, como el resto del enrutado por nombre. */
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * La ficha del bloque, o `undefined` si el texto no nombra ninguna modalidad.
 *
 * Se mira el título primero y las indicaciones después, y el título manda: «Zona 2 · 30
 * min» con «caminadora en pendiente, bici o elíptica» en las indicaciones es una zona 2, y
 * la zona 2 de esta casa se anda.
 */
export function patronDeBloque(bloque: Pick<ItemMarcable, 'titulo' | 'indicaciones'>): Patron | undefined {
  const titulo = normalizar(bloque.titulo ?? '')
  const enTitulo = MODALIDADES.find((m) => m.patron.test(titulo))?.id
  if (enTitulo) return PATRON_POR_ID[enTitulo]
  // «PASOS: 10.000 AL DÍA» no ocurre en el salón: es el NEAT del día, y sus indicaciones
  // dicen «caminatas cortas» por la calle. Si el título va de pasos y no nombra modalidad,
  // las indicaciones no se leen. «35 min escaladora + 10.000 pasos/día» sí tiene sujeto:
  // la escaladora está en el título.
  if (/\bpasos\b/.test(titulo)) return undefined
  const indicaciones = normalizar(bloque.indicaciones ?? '')
  const enIndicaciones = MODALIDADES.find((m) => m.patron.test(indicaciones))?.id
  return enIndicaciones ? PATRON_POR_ID[enIndicaciones] : undefined
}

/** El primer bloque de la sesión que tenga sujeto, si alguno. Para el salón. */
export function patronDeLosBloques(bloques: readonly Pick<ItemMarcable, 'titulo' | 'indicaciones'>[] | undefined): Patron | undefined {
  for (const b of bloques ?? []) {
    const p = patronDeBloque(b)
    if (p) return p
  }
  return undefined
}
