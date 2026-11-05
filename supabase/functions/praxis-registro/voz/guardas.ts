/**
 * GUARDAS DE SCRIPT sobre la redacción (paso 4 del diseño; caso 5 del criterio firmado). Rechazan antes de gastar al
 * segundo lector. Las expresiones de voseo y muletillas son las de `tono-ronda3/puntuar_tono.py` (las que midieron el
 * tono aprobado); el borde de palabra va con `\p{L}` para comportarse como el `\b` de Python.
 */
import { sinTildes } from './limpiador.ts'

export type ReglaGuarda = 'vacia' | 'larga' | 'voseo' | 'muletilla' | 'cifra_fuera' | 'nombre_fuera'

export const MAX_PALABRAS = 80

const B = '(?<![\\p{L}\\p{N}_])'
const E = '(?![\\p{L}\\p{N}_])'
const VOSEO = new RegExp(
  `${B}(vos|ten[eé]s|pod[eé]s|sos|quer[eé]s|sab[eé]s|hac[eé]s|ponete|mir[á]|fijate|acordate|decime|elegi|elegí|pens[á]|us[á]|llev[aá]s|tom[aá]s|hac[é]|and[á]|dale|vení|segu[ií]|dej[á]|fij[á]te)${E}`,
  'iu',
)
const MULETILLA = new RegExp(
  `(${B}Ahora,|${B}Es decir,|${B}Eso s[ií]${E}|${B}Claro,|${B}Por supuesto${E}|${B}En resumen${E}|${B}B[aá]sicamente${E}|[Ss]i quieres,? te ampl[ií]o|te ampl[ií]o los matices)`,
  'u',
)
const LA_PIEZA = new RegExp(`${B}la pieza (dice|trae|plantea)${E}`, 'giu')
const NUMERO = /\d+(?:[.,]\d+)?/g
const PALABRA = /[\p{L}][\p{L}'-]*/gu
const PROPIAS = new Set(['praxis', 'alpha'])

const numeros = (t: string) => new Set((t.match(NUMERO) ?? []).map((n) => n.replace(',', '.')))

/** Palabras con mayúscula (nombre propio o sigla) que no abren oración: posibles autores, estudios o siglas nuevas. */
function propiasDe(t: string): string[] {
  const out: string[] = []
  for (const m of t.matchAll(PALABRA)) {
    const antes = t.slice(0, m.index).trimEnd()
    const abre = antes === '' || /[.?!¿¡:]$/u.test(antes)
    if (!abre && /^\p{Lu}/u.test(m[0])) out.push(sinTildes(m[0]))
  }
  return out
}

/** `null` si pasa; si no, la primera regla que falla. `permitido` = los campos enviados más la pregunta. */
export function revisarGuardas(respuesta: string, permitido: string): ReglaGuarda | null {
  const t = respuesta.trim()
  if (!t) return 'vacia'
  if (t.split(/\s+/).length > MAX_PALABRAS) return 'larga'
  if (VOSEO.test(t)) return 'voseo'
  if (MULETILLA.test(t) || (t.match(LA_PIEZA) ?? []).length > 1) return 'muletilla'
  const nums = numeros(permitido)
  for (const n of numeros(t)) if (!nums.has(n)) return 'cifra_fuera'
  const palabras = new Set((sinTildes(permitido).match(PALABRA) ?? []))
  for (const p of propiasDe(t)) if (!PROPIAS.has(p) && !palabras.has(p)) return 'nombre_fuera'
  return null
}
