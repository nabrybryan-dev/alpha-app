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

/**
 * Suma días a una fecha ISO (`2026-07-20` + 8 → `2026-07-28`).
 *
 * Va por UTC sobre las partes de la fecha y no por `new Date(local)` como
 * `ranking.ts`: así el resultado no depende del huso del dispositivo. En Colombia
 * da lo mismo (no hay horario de verano), pero un asesorado de viaje no debería
 * cambiar el día en que le vence el microciclo por estar en otro país.
 */
export function sumarDias(fechaIso: string, dias: number): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number)
  const t = Date.UTC(anio, mes - 1, dia) + dias * 86_400_000
  const f = new Date(t)
  const dd = (n: number) => String(n).padStart(2, '0')
  return `${f.getUTCFullYear()}-${dd(f.getUTCMonth() + 1)}-${dd(f.getUTCDate())}`
}

export interface EstadoCierre {
  /** Si al microciclo le toca ya dar paso al siguiente. */
  vencido: boolean
  /** Qué lo venció. `undefined` mientras no vence. */
  motivo?: 'sesiones-completas' | 'calendario'
  /** Sesiones que se quedaron sin registrar. Se le avisa a Bryan, no bloquea. */
  sesionesPendientes: number
  /** Último día del microciclo según su cadencia. */
  fechaFin: string
}

/**
 * ¿Le toca ya al microciclo dar paso al siguiente?
 *
 * Vence por **lo que ocurra primero** (decisión de Bryan, 2026-08-01):
 *
 *   · Registró todas sus sesiones → terminó antes, no tiene sentido esperar.
 *   · Llegó su fecha de fin (`fechaInicio` + `cadenciaDias`) → aunque queden
 *     sesiones sin registrar.
 *
 * Cuando vence por calendario con sesiones a medias, **no se bloquea**: se cierra
 * y se avisa. Bloquear al que se enfermó o viajó le congelaría el programa por
 * algo normal, y arrastrar lo pendiente al microciclo siguiente deformaría su
 * carga y acumularía deuda semana tras semana.
 *
 * Cerrar no borra nada: las sesiones y las series se quedan dentro del microciclo
 * cerrado y el histórico las sigue leyendo.
 */
export function evaluarCierre(
  micro: { fechaInicio: string; cadenciaDias: number; sesiones: readonly unknown[] },
  hoyIso: string,
  sesionesPendientes: number,
): EstadoCierre {
  const fechaFin = sumarDias(micro.fechaInicio, micro.cadenciaDias)

  if (sesionesPendientes === 0 && micro.sesiones.length > 0) {
    return { vencido: true, motivo: 'sesiones-completas', sesionesPendientes: 0, fechaFin }
  }
  // Comparación de cadenas ISO: `2026-08-01` >= `2026-07-28` ordena bien.
  if (hoyIso >= fechaFin) {
    return { vencido: true, motivo: 'calendario', sesionesPendientes, fechaFin }
  }
  return { vencido: false, sesionesPendientes, fechaFin }
}

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
