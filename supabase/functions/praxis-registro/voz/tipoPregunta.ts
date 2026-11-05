/**
 * TIPO DE PREGUNTA, sin modelo (paso 2 del diseño DISENO-PASO-A-FUNCION-20261104.md).
 *
 * Port literal de `tipo_de` y de la tabla `CAMPOS` de `busqueda-mejora/tono-ronda3/medir_tono.py`, que es con lo que
 * se midió el tono aprobado. El `\b` de Python reconoce letras con tilde y el de JavaScript no: aquí el borde de
 * palabra se escribe con `\p{L}` para que se comporte igual. La paridad se prueba sobre las 40 preguntas de la ronda 3
 * (`paridad-tipo.json`, generado con el script de Python): cero desacuerdos (caso 9 del criterio firmado).
 */

export type TipoPregunta = 'razon' | 'como' | 'cantidad_o_momento' | 'definicion' | 'mi_caso'

export type CampoConcepto = 'respuesta' | 'de_que_depende' | 'estudios' | 'criterio_de_practica'

const B = '(?<![\\p{L}\\p{N}_])' // borde de palabra al inicio, como el \b de Python
const E = '(?![\\p{L}\\p{N}_])' // borde de palabra al final
const re = (fuente: string) => new RegExp(fuente.replaceAll('\\b<', B).replaceAll('>\\b', E), 'u')

const RAZON = re('\\b<(por qu[eé]|porque|en qu[eé] se basa|para qu[eé] sirve|a qu[eé] se debe|qu[eé] sustenta|por cu[aá]l raz[oó]n|c[oó]mo es que|por qu)')
const COMO = re('\\b<c[oó]mo>\\b')
const CANTIDAD = re('\\b<(cu[aá]nto|cu[aá]ntos|cu[aá]ntas|cu[aá]ndo|cada cu[aá]nto|cu[aá]nta)>\\b')
const DEFINICION = re('\\b<(qu[eé] es|qu[eé] son|en qu[eé] consiste|qu[eé] significa|a qu[eé] se refiere|qu[eé] quiere decir)>\\b')

export function tipoDePregunta(frase: string): TipoPregunta {
  const f = frase.toLowerCase().replace(/[¿?¡!.,;:]/g, ' ').split(/\s+/).filter(Boolean).join(' ')
  if (RAZON.test(f)) return 'razon'
  if (COMO.test(f)) return 'como'
  if (CANTIDAD.test(f)) return 'cantidad_o_momento'
  if (DEFINICION.test(f)) return 'definicion'
  return 'mi_caso'
}

/** Qué campos del concepto recibe el redactor según el tipo (mismo orden que en `medir_tono.py`). */
export const CAMPOS_POR_TIPO: Record<TipoPregunta, CampoConcepto[]> = {
  razon: ['estudios', 'criterio_de_practica', 'de_que_depende', 'respuesta'],
  cantidad_o_momento: ['respuesta', 'de_que_depende', 'criterio_de_practica'],
  definicion: ['respuesta', 'de_que_depende', 'criterio_de_practica'],
  mi_caso: ['respuesta', 'de_que_depende', 'criterio_de_practica'],
  como: ['respuesta', 'de_que_depende', 'criterio_de_practica'],
}
