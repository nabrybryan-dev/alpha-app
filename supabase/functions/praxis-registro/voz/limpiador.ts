/**
 * LIMPIADOR de nombres y teléfonos (decisión 5 de Bryan, 4-nov-2026): a DeepSeek va la pregunta del equipo SIN nombres
 * ni teléfonos. Sin modelo y sin red. Falla hacia quitar de más: una palabra de más reemplazada empeora la pregunta,
 * un nombre que se escapa sale de la casa.
 *
 * Tres reglas para nombres, una para teléfonos:
 * 1. Nombres conocidos (la lista la pasa quien llama; en la función, los nombres de pila del equipo y de los
 *    asesorados): se quitan en cualquier posición, con o sin mayúscula ni tilde.
 * 2. Palabra con mayúscula inicial que NO abre la oración: se toma como nombre, salvo siglas en mayúscula (RIR) y las
 *    marcas propias (Alpha, Praxis).
 * 3. La palabra que sigue a un tratamiento (Sr., Sra., Dr., Dra., don, doña) es nombre aunque abra oración.
 * Teléfono: un tramo de dígitos con espacios, guiones, puntos o paréntesis que sume 7 dígitos o más.
 *
 * Límite declarado: un nombre que abre la oración y no está en la lista NO se quita (no hay forma de distinguir
 * «Carolina pregunta» de «Sentadilla pesada» sin diccionario). Por eso la lista de nombres conocidos es obligatoria.
 */

export const MARCA_NOMBRE = '[nombre]'
export const MARCA_TELEFONO = '[teléfono]'

const PERMITIDAS = new Set(['alpha', 'praxis'])
const TRATAMIENTOS = new Set(['sr', 'sra', 'srta', 'dr', 'dra', 'don', 'dona'])
const PALABRA = /[\p{L}][\p{L}'-]*/gu
const TELEFONO = /\+?\d[\d\s().-]*\d/g

export function sinTildes(t: string): string {
  return t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function quitarTelefonos(texto: string): { texto: string; quitados: number } {
  let quitados = 0
  const limpio = texto.replace(TELEFONO, (tramo) => {
    if ((tramo.match(/\d/g) ?? []).length < 7) return tramo
    quitados++
    return MARCA_TELEFONO
  })
  return { texto: limpio, quitados }
}

/** ¿La palabra que empieza en `i` abre oración? (inicio del texto o después de . ? ! ¿ ¡, saltando espacios). */
function abreOracion(texto: string, i: number): boolean {
  const antes = texto.slice(0, i).trimEnd()
  return antes === '' || /[.?!¿¡:]$/u.test(antes)
}

export function limpiarPregunta(texto: string, nombresConocidos: readonly string[] = []): { texto: string; quitados: number } {
  const tel = quitarTelefonos(texto)
  const conocidos = new Set(nombresConocidos.map(sinTildes).filter((n) => n.length >= 2))
  let quitados = tel.quitados
  let anterior = ''
  const limpio = tel.texto.replace(PALABRA, (palabra, i: number, todo: string) => {
    const llave = sinTildes(palabra)
    const tratamientoAntes = TRATAMIENTOS.has(anterior)
    anterior = llave
    const mayusculaInicial = /^\p{Lu}\p{Ll}/u.test(palabra)
    const esNombre =
      conocidos.has(llave) ||
      tratamientoAntes ||
      (mayusculaInicial && !PERMITIDAS.has(llave) && !TRATAMIENTOS.has(llave) && !abreOracion(todo, i))
    if (!esNombre) return palabra
    quitados++
    return MARCA_NOMBRE
  })
  return { texto: limpio, quitados }
}
