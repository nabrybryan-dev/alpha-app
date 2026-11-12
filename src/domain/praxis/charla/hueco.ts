// Rutas con «.ts»: este módulo lo importa la Edge Function `praxis-charla` (Deno).
import { VOCABULARIO_CHARLA } from './vocabularioCharla.generado.ts'
import { normalizarPalabra } from './vocabularioPermitido.ts'

/**
 * Hueco: una pregunta que no tuvo pieza aprobada, lista para que quien llama la ENCOLE (aquí no se escribe en ninguna tabla).
 * PURO. Recibe la frase ya LIMPIA (limpiador + vocabulario) y devuelve solo `temaClave` y `frase`: nunca id de persona.
 * `temaClave`: palabras del vocabulario permitido (4 letras o más, sin palabras de función), sin repetir, ordenadas y unidas
 * por espacio. Así «cuántas series por semana» y «por semana, cuántas series» dan la misma clave. Es una agrupación gruesa:
 * dos preguntas distintas con las mismas palabras también coinciden; el trabajo de agrupar fino es de quien las lea.
 */
export const MAX_FRASE_HUECO = 300

export interface Hueco {
  temaClave: string
  frase: string
}

const VOCAB: ReadonlySet<string> = new Set(VOCABULARIO_CHARLA)
const FUNCION = new Set(
  ('para como pero sobre entre desde hasta cuando donde cual cuales cuanto cuantos cuanta cuantas esto esta este estos estas esos esas ' +
    'tengo puedo debo quiero tiene hace hacer algo mucho muchos mucha muchas poco pocos tambien siempre nunca cada ' +
    'porque aunque si pues ahora despues antes').split(' '),
)

export function normalizarHueco(fraseLimpia: string): Hueco {
  const sinMarcas = fraseLimpia.replace(/\[[^\]]*\]/g, ' ')
  const palabras = (sinMarcas.match(/\p{L}+/gu) ?? []).map(normalizarPalabra).filter((p) => p.length >= 4 && VOCAB.has(p) && !FUNCION.has(p))
  const temaClave = [...new Set(palabras)].sort().join(' ')
  return { temaClave, frase: fraseLimpia.replace(/\s+/g, ' ').trim().slice(0, MAX_FRASE_HUECO) }
}
