// Rutas con «.ts»: este módulo lo importa la Edge Function `praxis-charla` (Deno).

/**
 * Limpiador por VOCABULARIO PERMITIDO de la charla con DeepSeek (decisión del dueño, 11-nov, tras el informe del custodio).
 * PURO: sin red ni base.
 *
 * Los patrones de `limpiador.ts` reconocen cosas (un correo, un peso, un nombre de la lista); lo que no reconocen pasa.
 * Aquí se invierte: solo SALE lo que está en un conjunto cerrado de palabras (las de las piezas aprobadas + español común).
 * Todo lo demás (un nombre en minúscula, un barrio, un apellido, un correo dictado) pasa a «[…]», colapsando repeticiones.
 * Falla seguro: una palabra rara de verdad se pierde, un dato personal no sale.
 *
 * Qué se conserva: palabras del vocabulario (sin mayúsculas ni tildes: la frase sale normalizada), números de una o dos cifras
 * (también «3x10»), las marcas del limpiador de patrones ([PESO], [NOMBRE]…) y la puntuación básica ¿ ? ¡ ! . , ; : ( ).
 * Cualquier otro símbolo se descarta.
 *
 * LÍMITES, y no se disimulan:
 *  - Un dato personal hecho SOLO de palabras del vocabulario («vivo con mi mamá y mi hermano») pasa: el vocabulario no entiende
 *    de significado. Un nombre que sea además palabra de una pieza (apellido de un autor citado) también pasa, salvo los de
 *    `NOMBRES_COMUNES`, que se excluyen al armar el vocabulario.
 *  - Los números de una o dos cifras pasan («tengo 30» sin «años» no lo reconocen los patrones).
 *  - El texto que sale puede perder sentido; el costo se mide en la prueba y se reporta en el PR.
 */
export const MARCA_TAPADO = '[…]'

/** Minúsculas y sin tildes (la ñ queda como n, igual de los dos lados). */
export const normalizarPalabra = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const NUMERO_CORTO = /^\d{1,2}(?:x\d{1,2})?$/
const PUNTUACION = new Set(['¿', '?', '¡', '!', '.', ',', ';', ':', '(', ')'])
// palabra o número (letras y dígitos), marca [..], espacio, o cualquier otro carácter suelto
const PIEZAS = /[\p{L}\p{N}]+|\[[^\]]*\]|\s+|./gu

/** Deja solo el vocabulario permitido; lo demás, «[…]» (una sola marca por racha). */
export function soloVocabulario(frase: string, vocab: ReadonlySet<string>): string {
  let salida = ''
  let ultimoTapado = false
  const tapar = (): void => {
    if (!ultimoTapado) salida += MARCA_TAPADO
    ultimoTapado = true
  }
  for (const m of frase.matchAll(PIEZAS)) {
    const t = m[0]
    if (/^\s+$/u.test(t)) {
      salida += ' '
      continue
    }
    if (/^[\p{L}\p{N}]+$/u.test(t)) {
      const n = normalizarPalabra(t)
      if (vocab.has(n) || NUMERO_CORTO.test(n)) {
        salida += n
        ultimoTapado = false
      } else tapar()
    } else if (t.length > 1 && t.startsWith('[') && t.endsWith(']')) {
      if (t === MARCA_TAPADO) tapar()
      else {
        salida += t
        ultimoTapado = false
      }
    } else if (PUNTUACION.has(t)) {
      salida += t
      ultimoTapado = false
    }
    // cualquier otro símbolo (@ # / emojis…) se descarta
  }
  return salida
    .replace(/\s+/g, ' ')
    .replace(/\s+([?!.,;:)])/g, '$1')
    .replace(/([¿¡(])\s+/g, '$1')
    .trim()
}

/** Los campos de una pieza que alimentan el vocabulario (los mismos que ve la persona). */
const CAMPOS_DE_PIEZA = ['pregunta_que_responde', 'contexto', 'respuesta', 'de_que_depende', 'estudios', 'criterio_de_practica'] as const
export type PiezaParaVocabulario = Partial<Record<(typeof CAMPOS_DE_PIEZA)[number], unknown>>

/** Palabras (solo letras, sin cifras) de un texto, normalizadas. */
const palabrasDe = (texto: string): string[] => (texto.match(/\p{L}+/gu) ?? []).map(normalizarPalabra)

/**
 * Arma el vocabulario: palabras de los campos de las piezas + palabras comunes, SIN las que sean nombre de persona
 * (`nombres`), ordenado y sin repetidos. De una letra solo entran las que ya están en `comunes` (a, y, o, e, u).
 */
export function armarVocabulario(piezas: readonly PiezaParaVocabulario[], comunes: readonly string[], nombres: readonly string[]): string[] {
  const conjunto = new Set<string>()
  for (const pieza of piezas) {
    for (const campo of CAMPOS_DE_PIEZA) {
      const v = pieza[campo]
      const texto = Array.isArray(v) ? v.filter((x) => typeof x === 'string').join(' ') : typeof v === 'string' ? v : ''
      for (const p of palabrasDe(texto)) if (p.length >= 2) conjunto.add(p)
    }
  }
  for (const c of comunes) for (const p of palabrasDe(c)) conjunto.add(p)
  for (const n of nombres) for (const p of palabrasDe(n)) conjunto.delete(p)
  return [...conjunto].sort()
}
