import { cargaPorGrupo } from './fatiga'
import { bandaPrs } from './ondulacion'
import type { Microciclo, NivelVolumen } from './types'

/**
 * Cuántas series le tocan al grupo la semana que viene.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ RESUELVE
 * ────────────────────────────────────────────────────────────────────────────
 * `ondularEjercicio` decide la carga con criterio, pero el número de series lo
 * **hereda**: parte de `ejercicio.sets` del microciclo anterior y solo lo mueve
 * en descarga o con PRS crítico. Así el volumen nunca progresa por sí solo, y el
 * volumen es —según el motor del Cerebro— «la variable que más se ondula a lo
 * largo de los 24 microciclos».
 *
 * Y se decide **por grupo muscular**, no por ejercicio: dos ejercicios de glúteo
 * suman al mismo presupuesto. Por eso esto vive aparte del motor de carga.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LO QUE DICE EL CEREBRO (motor-decision/01-volumen-landmarks.md)
 * ────────────────────────────────────────────────────────────────────────────
 * Volumen = series efectivas por grupo y semana, a RIR moderado. Landmarks
 * orientativos (Israetel/RP):
 *
 *   MV  ~6      mantenimiento: no perder masa
 *   MEV  8–12   mínimo eficaz para crecer
 *   MAV 12–20   donde se acumula la mayor parte del bloque
 *   MRV 18–26   techo; pasarse es volumen basura y fatiga
 *
 * Y la regla de progresión, literal:
 *
 *   Empezar el bloque en MEV → subir 1–2 series por grupo por microciclo,
 *   avanzando por MAV → tocar MRV al final → descargar a MV → reiniciar.
 *
 * El ranking del PERFIL (Muy Alto…Bajo) «fija dónde acumular y dónde solo
 * mantener». En déficit, sesgar a MEV–MAV y no sostener MRV.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LO QUE INTERPOLO YO, Y HAY QUE REVISAR
 * ────────────────────────────────────────────────────────────────────────────
 * 1. **Las bandas se solapan en la fuente** (MAV 12–20 y MRV 18–26). Aquí se
 *    parten en 12–17 y 18–25 para que un número caiga en una sola. La frontera
 *    exacta es criterio, no dato.
 * 2. **Cuándo +1 y cuándo +2.** La fuente dice «1–2» sin decir cuál. Aquí: +2
 *    mientras se está lejos del techo y +1 al acercarse, que es como se sube una
 *    escalera. Si tu criterio es otro, se cambia en `PASO_LEJOS`/`PASO_CERCA`.
 * 3. **Los cortes numéricos** (6/10/12/18/26) son los de la fuente para grupo
 *    grande. La fuente pide ajustarlos a la baja en grupos pequeños o muy
 *    solicitados; la app **no sabe el tamaño del grupo**, así que no lo hace. Es
 *    la limitación más grande de este módulo.
 *
 * Nada de esto escribe nada: devuelve una recomendación para que el coach la
 * apruebe, igual que el resto de `proponerMicrociclo`.
 */

export type Landmark = 'MV' | 'MEV' | 'MAV' | 'MRV' | 'sobre-MRV'

/**
 * Los grupos del PERFIL y los de `fatiga.ts` **no se llaman igual**, y buscar por
 * clave exacta habría dejado el motor silenciosamente mal.
 *
 * Medido sobre los 18 perfiles reales (2026-08-12): el glúteo aparece escrito
 * `Glúteo` en 14, `Glúteos` en 3 y `Gluteo` en 1, mientras `cargaPorGrupo`
 * produce siempre `Glúteos`. También conviven `Pantorrilla`/`Pantorrillas`,
 * `Cuadriceps`/`Cuádriceps` y —peor, porque no es ortografía— `Core` frente a
 * `Abdomen`. Con búsqueda exacta, **15 de 18 asesorados habrían visto su glúteo
 * tratado como prioridad Normal**, que es justo el grupo que casi todas priorizan.
 *
 * Así que se comparan normalizados: sin tildes, en mayúsculas, sin la `S` final
 * y con los sinónimos conocidos unificados. Arreglar la ortografía del dato es
 * otra tarea; esto solo evita que el motor se equivoque mientras tanto.
 */
const SINONIMOS: Record<string, string> = { CORE: 'ABDOMEN' }

function claveDeGrupo(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
    .replace(/S$/, '')
  return SINONIMOS[limpio] ?? SINONIMOS[`${limpio}S`] ?? limpio
}

/** La prioridad que el PERFIL le da a un grupo, tolerando cómo esté escrita. */
export function prioridadDeGrupo(
  volumenSemanal: Readonly<Record<string, NivelVolumen>>,
  grupo: string,
): NivelVolumen | undefined {
  const buscada = claveDeGrupo(grupo)
  const encontrada = Object.entries(volumenSemanal).find(([k]) => claveDeGrupo(k) === buscada)
  return encontrada?.[1]
}

/** Cortes de la fuente, partidos donde ella se solapa (ver interpolación 1). */
const SUELO_MEV = 8
const SUELO_MAV = 12
const SUELO_MRV = 18
const SUELO_EXCESO = 26

/** Series a las que se descarga: el MV de la fuente. */
export const SERIES_DESCARGA = 6

/**
 * Suelo de mantenimiento fiable. La fuente es explícita y contraintuitiva: al
 * recortar un grupo para financiar a otro hay que **mirar el número de series,
 * no el porcentaje**, porque «bajar de 4 a 2 no es como bajar de 50 a 25». Por
 * debajo de 3 se sale de la zona de mantenimiento fiable.
 */
export const SUELO_MANTENIMIENTO = 3

const PASO_LEJOS = 2
const PASO_CERCA = 1

export function landmarkDe(series: number): Landmark {
  if (series < SUELO_MEV) return 'MV'
  if (series < SUELO_MAV) return 'MEV'
  if (series < SUELO_MRV) return 'MAV'
  if (series < SUELO_EXCESO) return 'MRV'
  return 'sobre-MRV'
}

/**
 * Hasta dónde acumula este grupo, según lo que el coach pautó en el PERFIL.
 * «Ese ranking fija dónde acumular y dónde solo mantener».
 */
function techoDe(prioridad: NivelVolumen): number {
  switch (prioridad) {
    case 'Muy Alto':
    case 'Alto':
      return SUELO_MRV + 3 // dentro de MRV, sin rozar el exceso
    case 'Normal':
      return SUELO_MRV - 1 // tope de MAV
    default:
      return SUELO_MEV // Bajo y Muy Bajo solo mantienen
  }
}

export interface ContextoVolumen {
  seriesActuales: number
  /** Lo que el PERFIL le asignó al grupo. Sin dato, se trata como 'Normal'. */
  prioridad?: NivelVolumen
  /** PRS de entrada más reciente. Sin dato, no modula. */
  prs?: number
  /** Déficit calórico: sesga a MEV–MAV y no sostiene MRV. */
  enDeficit?: boolean
  /**
   * Señal de MRV alcanzado que la app **no** puede deducir sola: rendimiento que
   * cae sin causa externa, RPE que sube sin progreso, molestias articulares. Lo
   * marca el coach.
   */
  señalDeTecho?: boolean
}

export interface DecisionVolumen {
  seriesActuales: number
  seriesPropuestas: number
  delta: number
  landmarkActual: Landmark
  landmarkPropuesto: Landmark
  motivo: string
}

function decidir(ctx: ContextoVolumen): { series: number; motivo: string } {
  const { seriesActuales: actuales, prioridad = 'Normal', prs, enDeficit, señalDeTecho } = ctx
  const banda = prs === undefined ? undefined : bandaPrs(prs)

  if (señalDeTecho) {
    return {
      series: Math.max(SERIES_DESCARGA, SUELO_MANTENIMIENTO),
      motivo: 'Señal de techo: el rendimiento cae sin causa externa. Descarga a MV.',
    }
  }

  if (banda === 'critico') {
    return {
      series: Math.max(SERIES_DESCARGA, SUELO_MANTENIMIENTO),
      motivo: 'PRS crítico: descarga a MV. Acumular sobre alguien sin recuperar no acumula, fatiga.',
    }
  }

  if (banda === 'rojo') {
    return { series: actuales, motivo: 'PRS en rojo: se sostiene el volumen, no se acumula.' }
  }

  // En déficit el techo baja a MAV: la recuperación está comprometida y el
  // motor pide no sostener MRV (página 09 del Cerebro).
  const techo = enDeficit ? Math.min(techoDe(prioridad), SUELO_MRV - 1) : techoDe(prioridad)

  if (actuales >= techo) {
    const porQue = enDeficit
      ? `En déficit el techo baja a MAV (${techo}): sostiene, no acumula.`
      : `Ya está en su techo para prioridad ${prioridad} (${techo} series): sostiene.`
    return { series: actuales, motivo: porQue }
  }

  // Lejos del techo se suben 2; a un paso, 1. Ver interpolación 2 del encabezado.
  const paso = techo - actuales > PASO_LEJOS ? PASO_LEJOS : PASO_CERCA
  const series = Math.min(techo, actuales + paso)
  return {
    series,
    motivo: `Acumula +${series - actuales} hacia su techo de ${techo} series (prioridad ${prioridad}).`,
  }
}

export function decidirVolumen(ctx: ContextoVolumen): DecisionVolumen {
  const { series, motivo } = decidir(ctx)
  // El suelo se aplica al final y sobre cualquier camino: es la única regla que
  // no admite excepción, ni con PRS crítico ni en déficit.
  const seriesPropuestas = Math.max(SUELO_MANTENIMIENTO, series)
  return {
    seriesActuales: ctx.seriesActuales,
    seriesPropuestas,
    delta: seriesPropuestas - ctx.seriesActuales,
    landmarkActual: landmarkDe(ctx.seriesActuales),
    landmarkPropuesto: landmarkDe(seriesPropuestas),
    motivo,
  }
}

export interface VolumenDeGrupo extends DecisionVolumen {
  grupo: string
  prioridad: NivelVolumen
}

/**
 * La recomendación de volumen de todo el microciclo, grupo a grupo.
 *
 * Las series de partida son las **pautadas**, no las ejecutadas: se ondula sobre
 * lo que se programó. Que además se hiciera o no es otra conversación, y la
 * levanta `revisarActivacion`.
 */
export function volumenDelMicrociclo(
  microciclo: Microciclo,
  opciones: {
    volumenSemanal?: Readonly<Record<string, NivelVolumen>>
    prs?: number
    enDeficit?: boolean
    gruposConSeñalDeTecho?: readonly string[]
  } = {},
): VolumenDeGrupo[] {
  const { volumenSemanal = {}, prs, enDeficit, gruposConSeñalDeTecho = [] } = opciones
  return cargaPorGrupo(microciclo).map(({ grupo, seriesPautadas }) => {
    const prioridad = prioridadDeGrupo(volumenSemanal, grupo) ?? 'Normal'
    return {
      grupo,
      prioridad,
      ...decidirVolumen({
        seriesActuales: seriesPautadas,
        prioridad,
        prs,
        enDeficit,
        señalDeTecho: gruposConSeñalDeTecho.includes(grupo),
      }),
    }
  })
}
