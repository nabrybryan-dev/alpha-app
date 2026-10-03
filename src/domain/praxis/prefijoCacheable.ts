/**
 * ¿Vale la pena pedir caché del prefijo? (puro, sin red)
 *
 * La caché de prompts de Anthropic solo guarda un prefijo que llegue al mínimo del modelo:
 * 4.096 tokens para Claude Haiku 4.5 (documentación oficial, «Prompt caching», sección
 * «Cache limitations», consultada el 2-oct-2026). Por debajo, `cache_control` no hace nada:
 * no falla ni cachea, solo da la impresión de que se está ahorrando. Por eso se pone el
 * marcador únicamente cuando el prefijo lo supera con holgura.
 *
 * El prefijo se arma en este orden: `tools`, `system`, `messages` y llega hasta el bloque
 * marcado. Con herramientas, las herramientas cuentan para el mínimo.
 *
 * No hay contador de tokens aquí: se aproxima a 3,5 caracteres por token (el español con
 * JSON da entre 3 y 3,5; con 3,5 el cálculo sale por abajo y no promete caché que no habría).
 */
export const MINIMO_CACHEABLE_HAIKU_4_5 = 4096
export const CARACTERES_POR_TOKEN = 3.5

export function tokensAproximados(texto: string): number {
  return Math.ceil(texto.length / CARACTERES_POR_TOKEN)
}

export interface BloqueDeSistema {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}

/**
 * El bloque de sistema de una petición. `antes` es el texto de lo que va ANTES en el prefijo
 * (las herramientas, serializadas), porque cuentan para llegar al mínimo.
 */
export function bloqueDeSistema(texto: string, antes = ''): BloqueDeSistema {
  const bloque: BloqueDeSistema = { type: 'text', text: texto }
  if (tokensAproximados(antes + texto) >= MINIMO_CACHEABLE_HAIKU_4_5) bloque.cache_control = { type: 'ephemeral' }
  return bloque
}
