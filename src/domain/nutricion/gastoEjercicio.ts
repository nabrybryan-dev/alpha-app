/**
 * Lo que cuesta entrenar, en kcal, para poder restarlo de lo que se comió.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTO NO ES UN ADORNO
 * ─────────────────────────────────────────────────────────────────────────────
 * La disponibilidad energética es `(ingesta − gasto de entreno) / masa magra`.
 * Mientras el gasto contaba como CERO, el error no era neutro: iba en la
 * dirección mala. Sin restar nada la disponibilidad sale MÁS ALTA de lo real, y
 * la alerta se calla justo en quien entrenó y no comió, que es la única persona
 * para la que existe.
 *
 * Un caso real de la cuenta: come 1.600 y quema 400 → disponibilidad 26,3, que
 * es problema. Con el gasto en cero la app calcula 35,1, que es "bien", y no
 * dice nada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DE DÓNDE SALEN LOS NÚMEROS
 * ─────────────────────────────────────────────────────────────────────────────
 * `kcal = 0,0175 × kg × MET × min` y los MET son los de la calculadora de cinta
 * del equipo (`wiki/conocimiento/calculadora-cinta-neat.md`), que a su vez
 * coinciden con las tablas del Anexo. No hay MET publicado allí para una sesión
 * metabólica, así que NO se inventa uno: se usa el de pesas para todo lo que sea
 * entrenar. Eso deja el estimado por debajo de lo que cuesta de verdad una
 * sesión metabólica, y ese lado del error es el aceptable — el traspaso lo deja
 * escrito: el suelo es mejor que el cero, y el cero es mejor que un número alto
 * inventado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ UNA MEDIA DIARIA Y NO EL GASTO DE HOY
 * ─────────────────────────────────────────────────────────────────────────────
 * Porque la ingesta con la que se compara ya es una media de la ventana
 * (`ventanaEnergetica`). Restar el entreno de UN día a la ingesta media de siete
 * mezclaría dos escalas y daría una disponibilidad que no es de ningún día. El
 * total de la ventana se reparte entre todos sus días, incluidos los de
 * descanso: así lo que se resta y lo que se suma hablan del mismo periodo.
 */

/** `kcal = FACTOR_KCAL × kg × MET × min`. */
export const FACTOR_KCAL = 0.0175

/** Sesión de pesas. Fuente: calculadora de cinta/NEAT del equipo. */
export const MET_PESAS = 3.5

/** Caminar. Sirve para los bloques de cardio de bajo impacto. */
export const MET_CAMINAR = 3

/**
 * Minutos que se asumen cuando consta que entrenó pero no cuánto.
 *
 * Es un SUELO, no una estimación centrada: se queda corto a propósito. Quien
 * entrena de verdad pasa de aquí, así que el gasto calculado será menor que el
 * real y la disponibilidad saldrá algo más alta — el mismo lado seguro por el
 * que no se inventa el MET de una metabólica.
 */
export const MINUTOS_SUELO = 45

export interface DiaDeEntreno {
  fecha: string
  /** Minutos del test post. `null` = entrenó, pero no dejó cuánto. */
  minutos: number | null
  /** Por si algún día se distingue la modalidad. Por defecto, pesas. */
  met?: number
}

export interface GastoEjercicio {
  /** Media de kcal al día en la ventana. Es lo que se resta de la ingesta. */
  kcalDia: number
  /** Sobre cuántos días se repartió. */
  dias: number
  /** Cuántas sesiones entraron. */
  sesiones: number
  /**
   * Cuántas de ellas no traían duración y se calcularon con un estimado.
   *
   * Viaja con el resultado para que la tarjeta pueda decirlo. Un gasto estimado
   * y uno medido no se leen igual, y esconder cuál es cuál es exactamente lo
   * que hacía el cero.
   */
  estimadas: number
}

/**
 * Lo que cuesta una sesión. `null` si falta el peso o los minutos no son reales.
 *
 * Mismo criterio que en `grasaPct`: antes que un número inventado, nada. Un cero
 * aquí se leería como "no gastó", que es justo el error que este módulo viene a
 * corregir.
 */
export function kcalDeSesion(
  pesoKg: number | null,
  minutos: number,
  met: number = MET_PESAS,
): number | null {
  if (!pesoKg || !Number.isFinite(pesoKg) || pesoKg <= 0) return null
  if (!Number.isFinite(minutos) || minutos <= 0) return null
  return Math.round(FACTOR_KCAL * pesoKg * met * minutos)
}

/**
 * Cuánto dura una sesión de esta persona, según las que sí registró.
 *
 * Mediana y no media: una sesión de tres horas —el cronómetro que alguien dejó
 * corriendo— arrastra la media y no mueve la mediana.
 */
export function minutosTipicos(duraciones: readonly number[]): number | null {
  const validas = duraciones.filter((m) => Number.isFinite(m) && m > 0).sort((a, b) => a - b)
  if (validas.length === 0) return null
  const medio = Math.floor(validas.length / 2)
  return validas.length % 2 === 0 ? (validas[medio - 1] + validas[medio]) / 2 : validas[medio]
}

/**
 * Si un check-in dice que ese día se entrenó.
 *
 * Es la MISMA regla que ya usa la gamificación para contar días de entreno
 * (`useGamificacion`): hay algo escrito y no es «descanso». Se escribe aquí una
 * sola vez porque dos definiciones de «entrenó» acabarían discrepando, y la que
 * discrepara en silencio sería esta, que decide si suena una alerta de salud.
 */
export function entrenoEseDia(checkin: { entreno?: string }): boolean {
  const valor = checkin.entreno?.trim()
  return !!valor && valor.toLowerCase() !== 'descanso'
}

/**
 * Los días de entreno de la ventana, sacados del check-in diario.
 *
 * El check-in es la única señal con FECHA que dice si alguien entrenó: una
 * `Sesion` no la lleva, solo su día de la semana y su orden dentro del
 * microciclo. Por eso el gasto se cuenta desde aquí y la duración se busca
 * aparte.
 *
 * Ninguno trae minutos —el check-in no los pregunta—, así que todos salen con
 * `minutos: null` y los resolverá `gastoEjercicioDiario` con la duración típica
 * de la persona o, a falta de ella, con el suelo.
 */
export function entrenosEnVentana(
  checkins: readonly { fecha: string; entreno?: string }[],
  hoy: string,
  dias: number,
): DiaDeEntreno[] {
  return checkins
    .filter((c) => c.fecha < hoy && entrenoEseDia(c))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, dias)
    .map((c) => ({ fecha: c.fecha, minutos: null }))
}

/**
 * La media diaria de gasto por entrenar en la ventana.
 *
 * `null` significa "no se puede calcular" (sin peso no hay fórmula), y quien lo
 * reciba tiene que callar. Un resultado con `sesiones: 0` es otra cosa muy
 * distinta: es una respuesta, y dice que no entrenó.
 */
export function gastoEjercicioDiario(
  entrenos: readonly DiaDeEntreno[],
  pesoKg: number | null,
  dias: number,
  minutosDeLaPersona: number | null = null,
): GastoEjercicio | null {
  if (!pesoKg || !Number.isFinite(pesoKg) || pesoKg <= 0) return null
  if (!Number.isFinite(dias) || dias <= 0) return null

  // Una fecha, un entreno. Repetir un día inflaría el gasto sin que se notara.
  const porFecha = new Map<string, DiaDeEntreno>()
  for (const e of entrenos) {
    if (!porFecha.has(e.fecha)) porFecha.set(e.fecha, e)
  }

  const usables = [...porFecha.values()]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, dias)

  let total = 0
  let estimadas = 0
  for (const e of usables) {
    const medidos = Number.isFinite(e.minutos ?? Number.NaN) && (e.minutos ?? 0) > 0
    // Sus propias sesiones antes que el suelo: un estimado con su historia
    // encima se acerca más que una constante igual para todos.
    const minutos = medidos ? (e.minutos as number) : (minutosDeLaPersona ?? MINUTOS_SUELO)
    if (!medidos) estimadas += 1
    total += kcalDeSesion(pesoKg, minutos, e.met ?? MET_PESAS) ?? 0
  }

  return {
    kcalDia: Math.round(total / dias),
    dias,
    sesiones: usables.length,
    estimadas,
  }
}
