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
  const bloques = sesion.bloquesCardio ?? []
  const bloquesHechos = bloques.length > 0 && bloques.every((b) => Boolean(b.hechoEn))

  if (sesion.tipo === 'metabolica') return bloquesHechos

  /**
   * Sin ejercicios prescritos, lo unico que hay para cerrar son los bloques —
   * lo diga o no la etiqueta.
   *
   * La Zona 2 de una asesorada venia marcada `fuerza` con CERO ejercicios y dos
   * bloques (2026-08-25). `sesionRegistrada([])` es false siempre, asi que podia
   * tildar los dos bloques y la sesion no se cerraba nunca — ni contaba en
   * `pctRegistrado`, que es el porcentaje con el que se decide si sube la carga.
   *
   * Es la misma trampa que el #100 quito de la pantalla: `tipo` describe, no
   * decide. Aqui se arregla SOLO la mitad sin ejercicios. Una `metabolica` CON
   * ejercicios dentro sigue juzgandose por sus bloques: eso es una decision
   * distinta, esta pinneada por sus propios tests y no es mia.
   */
  if (sesion.ejercicios.length === 0) return bloquesHechos

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
