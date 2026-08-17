import type { EjercicioPrescrito, SeriePrescrita, UnidadCarga } from './types'

/**
 * La carga vivía dentro de una frase escrita a mano por el coach:
 *
 *   `62.5KG TOTAL A 10 REPS; 3 SERIES (RIR 1). CONSOLIDA LOS 61.5 QUE MOVISTE.`
 *
 * Progresar esa carga con una expresión regular sobre el texto entero rompía
 * cosas: partía el decimal (`16.KG`), tomaba el «TOTAL» de la **nota** como
 * unidad de carga, se llevaba por delante el `61.5` de la nota como si fuera la
 * carga, y cortaba frases del coach a media oración.
 *
 * Aquí la frase se parte en dos de una vez por todas:
 *
 * - **la cabecera** — carga, unidad, reps, series, RIR — que son campos, y
 * - **la nota del coach**, que es prosa y **no se toca nunca**.
 *
 * La regla que evita todos aquellos fallos: **la cabecera se lee anclada al
 * principio del texto**. Lo que venga después es nota, aunque contenga números,
 * la palabra «TOTAL» o «KG». La nota no se interpreta; se transporta.
 */

const UNIDADES = 'TOTAL(?:ES)?|POR\\s+PIERNA|POR\\s+LADO|POR\\s+MANO|CADA\\s+LADO'

/**
 * Cabecera canónica. Las dos ranuras de unidad existen porque el coach la
 * escribe en los dos sitios: `80KG POR PIERNA A 12 REPS` y también
 * `20KG A 8 REPS POR PIERNA`.
 */
const CABECERA = new RegExp(
  '^\\s*(\\d+(?:[.,]\\d+)?)\\s*KGS?\\b' +
    `(?:\\s+(${UNIDADES}))?` +
    '\\s+A\\s+(\\d+(?:\\s*-\\s*\\d+)?)\\s*REPS?' +
    `(?:\\s+(${UNIDADES}))?` +
    '\\s*;\\s*(\\d+)\\s*SERIES?' +
    '(?:\\s*\\(([^)]*)\\))?' +
    '\\s*\\.?\\s*',
  'iu',
)

export interface PrescripcionPartida {
  /** `false` cuando la frase no lleva una cabecera con carga (porcentajes,
   *  «REGISTRA TU CARGA», tiempo, peso corporal). No es un error: es que ahí
   *  **no hay kilos que separar**, y forzarlos sería inventarlos. */
  reconocida: boolean
  cargaKg?: number
  unidadCarga?: UnidadCarga
  repsDiana?: number
  sets?: number
  /** Se devuelve tal cual viene: hay `rirObjetivo` que son texto («Isometría»). */
  rirObjetivo?: number | string
  /** Todo lo que sigue a la cabecera, sin tocar. */
  notaCoach: string
}

function normalizarUnidad(bruto: string | undefined): UnidadCarga | undefined {
  if (!bruto) return undefined
  const u = bruto.toUpperCase().replace(/\s+/g, ' ').trim()
  if (u.startsWith('TOTAL')) return 'total'
  if (u === 'POR MANO') return 'por mano'
  if (u === 'POR PIERNA' || u === 'POR LADO' || u === 'CADA LADO') return 'por lado'
  return undefined
}

function leerRir(bruto: string | undefined): number | string | undefined {
  if (!bruto) return undefined
  const limpio = bruto.trim()
  // `(RIR 2)` → 2. `(RIR 2-3)` y `(ISOMETRÍA)` se quedan como texto: no son un
  // número y fingir que lo son es lo que abortaba la carga entera.
  const soloRir = limpio.match(/^RIR\s+(\d+)$/i)
  return soloRir ? Number(soloRir[1]) : limpio
}

/**
 * Parte una prescripción en cabecera (campos) y nota (prosa del coach).
 *
 * No lanza nunca: si no reconoce la forma, devuelve `reconocida: false` y la
 * frase entera como nota. El que decide qué hacer con eso es quien llama.
 */
export function parsearPrescripcion(texto: string): PrescripcionPartida {
  const original = typeof texto === 'string' ? texto : ''
  const m = CABECERA.exec(original)
  if (!m) return { reconocida: false, notaCoach: original.trim() }

  const [cabecera, carga, unidadAntes, reps, unidadDespues, sets, rir] = m
  return {
    reconocida: true,
    cargaKg: Number(carga.replace(',', '.')),
    unidadCarga: normalizarUnidad(unidadAntes ?? unidadDespues) ?? 'kg',
    repsDiana: Number(reps.split('-')[0].trim()),
    sets: Number(sets),
    rirObjetivo: leerRir(rir),
    notaCoach: original.slice(cabecera.length).trim(),
  }
}

/**
 * Cabecera de escalera: `ONDULACIÓN ASCENDENTE: 60KG×10 · 62.5KG×8 (RIR 1).`
 *
 * Los dos puntos van pegados a ASCENDENTE **a propósito**: existe otra familia,
 * `ONDULACIÓN ASCENDENTE SOBRE TU PROPIA CARGA:`, que va por porcentajes y no
 * lleva kilos. Si esta expresión la mordiera, le inventaría una carga.
 */
const CABECERA_ONDULADA = new RegExp(
  '^\\s*ONDULACI[ÓO]N\\s+ASCENDENTE:\\s*' +
    '(?:\\d+(?:[.,]\\d+)?\\s*KG\\s*[×x]\\s*\\d+\\s*(?:·\\s*)?)+' +
    '(?:\\(([^)]*)\\))?' +
    '\\s*\\.?\\s*',
  'iu',
)

/**
 * Separa la nota del coach en un ejercicio ondulado. La carga no se devuelve
 * porque en estos vive en `seriesPrescritas`, serie a serie: un solo número no
 * puede representar 60 · 60 · 62.5 · 67.5.
 */
export function parsearOndulada(texto: string): { reconocida: boolean; notaCoach: string } {
  const original = typeof texto === 'string' ? texto : ''
  const m = CABECERA_ONDULADA.exec(original)
  if (!m) return { reconocida: false, notaCoach: original.trim() }
  return { reconocida: true, notaCoach: original.slice(m[0].length).trim() }
}

/** `60` → «60», `62.5` → «62.5». Sin ceros de adorno. */
function numero(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}

function sufijoUnidad(unidad: UnidadCarga | undefined): string {
  switch (unidad) {
    case 'total':
      return ' TOTAL'
    case 'por lado':
      return ' POR LADO'
    case 'por mano':
      return ' POR MANO'
    default:
      return ''
  }
}

/** `(RIR 2)` · `(RIR 2-3)` · `(ISOMETRÍA)`. Cast defensivo: puede no ser número. */
function parentesisRir(rir: number | string | undefined): string {
  if (rir === undefined || rir === null || rir === '') return ''
  if (typeof rir === 'number' && Number.isFinite(rir)) return ` (RIR ${rir})`
  const texto = String(rir).trim().toUpperCase()
  return texto.startsWith('RIR') ? ` (${texto})` : ` (${texto})`
}

function pegarNota(cabecera: string, nota: string | undefined): string {
  const limpia = (nota ?? '').trim()
  return limpia ? `${cabecera} ${limpia}` : cabecera
}

/**
 * Escribe la prescripción desde los campos. **La nota del coach se pega al
 * final tal cual**: esta función nunca la reescribe ni la recorta.
 *
 * Tres formas, en este orden de prioridad:
 *
 * 1. **Ondulado** (`seriesPrescritas`): la escalera manda, porque un solo
 *    `cargaKg` no puede representar 60 · 60 · 62.5 · 67.5.
 * 2. **Carga uniforme** (`cargaKg`): la cabecera canónica del coach.
 * 3. **Sin carga**: devuelve `prescripcion` **intacta**. Las de porcentaje y las
 *    de «REGISTRA TU CARGA» no se pueden regenerar sin inventar kilos, así que
 *    no se tocan.
 */
export function componerPrescripcion(ejercicio: EjercicioPrescrito): string {
  const escalera = ejercicio.seriesPrescritas
  if (escalera && escalera.length > 0) {
    return pegarNota(cabeceraOndulada(escalera), ejercicio.notaCoach)
  }

  if (typeof ejercicio.cargaKg === 'number' && Number.isFinite(ejercicio.cargaKg)) {
    const reps = ejercicio.repsDiana
    const cabecera =
      `${numero(ejercicio.cargaKg)}KG${sufijoUnidad(ejercicio.unidadCarga)}` +
      ` A ${typeof reps === 'number' ? reps : String(reps).toUpperCase()} REPS;` +
      ` ${ejercicio.sets} SERIES${parentesisRir(ejercicio.rirObjetivo)}.`
    return pegarNota(cabecera, ejercicio.notaCoach)
  }

  return ejercicio.prescripcion
}

function cabeceraOndulada(series: SeriePrescrita[]): string {
  const escalones = series.map((s) => `${numero(s.cargaKg)}KG×${s.reps}`).join(' · ')
  return `ONDULACIÓN ASCENDENTE: ${escalones}${parentesisRir(series[0]?.rir)}.`
}

/**
 * Carga que se le propone al asesorado al abrir una serie.
 *
 * El orden de preferencia es de más fiable a menos:
 *
 * 1. La serie prescrita, si el ejercicio viene ondulado — cada serie trae la
 *    suya y la anterior ya no sirve, justamente porque van subiendo.
 * 2. Lo último que él mismo registró en este ejercicio.
 * 3. `cargaKg`, ya separado del texto.
 *
 * Y si no hay ninguna de las tres, **no se sugiere nada** (`undefined`).
 *
 * Antes esto último se resolvía con `parseFloat` sobre la frase entera, y por
 * eso «30 SEG POR LADO» proponía **30 kg** en una plancha, «30 METROS» otros 30
 * en un paseo del granjero y «8 REPS POR LADO» proponía 8. El primer número de
 * la frase no es la carga: a veces son segundos, metros o repeticiones.
 */
export function cargaSugerida(
  ejercicio: EjercicioPrescrito,
  serieOndulada: SeriePrescrita | undefined,
): number | undefined {
  if (serieOndulada) return serieOndulada.cargaKg
  const ultima = ejercicio.series[ejercicio.series.length - 1]?.cargaKg
  if (typeof ultima === 'number' && Number.isFinite(ultima)) return ultima
  if (typeof ejercicio.cargaKg === 'number' && Number.isFinite(ejercicio.cargaKg)) {
    return ejercicio.cargaKg
  }
  return undefined
}

/**
 * ¿Componer desde los campos devuelve exactamente el texto que ya estaba?
 *
 * Es la comprobación que hace seguro el relleno masivo: si da `true`, guardar
 * los campos no cambia ni una letra de lo que el asesorado va a leer. Si da
 * `false`, el ejercicio se aparta para mirarlo a mano en vez de reescribirlo.
 */
export function componerCoincide(ejercicio: EjercicioPrescrito): boolean {
  return componerPrescripcion(ejercicio) === ejercicio.prescripcion
}
