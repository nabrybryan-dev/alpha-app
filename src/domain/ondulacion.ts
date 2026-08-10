import type { EjercicioPrescrito, SeriePrescrita, SerieRegistrada } from './types'

/**
 * Motor de ondulación (método Heracles 2.0).
 *
 * Todo lo que hay aquí sale de `PLANTILLA_HERACLES_2.0`: el mapa de
 * periodización (24 microciclos = 6 mesociclos × 4 semanas), la tabla de
 * coeficientes %1RM y las bandas de interpretación de métricas. No se inventan
 * porcentajes de progresión: la carga del microciclo siguiente se deduce del
 * 1RM estimado con lo que el asesorado registró de verdad.
 */

export type ModeloOndulacion =
  | 'lineal-ascendente'
  | 'ondulante-diario'
  | 'ondulante-top-set'
  | 'bloques-en-sesion'
  | 'ondulante-intenso'
  | 'flexible-autorregulado'

export interface FasePeriodizacion {
  /** Microciclo dentro del macrociclo (1-24). */
  micro: number
  meso: number
  /** Semana dentro del mesociclo (1-4). */
  semana: number
  fase: string
  objetivo: string
  modelo: ModeloOndulacion
  descripcionModelo: string
  descarga: boolean
}

interface Mesociclo {
  fase: string
  objetivo: string
  modelo: ModeloOndulacion
  descripcionModelo: string
}

/** Los 6 mesociclos del macrociclo, en orden. Cada uno dura 4 microciclos. */
const MESOCICLOS: Mesociclo[] = [
  {
    fase: 'Adaptación anatómica',
    objetivo: 'Técnica, tolerancia al volumen, base de fuerza',
    modelo: 'lineal-ascendente',
    descripcionModelo: 'Lineal ascendente suave (RIR 3→2)',
  },
  {
    fase: 'Hipertrofia acumulación',
    objetivo: 'Maximizar volumen efectivo en grupos prioritarios',
    modelo: 'ondulante-diario',
    descripcionModelo: 'Ondulante diario (pesado/medio/ligero)',
  },
  {
    fase: 'Hipertrofia intensificación',
    objetivo: 'Subir intensidad, acercar al fallo con control',
    modelo: 'ondulante-top-set',
    descripcionModelo: 'Ondulante + top set / back off',
  },
  {
    fase: 'Fuerza-hipertrofia',
    objetivo: 'Ganancia de fuerza que sostenga futura hipertrofia',
    modelo: 'bloques-en-sesion',
    descripcionModelo: 'Bloques dentro de sesión (fuerza→acc.)',
  },
  {
    fase: 'Intensificación / picos',
    objetivo: 'Expresión de fuerza y tensión mecánica máxima',
    modelo: 'ondulante-intenso',
    descripcionModelo: 'Ondulante intenso (RIR 1-0 puntual)',
  },
  {
    fase: 'Realimentación / recomposición',
    objetivo: 'Consolidar, mantener y planear el siguiente macro',
    modelo: 'flexible-autorregulado',
    descripcionModelo: 'Flexible autorregulado (según PRS)',
  },
]

export const MICROS_POR_MESO = 4
export const MICROS_POR_MACRO = MESOCICLOS.length * MICROS_POR_MESO

/**
 * Fase que le toca a un microciclo. El mapa de la plantilla llega hasta el 24;
 * a partir de ahí se asume que el macrociclo se repite (el 25 vuelve a ser
 * adaptación anatómica). Si el criterio real es otro, esto es lo único que hay
 * que cambiar.
 */
export function fasePeriodizacion(numeroMicro: number): FasePeriodizacion {
  const dentroDelMacro = ((Math.trunc(numeroMicro) - 1) % MICROS_POR_MACRO + MICROS_POR_MACRO) % MICROS_POR_MACRO
  const indiceMeso = Math.floor(dentroDelMacro / MICROS_POR_MESO)
  const semana = (dentroDelMacro % MICROS_POR_MESO) + 1
  const meso = MESOCICLOS[indiceMeso]
  return {
    micro: dentroDelMacro + 1,
    meso: indiceMeso + 1,
    semana,
    fase: meso.fase,
    objetivo: meso.objetivo,
    modelo: meso.modelo,
    descripcionModelo: meso.descripcionModelo,
    descarga: semana === MICROS_POR_MESO,
  }
}

/**
 * Coeficientes %1RM: carga = 1RM × coef. Fila = repeticiones (1-15),
 * columna = RIR (0-6). Fuente citada en la plantilla: adaptado de Helms et al.
 * 2016 y González-Badillo & Sánchez-Medina.
 */
const COEF_1RM: readonly (readonly number[])[] = [
  [1.0, 0.965, 0.935, 0.9, 0.865, 0.83, 0.795],
  [0.96, 0.925, 0.895, 0.86, 0.825, 0.79, 0.755],
  [0.925, 0.89, 0.86, 0.825, 0.79, 0.755, 0.72],
  [0.89, 0.855, 0.825, 0.79, 0.755, 0.72, 0.685],
  [0.855, 0.82, 0.79, 0.755, 0.72, 0.685, 0.65],
  [0.82, 0.785, 0.755, 0.72, 0.685, 0.65, 0.615],
  [0.785, 0.75, 0.72, 0.685, 0.65, 0.615, 0.58],
  [0.75, 0.715, 0.685, 0.65, 0.615, 0.58, 0.545],
  [0.715, 0.68, 0.65, 0.615, 0.58, 0.545, 0.51],
  [0.68, 0.645, 0.615, 0.58, 0.545, 0.51, 0.475],
  [0.645, 0.61, 0.58, 0.545, 0.51, 0.475, 0.44],
  [0.61, 0.575, 0.545, 0.51, 0.475, 0.44, 0.405],
  [0.575, 0.54, 0.51, 0.475, 0.44, 0.405, 0.37],
  [0.54, 0.505, 0.475, 0.44, 0.405, 0.37, 0.335],
  [0.505, 0.47, 0.44, 0.405, 0.37, 0.335, 0.3],
]

export const REPS_MAX_TABLA = COEF_1RM.length
export const RIR_MAX_TABLA = COEF_1RM[0].length - 1

function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor))
}

/** Coeficiente %1RM para unas reps y un RIR dados. Fuera de tabla, se acota. */
export function coeficiente1rm(reps: number, rir: number): number {
  const fila = acotar(Math.round(reps), 1, REPS_MAX_TABLA) - 1
  const columna = acotar(Math.round(rir), 0, RIR_MAX_TABLA)
  return COEF_1RM[fila][columna]
}

/** 1RM estimado a partir de una serie registrada. */
export function e1rmDeSerie(serie: SerieRegistrada): number {
  return serie.cargaKg / coeficiente1rm(serie.reps, serie.rir)
}

/**
 * 1RM estimado del ejercicio. Se usa la mediana de las series y no la mejor:
 * una serie mal registrada (una carga tecleada de más) no debe arrastrar la
 * prescripción de toda la semana siguiente.
 */
export function e1rmDeSeries(series: SerieRegistrada[]): number | undefined {
  const validas = series.filter((s) => s.cargaKg > 0 && s.reps > 0)
  if (validas.length === 0) return undefined
  const estimados = validas.map(e1rmDeSerie).sort((a, b) => a - b)
  const medio = Math.floor(estimados.length / 2)
  const mediana =
    estimados.length % 2 === 0 ? (estimados[medio - 1] + estimados[medio]) / 2 : estimados[medio]
  return Math.round(mediana * 100) / 100
}

/** Carga que corresponde a unas reps y un RIR objetivo, dado el 1RM estimado. */
export function cargaObjetivo(e1rm: number, reps: number, rir: number): number {
  return e1rm * coeficiente1rm(reps, rir)
}

/** Redondea al incremento real del gimnasio (discos de 1.25 kg → saltos de 2.5). */
export function redondearCarga(kg: number, incremento = 2.5): number {
  if (incremento <= 0) return Math.round(kg * 100) / 100
  return Math.round(kg / incremento) * incremento
}

export interface RangoReps {
  min: number
  max: number
}

/** Lee el rango de reps de la prescripción ("8-10", "(6–8)", "12 a 15"). */
export function rangoReps(rango: string): RangoReps | undefined {
  const numeros = rango.match(/\d+/g)
  if (!numeros || numeros.length === 0) return undefined
  const min = Number(numeros[0])
  const max = numeros.length > 1 ? Number(numeros[1]) : min
  return min <= max ? { min, max } : { min: max, max: min }
}

/**
 * Brecha de repeticiones: promedio de lo ejecutado menos la diana. Positivo =
 * se quedó corta la carga (hizo más reps de las pedidas); negativo = la carga
 * quedó por encima de lo que podía sostener.
 */
export function brechaReps(ejercicio: EjercicioPrescrito): number | undefined {
  const validas = ejercicio.series.filter((s) => s.reps > 0)
  if (validas.length === 0) return undefined
  const promedio = validas.reduce((suma, s) => suma + s.reps, 0) / validas.length
  return Math.round((promedio - ejercicio.repsDiana) * 10) / 10
}

export type BandaPrs = 'verde' | 'ambar' | 'rojo' | 'critico'

/**
 * Banda de recuperación por PRS. La escala teórica es 0-10 (Laurent 2011), pero
 * **la app solo produce cuatro valores**: el test post-sesión pregunta con botones
 * NADA / POCO / NORMAL / MUCHO, que valen `1 / 3 / 6 / 9`
 * (`TestPostSesion.tsx:16-24`). No llega ningún otro número.
 *
 * Los cortes están puestos para que cada botón caiga donde el método lo trata:
 *
 * | Botón | Valor | Banda | Qué hace el motor |
 * |-------|-------|-------|-------------------|
 * | NADA | 1 | `critico` | Sostiene carga, **+2 RIR y una serie menos** |
 * | POCO | 3 | `rojo` | Sostiene carga y **+1 RIR** |
 * | NORMAL | 6 | `ambar` | Ejecuta lo pautado |
 * | MUCHO | 9 | `verde` | Ejecuta lo pautado |
 *
 * `critico` existe desde el 2026-07-30. Antes había tres botones y todo «mal» se
 * trataba igual, cuando la tabla del método pide para 0-2 algo más fuerte que
 * frenar: −1 a −2 series/grupo y RIR +1/+2.
 *
 * **Si el test cambia de niveles otra vez, revisar estos cortes**, y también la
 * página de autorregulación del Cerebro
 * (`motor-decision/04-autorregulacion-prs-hooper.md`).
 */
export function bandaPrs(prs: number): BandaPrs {
  if (prs >= 7) return 'verde'
  if (prs >= 4) return 'ambar'
  if (prs >= 3) return 'rojo'
  return 'critico'
}

export type { SeriePrescrita }

export interface EjercicioOndulado {
  ejercicioId: string
  nombre: string
  /** 1RM estimado con lo registrado en el microciclo que se cierra. */
  e1rm: number | undefined
  brechaReps: number | undefined
  /** Hacia dónde se movió la carga respecto a lo pautado. */
  direccion: 'subir' | 'estable' | 'bajar' | 'sin-datos'
  series: SeriePrescrita[]
  motivo: string
}

export interface OpcionesOndulacion {
  /** PRS de entrada más reciente; si es rojo, no se progresa. */
  prs?: number
  /** Salto mínimo de carga del gimnasio. */
  incrementoKg?: number
  /** Reduce volumen manteniendo intensidad (semana 4 de cada mesociclo). */
  descarga?: boolean
  /**
   * Carga pautada del ejercicio. Sirve de ancla cuando todavía no hay series
   * registradas: se ondula sobre lo que ya está programado.
   */
  cargaPrescritaKg?: number
  /**
   * Caída de 1RM efectivo por set, en tanto por uno, para reflejar la fatiga
   * dentro del ejercicio. 0 = el 1RM estimado se mantiene en todos los sets.
   */
  derivaFatiga?: number
}

/**
 * Sin deriva, la carga sube más rápido de lo que sube en la práctica: al bajar
 * las reps el coeficiente da un salto que el cuerpo, ya fatigado, no sostiene.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * MEDIDO SOBRE 505 CASOS REALES (2026-08-01)
 * ────────────────────────────────────────────────────────────────────────────
 * Antes valía 0.025, calibrado sobre **un solo** patrón documentado (Mariana M15:
 * 13→11→10→9 reps con 65→70→75→77.5 kg). Ahora sale de las series REGISTRADAS por
 * los asesorados en las 21 plantillas: 2089 ejercicios con las tres series llenas,
 * de los cuales **505 tienen reps descendentes** —el patrón que esta constante
 * existe para reproducir—. En cada uno se despeja `d` de `e1RM_i = e1RM_0·(1−d·i)`.
 *
 *   mediana = 0.0329      IC 95 % (bootstrap, 3000) = [0.0258, 0.0373]
 *
 * **0.025 quedaba fuera de ese intervalo**, así que el cambio no es cosmético: el
 * valor viejo estaba sesgado a cargar de más en los últimos sets. Se fija 0.03 y no
 * 0.033 porque el intervalo mide 0.012 de ancho: la tercera cifra no es resoluble y
 * escribirla fingiría una precisión que no hay.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LO QUE ESTE NÚMERO NO ES
 * ────────────────────────────────────────────────────────────────────────────
 * No es una constante fisiológica. En los 2089 ejercicios la mediana es **0**: el
 * 71 % de las veces la persona hace el mismo peso en las tres series. Y dentro de
 * los 505 descendentes el rango intercuartílico va de −0.025 a +0.072, con un 30 %
 * que ni siquiera baja. Es un compromiso razonable, no una ley: quien tenga datos
 * de un asesorado concreto puede pasar `derivaFatiga` por opciones.
 */
export const DERIVA_FATIGA_POR_SET = 0.03

/**
 * Proporción de series que se conserva en una semana de descarga.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * MEDIDO, NO ELEGIDO (2026-08-01)
 * ────────────────────────────────────────────────────────────────────────────
 * Sobre **356 bajadas reales de series** entre microciclos consecutivos de las 21
 * plantillas de asesorados. El acierto de cada candidato, contando cuántas de esas
 * 356 reproduce exactamente `Math.round(sets * F)`:
 *
 *   F = 2/3  →  **81,7 %**      F = 0.6 → 70,5 %      F = 0.75 → 67,1 %
 *
 * Manda porque acierta los dos patrones dominantes a la vez: 3→2 (177 casos) y
 * 4→3 (61). Con 0.6 el segundo se convierte en 4→2, que solo ocurre 21 veces.
 *
 * Y 0.75 tiene un defecto peor que ser menos preciso: `round(2 * 0.75) = 2`, así
 * que **en un ejercicio de 2 series la descarga no quitaría ninguna**. Hay 51
 * bajadas reales de 2→1.
 *
 * Corrige una afirmación anterior de este repo —«la mediana real es 0,75»— que
 * medía caídas de VOLUMEN de más del 10 %, no el número de series. Es la cantidad
 * que esta constante multiplica, así que era comparar cosas distintas.
 */
export const FACTOR_DESCARGA = 2 / 3

/**
 * Ondula un ejercicio para el microciclo siguiente.
 *
 * El patrón es el de las plantillas actualizadas del 27 de junio: las reps
 * descienden set a set y la carga sube, con el último set como el de mayor
 * carga. La carga de cada set no es un porcentaje inventado sobre la anterior:
 * sale del 1RM estimado y del coeficiente que le corresponde a las reps y el
 * RIR de ese set.
 *
 * El RIR se mantiene en el objetivo a lo largo del ejercicio. Es lo que
 * reproduce el ejemplo documentado (13→11→10→9 reps con 65→70→75→77.5 kg): lo
 * que sube set a set es la carga, no la cercanía al fallo.
 *
 * El ancla del 1RM es lo registrado; si todavía no hay series, se usa la carga
 * pautada, de modo que se pueda ondular sobre una programación ya hecha.
 */
export function ondularEjercicio(
  ejercicio: EjercicioPrescrito,
  opciones: OpcionesOndulacion = {},
): EjercicioOndulado {
  const {
    prs,
    incrementoKg = 2.5,
    descarga = false,
    cargaPrescritaKg,
    derivaFatiga = DERIVA_FATIGA_POR_SET,
  } = opciones
  const e1rm =
    e1rmDeSeries(ejercicio.series) ??
    (cargaPrescritaKg !== undefined && cargaPrescritaKg > 0
      ? Math.round((cargaPrescritaKg / coeficiente1rm(ejercicio.repsDiana, ejercicio.rirObjetivo)) * 100) / 100
      : undefined)
  const brecha = brechaReps(ejercicio)
  const rango = rangoReps(ejercicio.rango) ?? { min: ejercicio.repsDiana, max: ejercicio.repsDiana }

  const banda = prs === undefined ? undefined : bandaPrs(prs)
  const critico = banda === 'critico'
  const congelado = critico || banda === 'rojo'

  const setsBase = descarga
    ? Math.max(1, Math.round(ejercicio.sets * FACTOR_DESCARGA))
    : ejercicio.sets
  // En crítico se quita una serie, además de lo que ya recorte la descarga.
  const sets = critico ? Math.max(1, setsBase - 1) : setsBase

  if (e1rm === undefined) {
    return {
      ejercicioId: ejercicio.id,
      nombre: ejercicio.nombre,
      e1rm: undefined,
      brechaReps: brecha,
      direccion: 'sin-datos',
      series: [],
      motivo: 'Sin series registradas ni carga pautada: no hay ancla para ondular.',
    }
  }

  /**
   * Con PRS bajo no se progresa: se suelta RIR sobre el objetivo. En crítico se
   * sueltan 2 y además se recorta una serie, que es el extremo suave del rango que
   * pide el método para la banda 0-2 (−1 a −2 series/grupo, RIR +1/+2).
   *
   * Lo que el motor NO hace y sigue siendo del coach: «quitar accesorios». Decidir
   * qué ejercicio sobra es criterio de sesión, no de ejercicio, y este motor ondula
   * uno a uno. Va anotado en el motivo.
   */
  const rir = critico
    ? ejercicio.rirObjetivo + 2
    : congelado
      ? ejercicio.rirObjetivo + 1
      : ejercicio.rirObjetivo

  const series: SeriePrescrita[] = []
  let cargaPrevia = 0
  for (let i = 0; i < sets; i++) {
    // Reps descendentes dentro del rango; con un solo set se usa la diana.
    const reps =
      sets === 1
        ? ejercicio.repsDiana
        : Math.round(rango.max - ((rango.max - rango.min) * i) / (sets - 1))
    const e1rmDelSet = e1rm * (1 - derivaFatiga * i)
    // La carga nunca retrocede dentro del ejercicio: cuando dos sets comparten
    // reps, la deriva de fatiga haría bajar el peso a media serie, y eso no es
    // lo que se hace en la sala.
    const carga = Math.max(
      redondearCarga(cargaObjetivo(e1rmDelSet, reps, rir), incrementoKg),
      cargaPrevia,
    )
    cargaPrevia = carga
    series.push({ orden: i + 1, reps, rir, cargaKg: carga })
  }

  const cargaAnterior = ejercicio.series[0]?.cargaKg ?? cargaPrescritaKg
  const cargaNueva = series[series.length - 1]?.cargaKg
  let direccion: EjercicioOndulado['direccion'] = 'estable'
  if (cargaAnterior !== undefined && cargaNueva !== undefined) {
    if (cargaNueva > cargaAnterior) direccion = 'subir'
    else if (cargaNueva < cargaAnterior) direccion = 'bajar'
  }

  const motivos: string[] = []
  if (brecha !== undefined && brecha !== 0) {
    motivos.push(
      brecha > 0
        ? `Hizo ${brecha} reps por encima de la diana: la carga iba corta.`
        : `Se quedó ${Math.abs(brecha)} reps por debajo: la carga iba por encima.`,
    )
  }
  // Solo se anota el rojo. El ámbar decía «progresión vigilada» y no vigilaba nada:
  // se comporta igual que el verde, así que el aviso le prometía al coach un matiz
  // que el motor no aplicaba. Si algún día el ámbar hace algo distinto, vuelve.
  if (critico) {
    motivos.push(
      `PRS crítico (NADA): se sostiene carga, +2 al RIR y ${ejercicio.sets} → ${sets} series. ` +
        'Valorar además quitar accesorios: eso lo decide el coach, no el motor.',
    )
  } else if (congelado) {
    motivos.push('PRS en rojo (POCO): se sostiene carga y se suma 1 al RIR.')
  }
  if (descarga) motivos.push(`Semana de descarga: ${ejercicio.sets} → ${sets} series.`)
  if (motivos.length === 0) motivos.push('Ejecución alineada con lo pautado.')

  return {
    ejercicioId: ejercicio.id,
    nombre: ejercicio.nombre,
    e1rm,
    brechaReps: brecha,
    direccion,
    series,
    motivo: motivos.join(' '),
  }
}

/**
 * Deja la ondulación guardada dentro del ejercicio, que es lo que permite que
 * el asesorado la vea serie por serie y que después se pueda auditar si el
 * microciclo quedó ondulado o no. Si no hay ancla para calcularla, el ejercicio
 * se devuelve intacto.
 */
export function aplicarOndulacion(
  ejercicio: EjercicioPrescrito,
  opciones: OpcionesOndulacion = {},
): EjercicioPrescrito {
  const { series } = ondularEjercicio(ejercicio, opciones)
  if (series.length === 0) return ejercicio
  // `cargaPrescritaKg` se recalcula con la ondulación: dejar la del microciclo
  // anterior sería guardar un ejercicio que se contradice a sí mismo, con las
  // series pidiendo unos kilos y su propia carga pautada diciendo otros.
  return {
    ...ejercicio,
    sets: series.length,
    cargaPrescritaKg: series[0].cargaKg,
    seriesPrescritas: series,
  }
}

/** Prescripción de una serie concreta (orden 1-based). */
export function seriePrescrita(
  ejercicio: EjercicioPrescrito,
  orden: number,
): SeriePrescrita | undefined {
  return ejercicio.seriesPrescritas?.find((s) => s.orden === orden)
}

/** Un ejercicio está ondulado cuando trae una prescripción por cada set. */
export function ejercicioOndulado(ejercicio: EjercicioPrescrito): boolean {
  return (ejercicio.seriesPrescritas?.length ?? 0) >= ejercicio.sets && ejercicio.sets > 0
}

/** Una sesión está ondulada cuando lo están todos sus ejercicios de fuerza. */
export function sesionOndulada(ejercicios: EjercicioPrescrito[]): boolean {
  return ejercicios.length > 0 && ejercicios.every(ejercicioOndulado)
}
