import { AL_FALLO, leerObjetivoDeIntensidad, textoDeObjetivo } from './objetivoDeIntensidad'
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

const UNIDADES =
  'TOTAL(?:ES)?(?:\\s+EN\\s+BARRA)?|POR\\s+PIERNA|POR\\s+LADO|POR\\s+MANO|CADA\\s+LADO|DE\\s+CADA\\s+UNO'

/**
 * La ranura de repeticiones, y las tres formas en que aparece escrita.
 *
 * `A 12 REPS` es la canónica y la **única que el compositor genera**. Las otras
 * dos se leen pero no se escriben:
 *
 * - **`A 12`, sin la palabra** — 28 casos, todos de julio de 2026.
 * - **`x12`**, con la equis pegada o separada — 27 casos, también de julio.
 *
 * Y un sufijo que sí convive con la canónica: **el rango entre paréntesis** tras
 * REPS —`A 11 REPS (10-12)`, 16 casos—, que repite lo que ya dice el campo
 * `rango` y por eso se lee y se descarta.
 *
 * **Por qué se aceptan si el estilo está muerto.** Lo está —cero apariciones en
 * agosto contra 71 en julio— pero un ejercicio cuya carga no se extrae se queda
 * sin `cargaKg`, y sin `cargaKg` es invisible para
 * `comprobar-alineacion-ejecutada.sql`: no falla, **deja de estar vigilado**, que
 * es peor porque no se nota.
 *
 * ⚠ **El `A 12` sin palabra exige `;` inmediatamente después**, y ese anclaje es
 * lo único que lo hace seguro. Sin él, `10KG A 20 PASOS` daría 20 repeticiones y
 * `70KG A 12-15 + 5 PARCIALES` daría 12: dos formas donde el número que sigue a
 * la `A` **no son repeticiones**. Con el `;` pegado, ninguna de las dos entra.
 */
const REPS =
  '(?:A\\s+(\\d+(?:\\s*-\\s*\\d+)?)\\s*REPS?(?:\\s*\\(\\s*\\d+\\s*-\\s*\\d+\\s*\\))?' +
  '|A\\s+(\\d+(?:\\s*-\\s*\\d+)?)(?=\\s*;)' +
  '|[x×]\\s*(\\d+(?:\\s*-\\s*\\d+)?))'

/**
 * Cabecera canónica. Las dos ranuras de unidad existen porque el coach la
 * escribe en los dos sitios: `80KG POR PIERNA A 12 REPS` y también
 * `20KG A 8 REPS POR PIERNA`.
 *
 * ⚠ **Esta gramática la comparten tres piezas**, y las tres cambian en el mismo
 * commit: esta función, `supabase/rellenar-carga.sql` y
 * `supabase/comprobar-alineacion.sql`. Dos implementaciones del mismo patrón
 * divergen en silencio — es el modo M-1 con otra ropa.
 */
const CABECERA = new RegExp(
  '^\\s*(\\d+(?:[.,]\\d+)?)\\s*KGS?\\b' +
    `(?:\\s*,?\\s*(${UNIDADES}))?` +
    `\\s*${REPS}` +
    `(?:\\s+(${UNIDADES}))?` +
    // El RIR viaja en DOS sitios según la forma: `x13 (RIR 2); 3 SERIES` lo pone
    // antes del punto y coma, y la canónica lo pone tras SERIES. Se capturan los
    // dos. El rango `(10-12)` no cae aquí: ya se lo comió la ranura de REPS.
    '(?:\\s*\\(([^)]*)\\))?' +
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
  /** El objetivo que anuncia la cabecera. Un número, `'FALLO'`, o el texto tal
   *  cual cuando no es ninguna de las dos («Isometría», «2-3»). */
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
  // «A 15 REPS DE CADA UNO» es una prevención de hombro con dos movimientos por
  // serie, no una carga por lado: los 3,4 kg son los que se cogen, y punto.
  if (u === 'DE CADA UNO') return 'kg'
  return undefined
}

function leerRir(bruto: string | undefined): number | string | undefined {
  if (!bruto) return undefined
  const limpio = bruto.trim()
  // `(RIR 2)` → 2 y `(FALLO)` → `'FALLO'`. `(RIR 2-3)` y `(ISOMETRÍA)` se quedan
  // como texto: no son un objetivo de intensidad y fingir que lo son es lo que
  // abortaba la carga entera.
  //
  // Que la palabra se lea **solo aquí dentro** es la salvaguarda entera: en el
  // paréntesis de la cabecera «FALLO» únicamente puede ser una declaración,
  // mientras que dos palabras más allá, en la nota del coach, lo normal es que
  // sea una negación —«SIN LLEGAR AL FALLO»— o un recuerdo —«EN M14 LLEGASTE AL
  // FALLO»—. Medido: de 81 prescripciones con la palabra, la mayoría son eso.
  return leerObjetivoDeIntensidad(limpio) ?? limpio
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

  // Las tres ranuras de repeticiones son alternativas EXCLUYENTES dentro de
  // `REPS`, así que exactamente una viene definida y las otras dos `undefined`.
  const [cabecera, carga, unidadAntes, repsCanonica, repsSinPalabra, repsPorEquis,
    unidadDespues, rirAntes, sets, rirDespues] = m
  const reps = repsCanonica ?? repsSinPalabra ?? repsPorEquis
  // Manda el de después de SERIES: es el de la cabecera canónica, la única forma
  // que el compositor escribe. El de antes solo existe en la variante con equis.
  const rir = rirDespues ?? rirAntes
  return {
    reconocida: true,
    cargaKg: Number(carga.replace(',', '.')),
    unidadCarga: normalizarUnidad(unidadAntes ?? unidadDespues) ?? 'kg',
    // `reps` no puede faltar: si la cabecera casó, una de las tres ranuras casó.
    repsDiana: Number(String(reps).split('-')[0].trim()),
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

/** `(RIR 2)` · `(FALLO)` · `(RIR 2-3)` · `(ISOMETRÍA)`. Cast defensivo: puede no ser número. */
function parentesisRir(rir: number | string | undefined): string {
  if (rir === undefined || rir === null || rir === '') return ''
  // Los dos objetivos de verdad —un RIR o el FALLO— los escribe
  // `textoDeObjetivo`, que es la única función que sabe cómo se dicen. Lo demás
  // («ISOMETRÍA», «2-3», «CONTROL») no es un objetivo: se transporta tal cual.
  if (typeof rir === 'number' && Number.isFinite(rir)) return ` (${textoDeObjetivo(rir)})`
  const texto = String(rir).trim().toUpperCase()
  if (texto === AL_FALLO) return ` (${textoDeObjetivo(AL_FALLO)})`
  return ` (${texto})`
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
