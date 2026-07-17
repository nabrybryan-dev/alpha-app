import type { EjercicioPrescrito, Microciclo, SerieRegistrada, Sesion } from './types'

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

export function sesionCompleta(sesion: Sesion): boolean {
  if (sesion.tipo === 'metabolica') {
    const bloques = sesion.bloquesCardio ?? []
    return bloques.length > 0 && bloques.every((b) => Boolean(b.hechoEn))
  }
  return sesionRegistrada(sesion.ejercicios)
}

export type EstadoPreparacion = 'hecha' | 'parcial' | 'omitida' | 'pendiente'

export function estadoPreparacion(sesion: Sesion): EstadoPreparacion {
  const partes = sesion.preparacion ?? []
  const hechas = partes.filter((p) => p.hechoEn).length
  if (partes.length > 0 && hechas === partes.length) return 'hecha'
  if (hechas > 0) return 'parcial'
  return sesionCompleta(sesion) ? 'omitida' : 'pendiente'
}

export interface ResumenMicrociclo {
  sesionesTotales: number
  sesionesRegistradas: number
  pctRegistrado: number
}

export function resumenMicrociclo(micro: Microciclo): ResumenMicrociclo {
  const sesionesTotales = micro.sesiones.length
  const sesionesRegistradas = micro.sesiones.filter(sesionCompleta).length
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
