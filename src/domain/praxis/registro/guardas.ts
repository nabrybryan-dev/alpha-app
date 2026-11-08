/**
 * Guardas del lector de dictado (medición «duros» del 8-nov-2026, DUROS-20261108.md).
 *
 * Criterio (CRITERIO-REGISTRO-20261107.md): ningún dato falso. Si la cita trae dos cifras en conflicto, un rango, una
 * cota, una unidad ajena o un deseo, el lector NO anota la primera cifra: lo deja a la vista o lo pregunta con el
 * mecanismo que ya existe (rango / vago / descartado). Todas las funciones reciben texto ya normalizado
 * (`normalizarTexto`) salvo que se diga otra cosa.
 */
import { escanearNumeros, type NumeroEncontrado } from './numeros.ts'

const NUMERO_EN_PALABRAS = 'un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|veintiuno|veintidos|veintitres|veinticuatro'

/** «a las 5», «como a las 12 y pico de la noche», «a la una», «desde las 5»: una referencia a una hora de reloj. */
const CLAUSULA_RELOJ = new RegExp(
  `\\b(?:(?:como|sobre|desde|hasta)\\s+)?(?:a\\s+)?l(?:as|a)\\s+(?:\\d{1,2}|${NUMERO_EN_PALABRAS})(?:\\s+\\d{2}\\b)?(?:\\s+y\\s+(?:media|cuarto))?(?:\\s+de\\s+la\\s+(?:manana|tarde|noche|madrugada)|\\s+(?:am|pm|a m|p m)\\b)?`,
  'g',
)

/** Las horas de reloj dichas en el texto, cada una con su cola («a las 11 y media», «a las 12 de la noche»). */
export function clausulasDeReloj(n: string): string[] {
  return n.match(CLAUSULA_RELOJ) ?? []
}

/** El texto sin las horas de reloj: «a las 8 me tomé 2 vasos» → «me tome 2 vasos». */
export function quitarRelojes(n: string): string {
  return n.replace(CLAUSULA_RELOJ, ' ').replace(/\s+/g, ' ').trim()
}

const AJENAS = /^(anos?|series?|repeticiones|reps?|pisos?|pesos|dolares|kilos?|kg|libras?|pedidos?|personas|dias?|semanas?|meses|calorias|kcal|gramos|grados|cuotas)$/
const DISTANCIA_O_TIEMPO = /^(km|kms|kilometros?|metros?|minutos?|mins?|horas?)$/

export type CampoDeUnidad = 'pasos' | 'sueno' | 'hora' | 'agua'

/**
 * La cifra va con una unidad que no es la de ese campo («5 km», «30 minutos», «25 años», «3 series de 8»,
 * «8 horas de trabajo»): no se anota. `ofrecer` es true si la unidad es una forma de medir lo mismo (distancia o
 * tiempo caminado) y vale la pena pedir el dato en su unidad.
 */
export function unidadAjena(n: string, campo: CampoDeUnidad): { unidad: string; ofrecer: boolean } | null {
  const tokens = n.split(' ').filter(Boolean)
  const primero = escanearNumeros(n)[0]
  if (!primero) return null
  const u = tokens[primero.hasta] ?? ''
  if (AJENAS.test(u) || (campo !== 'agua' && campo !== 'hora' && /^(veces|vez)$/.test(u))) return { unidad: u, ofrecer: false }
  if (campo === 'pasos' && DISTANCIA_O_TIEMPO.test(u)) return { unidad: u, ofrecer: true }
  if (campo === 'sueno' && /^(horas?|minutos?) de (trabajo|turno|oficina|estudio|clase|manejo)\b/.test(tokens.slice(primero.hasta).join(' '))) {
    return { unidad: tokens.slice(primero.hasta, primero.hasta + 3).join(' '), ofrecer: false }
  }
  return null
}

const UNIDAD_DE_CIFRA = /^(horas?|hrs?|mil|pasos?|vasos?|litros?|minutos?|mins?)$/

/**
 * Rango sin «o»: «cinco, seis horas», «5 y 6 horas», «8, 9 mil pasos». Dos cifras pegadas (o unidas solo por «y») cuya
 * segunda lleva la unidad: no es una suma. Se pregunta con las dos.
 */
export function rangoSinConector(n: string): { tokens: string[]; a: NumeroEncontrado; b: NumeroEncontrado } | null {
  const tokens = n.split(' ').filter(Boolean)
  const nums = escanearNumeros(n)
  for (let i = 0; i + 1 < nums.length; i++) {
    const [a, b] = [nums[i], nums[i + 1]]
    const medio = tokens.slice(a.hasta, b.desde)
    const pegadas = medio.length === 0 || (medio.length === 1 && medio[0] === 'y')
    if (pegadas && a.valor !== b.valor && UNIDAD_DE_CIFRA.test(tokens[b.hasta] ?? '')) return { tokens, a, b }
  }
  return null
}

/** «menos de 5 horas», «más de 10 mil», «ni a 3000», «por lo menos…»: una cota no es el valor. */
const COTA = /\b(menos de|mas de|ni|por debajo de|por encima de|al menos|por lo menos|minimo|maximo|no llegue a|no pase de)\b/

export function esCota(n: string): boolean {
  return COTA.test(n) && escanearNumeros(n).length > 0
}

/** Palabras que, entre dos cifras, dicen que la segunda corrige o cambia a la primera, o que son dos hechos distintos. */
const MARCAS_DE_CORRECCION = new Set([
  'bueno', 'no', 'sino', 'perdon', 'digo', 'mejor', 'otra', 'otras', 'otro', 'otros', 'dormi', 'camine', 'tome',
])

/**
 * Dos cifras distintas separadas por una corrección («8 horas, bueno, 6», «8 mil, no, 6 mil», «cero horas, dormí 2»).
 * Se devuelven las dos para preguntar cuál fue: «el primer número gana» daba un dato falso.
 */
export function conflictoDeCifras(n: string): [NumeroEncontrado, NumeroEncontrado] | null {
  const tokens = n.split(' ').filter(Boolean)
  const nums = escanearNumeros(n)
  for (let i = 0; i + 1 < nums.length; i++) {
    const medio = tokens.slice(nums[i].hasta, nums[i + 1].desde)
    if (nums[i].valor !== nums[i + 1].valor && medio.some((m) => MARCAS_DE_CORRECCION.has(m))) return [nums[i], nums[i + 1]]
  }
  return null
}
