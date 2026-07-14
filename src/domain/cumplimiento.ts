import type { EjercicioPrescrito, Microciclo, SerieRegistrada } from './types'

export function desviacionRir(
  rirObjetivo: number,
  series: SerieRegistrada[],
): number | undefined {
  if (series.length === 0) return undefined
  const promedio = series.reduce((suma, s) => suma + s.rir, 0) / series.length
  return Math.round((promedio - rirObjetivo) * 10) / 10
}

export function ejercicioCompleto(ejercicio: EjercicioPrescrito): boolean {
  return ejercicio.series.length >= ejercicio.sets
}

export function sesionRegistrada(ejercicios: EjercicioPrescrito[]): boolean {
  return ejercicios.length > 0 && ejercicios.every(ejercicioCompleto)
}

export interface ResumenMicrociclo {
  sesionesTotales: number
  sesionesRegistradas: number
  pctRegistrado: number
}

export function resumenMicrociclo(micro: Microciclo): ResumenMicrociclo {
  const sesionesTotales = micro.sesiones.length
  const sesionesRegistradas = micro.sesiones.filter((s) => sesionRegistrada(s.ejercicios)).length
  return {
    sesionesTotales,
    sesionesRegistradas,
    pctRegistrado:
      sesionesTotales === 0 ? 0 : Math.round((sesionesRegistradas / sesionesTotales) * 100),
  }
}

export type ColorSemaforo = 'verde' | 'ambar' | 'rojo'

export interface Semaforo {
  color: ColorSemaforo
  motivo: string
}

export function semaforoAsesorado(datos: {
  diasSinRegistrar: number
  readinessBaja: boolean
}): Semaforo {
  if (datos.diasSinRegistrar >= 4) {
    return { color: 'rojo', motivo: `${datos.diasSinRegistrar} días sin registrar` }
  }
  if (datos.diasSinRegistrar >= 2) {
    return { color: 'ambar', motivo: `${datos.diasSinRegistrar} días sin registrar` }
  }
  if (datos.readinessBaja) {
    return { color: 'ambar', motivo: 'Readiness baja esta semana' }
  }
  return { color: 'verde', motivo: 'Al día' }
}
