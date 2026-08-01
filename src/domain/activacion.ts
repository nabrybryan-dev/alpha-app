/**
 * ¿Puede activarse sola la propuesta del microciclo siguiente, o tiene que verla
 * Bryan antes?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ────────────────────────────────────────────────────────────────────────────
 * La activación es el momento en que una prescripción **le llega a una persona**
 * que la va a ejecutar en el gimnasio. Activar automáticamente es cómodo y es lo
 * que se decidió, pero solo tiene sentido cuando el dato de partida es bueno: el
 * motor calcula sobre lo que el asesorado registró, y si registró poco o raro, la
 * propuesta es una extrapolación con cara de certeza.
 *
 * Así que aquí no se decide qué prescribir —eso es `ondulacion.ts`— sino algo más
 * modesto y más importante: **si nos podemos fiar lo bastante como para no mirar**.
 *
 * Los cinco umbrales los fijó Bryan el 2026-07-31. Son criterio de entrenamiento,
 * no de software: si alguno se cambia, se cambia con él, no por conveniencia.
 */

/** Sesiones del microciclo que se pueden quedar sin registrar y aun así fiarse. */
export const MAX_SESIONES_SIN_REGISTRAR = 1

/** Proporción de ejercicios sin ninguna serie registrada que se tolera. */
export const MAX_EJERCICIOS_SIN_SERIES = 0.2

/**
 * PRS mínimo para activar sin mirar. Por debajo (POCO = 3, NADA = 1) la decisión
 * de progresar deja de ser automática: llegó mal recuperado y eso lo valora una
 * persona.
 */
export const PRS_MINIMO_AUTO = 4

/**
 * Salto de carga máximo respecto a lo anterior, a igual número de reps. Un salto
 * grande casi nunca es una mejora real: suele venir de una serie mal registrada
 * que infla el 1RM estimado.
 */
export const MAX_SALTO = 0.1

/**
 * Distancia máxima entre las reps hechas y la diana. Si se alejó mucho, la
 * prescripción no casaba con la realidad, y repetir la fórmula sobre ella
 * amplifica el error en vez de corregirlo.
 */
export const MAX_BRECHA_REPS = 3

export interface SenalesPropuesta {
  sesionesSinRegistrar: number
  ejerciciosSinSeries: number
  ejerciciosTotales: number
  /** PRS más reciente del microciclo que se cierra. */
  prsUltimo?: number
  /** Mayor salto de carga propuesto, en tanto por uno (0.12 = +12 %). */
  saltoMaximo?: number
  /** Mayor distancia entre reps hechas y diana, en valor absoluto. */
  brechaMaxima?: number
}

export interface RevisionActivacion {
  /** Si puede activarse sin que nadie la mire. */
  auto: boolean
  /** Por qué NO puede. Vacío cuando `auto` es true. Se le muestran a Bryan. */
  motivos: string[]
}

/**
 * Una señal que falta no bloquea por sí sola: que no haya PRS significa que no
 * llenó el test, y eso ya lo cazan las sesiones sin registrar. Bloquear también
 * por el hueco convertiría cualquier microciclo incompleto en dos avisos del
 * mismo problema.
 */
export function revisarActivacion(s: SenalesPropuesta): RevisionActivacion {
  const motivos: string[] = []

  if (s.sesionesSinRegistrar > MAX_SESIONES_SIN_REGISTRAR) {
    motivos.push(`${s.sesionesSinRegistrar} sesiones sin registrar`)
  }

  if (s.ejerciciosTotales > 0) {
    const proporcion = s.ejerciciosSinSeries / s.ejerciciosTotales
    if (proporcion > MAX_EJERCICIOS_SIN_SERIES) {
      const pct = Math.round(proporcion * 100)
      motivos.push(`${pct} % de los ejercicios sin ninguna serie registrada`)
    }
  }

  if (s.prsUltimo !== undefined && s.prsUltimo < PRS_MINIMO_AUTO) {
    motivos.push(`entró mal recuperado (PRS ${s.prsUltimo})`)
  }

  if (s.saltoMaximo !== undefined && s.saltoMaximo > MAX_SALTO) {
    motivos.push(`salto de carga de +${Math.round(s.saltoMaximo * 100)} % en algún ejercicio`)
  }

  if (s.brechaMaxima !== undefined && s.brechaMaxima > MAX_BRECHA_REPS) {
    motivos.push(`reps a ${s.brechaMaxima} de la diana: lo pautado no casaba`)
  }

  return { auto: motivos.length === 0, motivos }
}
