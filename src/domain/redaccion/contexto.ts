/**
 * El CONTEXTO que lee el modelo, sin una sola cifra a la vista.
 *
 * El 12-sep, la primera tanda real de la revisión larga rechazó los tres borradores de la
 * primera persona, y la culpa no era del modelo: el contexto que se le daba decía «del
 * microciclo cerrado (M23)» y «cardio compartido, 2 h», y la regla es que el modelo no
 * escribe cifras. Le estábamos poniendo delante lo que tenía prohibido decir.
 *
 * Aquí se arregla en origen, con dos pasos puros:
 *   1. las etiquetas de microciclo pasan a palabras («el microciclo pasado», «el siguiente»),
 *      relativas al microciclo activo de la persona;
 *   2. toda cifra que quede pasa a ser un HUECO con su valor dicho en voz alta
 *      («−15 %» → «menos 15 por ciento»), así que el modelo puede nombrarla sin escribirla y
 *      `revisarBorrador` la pone en su sitio, igual que las de la ficha.
 *
 * Nada muta: cada función devuelve un texto nuevo y huecos nuevos.
 */

import type { Huecos } from './huecos'

/** «M23», «M21-M22» → palabras, relativas al microciclo activo. */
export function microciclosEnPalabras(texto: string, activo: number | null): string {
  return texto.replace(/\bM(\d+)(?:\s*[-–]\s*M(\d+))?\b/g, (_trozo, a: string, b?: string) => {
    if (b !== undefined) return 'los últimos microciclos'
    if (activo === null) return 'un microciclo'
    const n = Number(a)
    if (n === activo) return 'el microciclo actual'
    if (n === activo - 1) return 'el microciclo pasado'
    if (n === activo + 1) return 'el microciclo siguiente'
    return n < activo ? 'un microciclo anterior' : 'un microciclo más adelante'
  })
}

const UNIDAD_HABLADA: Record<string, string> = {
  '%': 'por ciento',
  kcal: 'kilocalorías',
  kg: 'kilos',
  cm: 'centímetros',
  min: 'minutos',
  h: 'horas',
  g: 'gramos',
}

const CIFRA = /([−-]?)(\d+(?:[.,]\d+)?)(?:\s*(%|kcal|kg|cm|min|h|g)(?![a-záéíóúñ]))?/gi

export interface ContextoConHuecos {
  texto: string
  huecos: Huecos
}

/**
 * Cambia cada cifra de `texto` por un hueco `{prefijo_N}` cuyo valor es la cifra dicha en voz
 * alta. `significa` explica al modelo de dónde sale, sin cifras.
 */
export function cifrasEnHuecos(texto: string, prefijo: string, significa: string): ContextoConHuecos {
  const huecos: Huecos = {}
  let n = 0
  const resultado = texto.replace(CIFRA, (_trozo, signo: string, numero: string, unidad?: string) => {
    n += 1
    const clave = `${prefijo}_${n}`
    const dicha = unidad ? ` ${UNIDAD_HABLADA[unidad.toLowerCase()]}` : ''
    huecos[clave] = { valor: `${signo ? 'menos ' : ''}${numero}${dicha}`, significa }
    return `{${clave}}`
  })
  return { texto: resultado, huecos }
}

const MESES = 'ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic'
const ANOTACION = new RegExp(`\\s*\\([^()]*\\b\\d{1,2}-(?:${MESES})[a-z]*\\b[^()]*\\)`, 'gi')

/**
 * Quita lo que es del COACH y no de la persona: la anotación de autor y fecha de una fila
 * («(Bryan, 12-sep)») y el número de una regla («1. »). El 12-sep, con la anotación convertida
 * en hueco, el modelo dijo «estaré con vosotros el 12 de septiembre», que es falso; y con los
 * números de regla leyó «también olvidas 2:».
 */
export function sinAnotaciones(texto: string): string {
  return texto.replace(ANOTACION, '').replace(/^\s*\d+\.\s*/, '')
}

/** Los tres pasos seguidos: sin anotaciones, microciclos en palabras y cifras en huecos. */
export function contextoSinCifras(
  texto: string,
  prefijo: string,
  significa: string,
  activo: number | null,
): ContextoConHuecos {
  return cifrasEnHuecos(microciclosEnPalabras(sinAnotaciones(texto), activo), prefijo, significa)
}
