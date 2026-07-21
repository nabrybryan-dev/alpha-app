import type { EjercicioPrescrito, Sesion } from './types'

/**
 * Estimación de tiempos de una sesión para dar al asesorado un punto de
 * referencia: ¿cuánto debería durar cada bloque/ejercicio y voy en ritmo,
 * acelerado o se me está haciendo tarde? Son ESTIMACIONES basadas en la
 * prescripción (reps, series, descanso), no cronometraje exacto.
 */

const SEG_POR_REP = 3.5 // tiempo bajo tensión aproximado por repetición
const SEG_TRABAJO_MIN = 20 // una serie corta igual toma ~20 s
const SEG_TRABAJO_MAX = 90 // techo por serie (series muy largas / isométricas)
const SEG_MONTAJE = 60 // preparar el ejercicio: buscar peso, acomodarse
const CALENTAMIENTO_DEFECTO_MIN = 12 // si la sesión no trae duraciones marcadas

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

function segsTrabajoSerie(reps: number): number {
  return clamp(reps * SEG_POR_REP, SEG_TRABAJO_MIN, SEG_TRABAJO_MAX)
}

/** Duración estimada de un ejercicio: trabajo + descansos + montaje, en segundos. */
export function duracionEjercicioSeg(ej: EjercicioPrescrito): number {
  const trabajo = ej.sets * segsTrabajoSerie(ej.repsDiana)
  const descanso = ej.sets * ej.descansoMin * 60
  return Math.round(trabajo + descanso + SEG_MONTAJE)
}

/** Duración estimada del calentamiento (preparación + bloques marcables). */
export function duracionCalentamientoSeg(sesion: Sesion): number {
  const partes = [...(sesion.preparacion ?? []), ...(sesion.bloquesCardio ?? [])]
  const suma = partes.reduce((acc, p) => acc + (p.duracionMin ?? 0), 0)
  return (suma > 0 ? suma : CALENTAMIENTO_DEFECTO_MIN) * 60
}

/** Duración total estimada de la sesión, en segundos. */
export function duracionTotalSeg(sesion: Sesion): number {
  const ejercicios = sesion.ejercicios.reduce((acc, ej) => acc + duracionEjercicioSeg(ej), 0)
  return duracionCalentamientoSeg(sesion) + ejercicios
}

/**
 * Bloque al que pertenece un ejercicio, deducido de su categoría. Es una guía
 * (las categorías del Excel son libres), no una clasificación estricta.
 */
export type Bloque = 'FUERZA' | 'ACCESORIO' | 'DINÁMICO'

export function bloqueDeEjercicio(ej: EjercicioPrescrito): Bloque {
  const c = ej.categoria.toUpperCase()
  if (/(ISOM|CONTROL|ANTIRROT|ESTABIL|UNILATERAL|REACTIV|POTENCIA|INESTAB|CORE|BIRD|PLANCHA|PALLOF)/.test(c)) {
    return 'DINÁMICO'
  }
  if (/(AISLAM|EXTENSI|CURL|ABDUC|PATADA|MONOART|GEMELO|PANTORR|B[IÍ]CEPS|TR[IÍ]CEPS|LATERAL)/.test(c)) {
    return 'ACCESORIO'
  }
  return 'FUERZA'
}

export type EstadoRitmo = 'acelerado' | 'en-ritmo' | 'lento'

export interface RitmoSesion {
  totalSeg: number
  /** Cuánto tiempo "debería" llevar según lo ya registrado. */
  esperadoSeg: number
  estado: EstadoRitmo
  /** Índice (1-based) del ejercicio en curso; 0 si aún no empieza o ya terminó. */
  ejercicioActual: number
  totalEjercicios: number
  bloqueActual: Bloque | null
  /** Minutos estimados que resta el ejercicio en curso. */
  restaEjercicioMin: number
}

function fraccion(ej: EjercicioPrescrito): number {
  if (ej.sets <= 0) return 1
  return clamp(ej.series.length / ej.sets, 0, 1)
}

/**
 * Calcula el ritmo comparando el tiempo real del cronómetro (realSeg) contra el
 * tiempo esperado dado el avance. Umbrales generosos (±18 %) para no agobiar.
 */
export function calcularRitmo(sesion: Sesion, realSeg: number): RitmoSesion {
  const totalSeg = duracionTotalSeg(sesion)
  const calent = duracionCalentamientoSeg(sesion)
  const trabajoEsperado = sesion.ejercicios.reduce(
    (acc, ej) => acc + duracionEjercicioSeg(ej) * fraccion(ej),
    0,
  )
  const esperadoSeg = Math.round(calent + trabajoEsperado)

  const idx = sesion.ejercicios.findIndex((ej) => fraccion(ej) < 1)
  const ejercicioActual = idx === -1 ? 0 : idx + 1
  const enCurso = idx === -1 ? undefined : sesion.ejercicios[idx]
  const restaEjercicioMin = enCurso
    ? Math.max(0, Math.round((duracionEjercicioSeg(enCurso) * (1 - fraccion(enCurso))) / 60))
    : 0

  let estado: EstadoRitmo = 'en-ritmo'
  if (esperadoSeg > 0) {
    if (realSeg > esperadoSeg * 1.18) estado = 'lento'
    else if (realSeg < esperadoSeg * 0.82) estado = 'acelerado'
  }

  return {
    totalSeg,
    esperadoSeg,
    estado,
    ejercicioActual,
    totalEjercicios: sesion.ejercicios.length,
    bloqueActual: enCurso ? bloqueDeEjercicio(enCurso) : null,
    restaEjercicioMin,
  }
}

/** Formatea segundos como "1h 25m" o "48m". */
export function formatoDuracion(seg: number): string {
  const totalMin = Math.round(seg / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}
