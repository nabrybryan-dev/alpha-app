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
  // El ergómetro el primero: «remo ergómetro» lleva la palabra remo, y el remo a secas es
  // un ejercicio de fuerza. Ver la misma nota en `catalogo.ts`.
  { patron: /erg[oó]metro|ergometro|remo ergom|remo indoor|concept ?2/, id: 'remo_ergometro' },
  { patron: /escaladora|stair|escaleras/, id: 'escaladora' },
  { patron: /el[ií]ptica|elliptical/, id: 'eliptica' },
  { patron: /bici|bicicleta|ciclo|spinning|rodillo|pedale/, id: 'bicicleta_estatica' },
  { patron: /carrera|correr|corre\b|trote|trotar|running|intervalos? de carrera|sprint/, id: 'carrera_en_cinta' },
  { patron: /caminadora|cinta|caminata|caminar|andar|marcha|liss|zona 2|treadmill/, id: 'caminata_en_cinta' },
]

/** Sin tildes ni mayúsculas, como el resto del enrutado por nombre. */
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * LOS GESTOS QUE NO SON CARDIO PERO SI SON MOVIMIENTO.
 *
 * Medido el 2026-09-10 sobre los microciclos activos: de 27 bloques distintos, TRECE se
 * quedaban sin muneco, y de esos, cinco no eran cardio ni eran notas del coach: eran
 * movilidad y propiocepcion, que es trabajo con gesto y que ademas YA TENIA FICHA en el
 * catalogo. No faltaba el dibujo; faltaba el camino desde el texto del bloque hasta el.
 *
 * ## Aqui manda el orden DEL TEXTO, y en las modalidades manda el de la lista
 *
 * Y no es una incoherencia. «Bicicleta o caminadora» son ALTERNATIVAS: se hace una de las
 * dos, asi que decide la lista, que va de lo mas especifico a lo mas general. «Cadera,
 * tobillo y toracica» es una SECUENCIA: se hacen las tres, y la primera del texto es por
 * donde se empieza, que es lo que hay que ensenar al abrir.
 *
 * El estiramiento global no entra: «10 min globales» no es un gesto, es un rato. Un muneco
 * ahi tendria que elegir uno de veinte estiramientos y ensenar el que nadie pidio.
 */
const GESTOS: readonly { patron: RegExp; id: string }[] = [
  // La propiocepcion de esta casa se prescribe como apoyo monopodal, y asi esta escrita en
  // los bloques: «Apoyo a una pierna, DERECHA PRIMERO».
  { patron: /propiocep|monopodal|una pierna|equilibrio|short foot/, id: 'apoyo_una_pierna' },
  { patron: /cadera/, id: 'rotacion_cadera' },
  { patron: /tobillo|dorsiflex/, id: 'dorsiflexion' },
  { patron: /toracica|dorsal|gato-camello|gato camello/, id: 'movilidad_toracica' },
]

/** Un bloque de movilidad que no diga que region: la toracica es la ficha generica. */
const MOVILIDAD = /movilidad/

/**
 * PALABRAS QUE DICEN QUE ESO NO PASA EN EL GIMNASIO.
 *
 * Sin ellas, «CARRERA CON TU HIJA - 5 km por la tarde» se dibujaba ENCIMA DE UNA CINTA. Son
 * cuatro bloques de la cartera real, y ninguno pisa una cinta: es una salida a correr.
 *
 * El resto se queda como estaba -con maquina- y es a proposito: el salon ES un gimnasio,
 * asi que sin ninguna pista lo que toca es la cinta. Lo que no puede pasar es dibujar una
 * maquina que el propio texto desmiente.
 */
const AL_AIRE = /\bkm\b|kilometro|al aire libre|a la calle|por la calle|parque|sendero|montana|exterior|afuera/

/**
 * La ficha del bloque, o `undefined` si el texto no nombra ningun gesto.
 *
 * Se mira el titulo primero y las indicaciones despues, y el titulo manda: «Zona 2 · 30
 * min» con «caminadora en pendiente, bici o eliptica» en las indicaciones es una zona 2, y
 * la zona 2 de esta casa se anda.
 */
export function patronDeBloque(bloque: Pick<ItemMarcable, 'titulo' | 'indicaciones'>): Patron | undefined {
  const titulo = normalizar(bloque.titulo ?? '')
  const indicaciones = normalizar(bloque.indicaciones ?? '')
  const todo = `${titulo} ${indicaciones}`

  const enTitulo = MODALIDADES.find((m) => m.patron.test(titulo))?.id
  if (enTitulo) return PATRON_POR_ID[alAireSiToca(enTitulo, todo)]

  // Los gestos van DESPUES de las modalidades del titulo y ANTES de leer las indicaciones:
  // «MOVILIDAD DINAMICA + CARDIO SUAVE» es un bloque de movilidad que menciona el cardio de
  // pasada, y lo que se hace ahi es la movilidad.
  const gesto = gestoDelTexto(titulo)
  if (gesto) return PATRON_POR_ID[gesto]
  if (MOVILIDAD.test(titulo)) return PATRON_POR_ID['movilidad_toracica']

  // «PASOS: 10.000 AL DIA» no ocurre en el salon: es el NEAT del dia, y sus indicaciones
  // dicen «caminatas cortas» por la calle. Si el titulo va de pasos y no nombra modalidad,
  // las indicaciones no se leen. «35 min escaladora + 10.000 pasos/dia» si tiene sujeto:
  // la escaladora esta en el titulo.
  if (/\bpasos\b/.test(titulo)) return undefined

  // LOS GESTOS SE LEEN SOLO DEL TITULO, y las modalidades tambien de las indicaciones.
  //
  // No es simetria rota, es lo medido: una NOTA del coach habla de movimientos sin ser uno.
  // «POR QUE HOY NO HAY CIRCUITO - leelo», cuyas indicaciones dicen «hoy caminas y trabajas
  // equilibrio», salia con muneco de apoyo monopodal: la nota EXPLICA el trabajo, no lo es.
  // Los cinco bloques de movilidad y propiocepcion de la cartera nombran su gesto en el
  // titulo, asi que leer las indicaciones no gana ninguno y cuela notas.
  const enIndicaciones = MODALIDADES.find((m) => m.patron.test(indicaciones))?.id
  return enIndicaciones ? PATRON_POR_ID[alAireSiToca(enIndicaciones, todo)] : undefined
}

/**
 * EL GESTO QUE VA PRIMERO EN EL TEXTO, no el primero de la lista.
 *
 * Y esto se escribio dos veces mal antes de quedar bien: la primera version recorria
 * `GESTOS` con un `find`, que es orden de LISTA, mientras el comentario de arriba prometia
 * orden de TEXTO. «MOVILIDAD: tobillo y cadera» devolvia cadera. Lo cazo su propia prueba,
 * no una lectura: por eso el caso con las dos regiones al reves esta escrito.
 */
function gestoDelTexto(texto: string): string | undefined {
  let mejor: { i: number; id: string } | undefined
  for (const g of GESTOS) {
    const encontrado = g.patron.exec(texto)
    if (encontrado && (!mejor || encontrado.index < mejor.i)) mejor = { i: encontrado.index, id: g.id }
  }
  return mejor?.id
}

/** Correr con la calle debajo es otra ficha: la misma zancada y ninguna cinta. */
function alAireSiToca(id: string, texto: string): string {
  return id === 'carrera_en_cinta' && AL_AIRE.test(texto) ? 'carrera_al_aire' : id
}

/** El primer bloque de la sesión que tenga sujeto, si alguno. Para el salón. */
export function patronDeLosBloques(bloques: readonly Pick<ItemMarcable, 'titulo' | 'indicaciones'>[] | undefined): Patron | undefined {
  for (const b of bloques ?? []) {
    const p = patronDeBloque(b)
    if (p) return p
  }
  return undefined
}
