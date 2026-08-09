/**
 * La «clase» del ejercicio: `Compuesto · Cadena posterior`.
 *
 * Es la tercera parada del gabinete y NO estaba en el modelo. No hace falta un
 * campo nuevo: se deduce del patrón de movimiento, que desde el 2026-08-09 vive
 * en `EjercicioPrescrito.categoria` ya normalizado a la taxonomía del Cerebro
 * (`wiki/estructura-excel/04-taxonomia-categorias.md`).
 *
 * Dos criterios, los dos de la taxonomía:
 *
 * **Compuesto vs aislamiento** — número de articulaciones que se mueven. La
 * sentadilla mueve cadera, rodilla y tobillo: compuesto. La extensión de rodilla
 * mueve una: aislamiento. Es la misma línea que separa `SENTADILLAS` de
 * `AISLAMIENTO CUÁDRICEPS` en el PANEL.
 *
 * **Cadena** — dónde está la musculatura que produce el movimiento. Posterior
 * (glúteo, isquios, espalda, deltoides posterior), anterior (cuádriceps, pecho,
 * hombro frontal, tríceps), lateral (abductores, aductores, deltoides lateral,
 * antiflexión) o core.
 *
 * Sin patrón reconocido devuelve `undefined`: la parada muestra «—» antes que
 * inventarle una clase al ejercicio.
 */

export type Complejidad = 'Compuesto' | 'Aislamiento'
export type Cadena = 'Cadena posterior' | 'Cadena anterior' | 'Cadena lateral' | 'Core'

/** Patrones multiarticulares. El resto se considera aislamiento. */
const COMPUESTOS = new Set([
  'BISAGRA DE CADERA',
  'SENTADILLA',
  'SENTADILLAS',
  'SENTADILLA UNILATERAL',
  'PIERNA UNILATERAL',
  'EMPUJE HORIZONTAL',
  'EMPUJE INCLINADO',
  'EMPUJE VERTICAL',
  'EMPUJE DECLINADO',
  'TRACCION HORIZONTAL',
  'TRACCION VERTICAL',
])

const CADENA_POR_PATRON: Record<string, Cadena> = {
  'BISAGRA DE CADERA': 'Cadena posterior',
  'EXTENSION DE CADERA': 'Cadena posterior',
  'AISLAMIENTO GLUTEOS': 'Cadena posterior',
  'AISLAMIENTO ISQUIOS': 'Cadena posterior',
  'FLEXION DE RODILLA': 'Cadena posterior',
  'TRACCION HORIZONTAL': 'Cadena posterior',
  'TRACCION VERTICAL': 'Cadena posterior',
  'EXTENSION DE HOMBRO': 'Cadena posterior',
  'RETRACCION ESCAPULAR': 'Cadena posterior',
  'ESPALDA SUPERIOR': 'Cadena posterior',
  'ESPALDA BAJA': 'Cadena posterior',
  'EXTENSION LUMBAR': 'Cadena posterior',
  'DELTOIDES POSTERIORES': 'Cadena posterior',
  'ABDUCCION HORIZONTAL': 'Cadena posterior',

  SENTADILLA: 'Cadena anterior',
  SENTADILLAS: 'Cadena anterior',
  'SENTADILLA UNILATERAL': 'Cadena anterior',
  'PIERNA UNILATERAL': 'Cadena anterior',
  'AISLAMIENTO CUADRICEPS': 'Cadena anterior',
  'EXTENSION DE RODILLA': 'Cadena anterior',
  'EMPUJE HORIZONTAL': 'Cadena anterior',
  'EMPUJE INCLINADO': 'Cadena anterior',
  'EMPUJE VERTICAL': 'Cadena anterior',
  'EMPUJE DECLINADO': 'Cadena anterior',
  'AISLAMIENTO PECTORAL': 'Cadena anterior',
  'APERTURA DE PECHO': 'Cadena anterior',
  'DELTOIDES FRONTALES': 'Cadena anterior',
  'FLEXION DE HOMBRO': 'Cadena anterior',
  TRICEPS: 'Cadena anterior',
  BICEPS: 'Cadena anterior',
  'FLEXION DE CODO': 'Cadena anterior',
  'EXTENSION DE CODO': 'Cadena anterior',
  'FLEXION PLANTAR': 'Cadena posterior',
  PANTORRILLAS: 'Cadena posterior',
  DORSIFLEXION: 'Cadena anterior',

  ADUCTORES: 'Cadena lateral',
  'ADUCCION DE CADERA': 'Cadena lateral',
  'ABDUCCION DE CADERA': 'Cadena lateral',
  'ABDUCCION DE HOMBRO': 'Cadena lateral',
  'DELTOIDES LATERALES': 'Cadena lateral',
  'ROTACION DE CADERA': 'Cadena lateral',

  ABDOMEN: 'Core',
  ANTIEXTENSION: 'Core',
  ANTIRROTACION: 'Core',
  'ANTIFLEXION LATERAL': 'Core',
  'FLEXION DE TRONCO': 'Core',
}

/** Sin tildes y en mayúsculas: en la base conviven «TRACCIÓN» y «TRACCION». */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
}

/**
 * @param patron el patrón de movimiento (`EjercicioPrescrito.categoria`)
 * @returns `«Compuesto · Cadena posterior»`, o `undefined` si el patrón no está
 *          en la taxonomía —mejor un guion que una clase inventada—.
 */
export function claseDeEjercicio(patron: string | undefined): string | undefined {
  if (!patron) return undefined
  const p = normalizar(patron)
  const cadena = CADENA_POR_PATRON[p]
  if (!cadena) return undefined
  const complejidad: Complejidad = COMPUESTOS.has(p) ? 'Compuesto' : 'Aislamiento'
  return `${complejidad} · ${cadena}`
}
