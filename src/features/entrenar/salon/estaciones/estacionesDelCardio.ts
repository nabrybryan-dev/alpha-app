import type { ItemMarcable } from '../../../../domain/types'
import type { CifrasDelMuro } from '../../escena/sala'
import { ANGULOS, type EstacionDeLaSerie } from './estacionesDeLaSerie'

/**
 * LAS ESTACIONES DE UN DÍA DE CARDIO.
 *
 * ## Por qué esto hacía falta
 *
 * Desde el 2026-09-07 un bloque de cardio cuyo texto nombra la modalidad —caminata,
 * carrera, escaladora, bicicleta, elíptica, ergómetro— tiene sujeto y máquina en el centro,
 * y por eso deja de montarse la rama sin sujeto. Pero la prescripción del cardio vivía SOLO
 * en esa rama, colgada de los muros: al ganar el sujeto, el día metabólico se quedó con un
 * corredor y **ningún número en pantalla**. Medido en el navegador el 2026-09-10: cero
 * estaciones y el muro vacío, con treinta minutos y diez intervalos escritos en la sesión.
 *
 * Así que el cardio usa las mismas estaciones que la fuerza. No son otro sitio: son EL
 * sitio donde vive la prescripción desde que el salón existe.
 *
 * ## Por qué tres y no cuatro
 *
 * Porque de las cuatro de la fuerza —series, repeticiones, descanso, RIR— el cardio solo
 * tiene equivalentes con cifra para tres: cuántos minutos, en cuántos tramos, y a qué
 * intensidad **cuando está escrita**. Lo cuarto que un día de cardio tiene que decir es el
 * RITMO, y el ritmo es una frase —«ritmo conversacional, zancada corta»—, no un número: una
 * frase de sesenta caracteres en un cartel de 132 px con la cifra a 52 no es una estación,
 * es un párrafo flotando sobre el salón. Eso baja al panel, que es donde el kit manda lo
 * largo, y donde `RecuadroEjercicio` ya lo pinta entero.
 *
 * Una estación sin dato no se inventa: si la sesión no escribe intensidad, esa estación no
 * existe. Es la misma regla que ya seguía la rama sin sujeto —«no se inventa: si no está,
 * se dice que no está»—, solo que aquí, con el sujeto en el centro, callar es mejor que
 * plantar un poste que diga «sin zona escrita».
 */

/** La zona o el RPE, si están escritos. Copiado de ningún sitio: es la única definición. */
const ZONA = /\bzona\s*(\d+)|\bz([1-5])\b|\brpe\s*(\d+(?:[-–]\d+)?)/i

/**
 * La intensidad escrita, partida en rótulo y cifra.
 *
 * Se parte porque el cartel las pinta distinto —el rótulo a 10,5 px y la cifra a 52—, y
 * «RPE 8» entero a 52 px no cabe en los 132 px del cartel: saldría cortado o desbordando
 * sobre el sujeto, que es justo lo que el criterio 3 prohíbe.
 */
export function intensidadEscrita(texto: string): { rotulo: string; cifra: string } | undefined {
  const m = ZONA.exec(texto)
  if (!m) return undefined
  if (m[1]) return { rotulo: 'Zona', cifra: m[1] }
  if (m[2]) return { rotulo: 'Zona', cifra: m[2] }
  return { rotulo: 'RPE', cifra: m[3] }
}

/**
 * Lo que dicen las estaciones de un día de cardio.
 *
 * @param bloques Los bloques de la sesión que se está mirando. Los que no traen minutos
 *   cuentan igual como tramo: un bloque sin `duracionMin` es trabajo escrito por el coach
 *   al que le falta el dato, no un bloque que no existe.
 */
export function estacionesDelCardio(
  bloques: readonly ItemMarcable[] | undefined,
): EstacionDeLaSerie[] {
  if (!bloques || bloques.length === 0) return []

  const minutos = bloques.reduce((t, b) => t + (b.duracionMin ?? 0), 0)
  const intensidad = intensidadEscrita(
    bloques.flatMap((b) => [b.titulo, b.indicaciones]).filter(Boolean).join(' '),
  )

  const estaciones: EstacionDeLaSerie[] = []
  if (minutos > 0) {
    estaciones.push({
      clave: 'minutos',
      angulo: ANGULOS.minutos,
      rotulo: 'Minutos',
      cifra: String(minutos),
      pie: 'de trabajo en total',
    })
  }
  estaciones.push({
    clave: 'tramos',
    angulo: ANGULOS.tramos,
    rotulo: 'Tramos',
    cifra: String(bloques.length),
    pie: bloques.length === 1 ? 'bloque continuo' : 'bloques, en este orden',
  })
  if (intensidad) {
    estaciones.push({
      clave: 'intensidad',
      angulo: ANGULOS.intensidad,
      rotulo: intensidad.rotulo,
      cifra: intensidad.cifra,
      pie: 'la intensidad escrita',
    })
  }
  return estaciones
}

/**
 * LO QUE MARCA EL MURO UN DÍA DE CARDIO.
 *
 * Las mismas tres preguntas que un día de hierro, con otra ropa: cuántas veces (tramos),
 * cuánto cada vez (minutos) y con cuánto esfuerzo (RPE o zona). El marcador del muro no
 * lleva rótulos —son cifras de siete segmentos, como en un pabellón—, así que no hay que
 * enseñarle palabras nuevas a nadie: quien miró el muro el martes lo entiende el sábado.
 *
 * Sin intensidad escrita, la tercera casilla se queda **apagada**. Un cero ahí diría «RIR
 * 0», que en esta casa es otra cosa, y un dato que el coach no escribió no se inventa.
 */
export function cifrasDelCardio(bloques: readonly ItemMarcable[] | undefined): CifrasDelMuro | undefined {
  if (!bloques || bloques.length === 0) return undefined
  const minutos = bloques.reduce((t, b) => t + (b.duracionMin ?? 0), 0)
  const intensidad = intensidadEscrita(
    bloques.flatMap((b) => [b.titulo, b.indicaciones]).filter(Boolean).join(' '),
  )
  // La zona y el RPE son de una cifra por definición; un rango escrito («RPE 7-8») se
  // queda con el techo, que es el que manda el esfuerzo del bloque.
  const esfuerzo = intensidad ? Number(intensidad.cifra.split(/[-–]/).pop()) : undefined
  return { veces: bloques.length, cuanto: minutos, esfuerzo }
}
