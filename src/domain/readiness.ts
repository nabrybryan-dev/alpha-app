import { desviacionRir } from './cumplimiento'
import type { Cantidad3, CheckinDiario, Cualitativo3, Microciclo } from './types'

/**
 * Índice de recuperación 0-100 (adaptación del índice de Hooper del motor de
 * decisión, sección 04-autorregulación): promedia las señales subjetivas de
 * los check-ins recientes. 100 = fresco; <50 = fatiga acumulada.
 */
const CANTIDAD_INVERSA: Record<Cantidad3, number> = { POCO: 100, REGULAR: 55, MUCHO: 10 }
const CANTIDAD_DIRECTA: Record<Cantidad3, number> = { POCO: 10, REGULAR: 55, MUCHO: 100 }
const CALIDAD: Record<Cualitativo3, number> = { MALA: 10, REGULAR: 55, BUENA: 100 }

function puntajeSueno(horas: number): number {
  if (horas >= 8) return 100
  if (horas >= 7) return 85
  if (horas >= 6) return 60
  if (horas >= 5) return 35
  return 15
}

function fechaAtras(hoy: string, dias: number): string {
  const fecha = new Date(`${hoy}T00:00:00`)
  fecha.setDate(fecha.getDate() - dias)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export interface Recuperacion {
  /** 0-100, o undefined si no hay check-ins en la ventana. */
  indice: number | undefined
  /** Check-ins usados en el cálculo. */
  dias: number
}

export function indiceRecuperacion(
  checkins: CheckinDiario[],
  hoy: string,
  ventanaDias = 7,
): Recuperacion {
  const limite = fechaAtras(hoy, ventanaDias)
  const recientes = checkins.filter((c) => c.fecha >= limite && c.fecha <= hoy)
  const puntajes: number[] = []
  for (const c of recientes) {
    const senales: number[] = []
    if (c.cansancio) senales.push(CANTIDAD_INVERSA[c.cansancio])
    if (c.estres) senales.push(CANTIDAD_INVERSA[c.estres])
    if (c.motivacion) senales.push(CANTIDAD_DIRECTA[c.motivacion])
    if (c.calidadSueno) senales.push(CALIDAD[c.calidadSueno])
    if (c.horasSueno !== undefined) senales.push(puntajeSueno(c.horasSueno))
    if (senales.length > 0) {
      puntajes.push(senales.reduce((a, b) => a + b, 0) / senales.length)
    }
  }
  if (puntajes.length === 0) return { indice: undefined, dias: 0 }
  return {
    indice: Math.round(puntajes.reduce((a, b) => a + b, 0) / puntajes.length),
    dias: puntajes.length,
  }
}

/**
 * Desviación media del RIR real vs el objetivo en el microciclo (señal de
 * carga del motor 02): positivo = entrena más lejos del fallo que lo pautado
 * (carga corta); negativo = más cerca del fallo (carga larga).
 */
export function desviacionRirMedia(microciclo: Microciclo | undefined): number | undefined {
  if (!microciclo) return undefined
  const desviaciones: number[] = []
  for (const sesion of microciclo.sesiones) {
    for (const ejercicio of sesion.ejercicios) {
      const d = desviacionRir(ejercicio.rirObjetivo, ejercicio.series)
      if (d !== undefined) desviaciones.push(d)
    }
  }
  if (desviaciones.length === 0) return undefined
  return Math.round((desviaciones.reduce((a, b) => a + b, 0) / desviaciones.length) * 10) / 10
}
