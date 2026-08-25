import type { EjercicioPrescrito, Microciclo, SerieRegistrada, Sesion } from './types'

export function desviacionRir(
  rirObjetivo: number,
  series: SerieRegistrada[],
): number | undefined {
  // Las series sin RIR se saltan, no cuentan como 0: una plancha isométrica no
  // llegó al fallo, es que no se mide así. Ver `SerieRegistrada`.
  const conRir = series.filter((s): s is SerieRegistrada & { rir: number } => s.rir !== undefined)
  if (conRir.length === 0) return undefined
  const promedio = conRir.reduce((suma, s) => suma + s.rir, 0) / conRir.length
  return Math.round((promedio - rirObjetivo) * 10) / 10
}

export function ejercicioCompleto(ejercicio: EjercicioPrescrito): boolean {
  return ejercicio.series.length >= ejercicio.sets
}

export function sesionRegistrada(ejercicios: EjercicioPrescrito[]): boolean {
  return ejercicios.length > 0 && ejercicios.every(ejercicioCompleto)
}

export function sesionCompleta(sesion: Sesion): boolean {
  /**
   * Lo decide el CONTENIDO, no la etiqueta `tipo`.
   *
   * **Si hay ejercicios, mandan los ejercicios** — aunque la sesion este marcada
   * `metabolica`. Hasta el 2026-08-25 una metabolica se cerraba con solo tildar
   * sus bloques, asi que las dos que tenian ejercicios dentro —7 de una asesorada
   * y 6 de otra— se daban por completas con los 13 sin registrar. Y ese 100 %
   * es el que alimenta el «tiene margen sin usar -> sube la carga». Un ejercicio
   * con series y kilos genera fatiga: si no se registra, la sesion no esta hecha.
   *
   * **Sin ejercicios, la cierran sus bloques** — lo diga o no la etiqueta. Una
   * ZONA 2 + MOVILIDAD venia marcada `fuerza` con cero ejercicios y dos bloques,
   * y `sesionRegistrada([])` es false siempre: no se cerraba nunca.
   *
   * Lo que NO se hace es exigir las dos cosas. Una sesion de fuerza con un bloque
   * de movilidad delante seguiria sin cerrarse hasta tildarlo, y eso bajaria la
   * adherencia de media cartera por un calentamiento sin marcar. La regla es
   * «manda lo que prescribe carga», no «manda todo».
   */
  if (sesion.ejercicios.length > 0) return sesionRegistrada(sesion.ejercicios)

  const bloques = sesion.bloquesCardio ?? []
  return bloques.length > 0 && bloques.every((b) => Boolean(b.hechoEn))
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
