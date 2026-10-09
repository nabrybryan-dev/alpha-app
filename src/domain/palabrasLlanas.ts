/**
 * Las mismas cosas, dichas sin la palabra técnica, para quien tiene la vista simple
 * (`perfil.vistaSimple`, pedida por Bryan el 8-oct-2026 para asesorados a quienes les cuesta
 * la tecnología).
 *
 * POR QUÉ UN ARCHIVO. La vista simple reescribió dos pantallas (la lista de la semana y la de
 * comidas), pero la persona sigue pasando por Hoy y por la sesión, que decían «Microciclo M11»,
 * «Sets» y «RIR». Si cada pantalla traduce por su cuenta, acaban diciendo cosas distintas para
 * lo mismo; aquí se decide una sola vez.
 *
 * Con `simple = false` cada función devuelve EXACTAMENTE lo que la pantalla decía antes: nadie
 * que no tenga la vista simple ve un cambio.
 */

/** «Microciclo M11» → «Semana 11». Es el mismo número que titula la lista sencilla. */
export function nombreDelMicrociclo(numero: number, simple: boolean): string {
  return simple ? `Semana ${numero}` : `Microciclo M${numero}`
}

/** La forma corta que va pegada a otra frase: «M11» → «semana 11». */
export function siglaDelMicrociclo(numero: number, simple: boolean): string {
  return simple ? `semana ${numero}` : `M${numero}`
}

/** La palabra suelta, para frases como «tu siguiente microciclo». */
export function palabraMicrociclo(simple: boolean): string {
  return simple ? 'semana' : 'microciclo'
}

/** «Sets» → «Series»: es la misma palabra que ya usa la tabla de lo registrado. */
export function etiquetaSets(simple: boolean): string {
  return simple ? 'Series' : 'Sets'
}

/**
 * «RIR» (repeticiones en reserva) → «Te sobran»: cuántas repeticiones más habría podido hacer.
 * Es lo que el número significa, sin la sigla.
 */
export function etiquetaRir(simple: boolean): string {
  return simple ? 'Te sobran' : 'RIR'
}

/** El objetivo dentro de una frase: «RIR 2» → «que te sobren 2». */
export function fraseRir(rir: number | string, simple: boolean): string {
  return simple ? `que te sobren ${rir}` : `RIR ${rir}`
}
