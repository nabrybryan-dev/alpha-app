import { comparablesPorHora, type AvisoDeHora } from './tanda'
import type { NivelCalidad } from './nucleo/analisis'

/**
 * Qué entra en la tendencia del historial, y qué tramos no se pueden comparar.
 *
 * ## `cargaKg` no es opcional aquí, y es a propósito
 *
 * La gráfica compara la velocidad de la primera repetición a lo largo de las
 * semanas, y **eso solo significa algo a igual carga**: la velocidad baja cuando
 * subes el peso, así que una serie de puntos que mezcla 100 y 110 kg dibuja una
 * caída que se lee como pérdida de forma cuando es exactamente lo contrario.
 * Dejar el campo opcional habría hecho que la pantalla funcionara con datos que
 * no puede interpretar, que es la peor de las dos formas de fallar.
 */
export interface TomaDelHistorial {
  fecha: string
  vPrimera: number
  calidad: NivelCalidad
  cargaKg: number
}

export interface TramoDelHistorial {
  desde: TomaDelHistorial
  hasta: TomaDelHistorial
  aviso: AvisoDeHora
  /** La carga cambió entre las dos: comparar la velocidad ya no dice progreso. */
  cargaCambio: boolean
}

/**
 * Los puntos que se pintan.
 *
 * Las descartadas **no aparecen**: su número es falso, y un punto falso en una
 * serie temporal no se distingue de uno real por la forma. Las dudosas sí se
 * pintan, en hueco, porque su número existe — pero no cuentan para la línea.
 */
export function puntosDelHistorial(tomas: TomaDelHistorial[]): TomaDelHistorial[] {
  return tomas
    .filter((t) => t.calidad !== 'descartada' && Number.isFinite(t.vPrimera))
    .slice()
    .sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha))
}

/** Las que sostienen la línea de tendencia. Solo buenas. */
export function tomasDeLaTendencia(tomas: TomaDelHistorial[]): TomaDelHistorial[] {
  return puntosDelHistorial(tomas).filter((t) => t.calidad === 'buena')
}

/**
 * Los tramos entre puntos consecutivos de la tendencia.
 *
 * Se compara cada toma con **la anterior**, no dos sueltas: con seis puntos hay
 * cinco comparaciones, y el aviso tiene que poder señalar cuál de los tramos es
 * el que no se sostiene. Un solo aviso para toda la gráfica diría que ninguna
 * pareja se compara, que casi nunca es verdad.
 */
export function tramosDelHistorial(tomas: TomaDelHistorial[]): TramoDelHistorial[] {
  const puntos = tomasDeLaTendencia(tomas)
  const tramos: TramoDelHistorial[] = []
  for (let i = 1; i < puntos.length; i++) {
    const desde = puntos[i - 1]
    const hasta = puntos[i]
    tramos.push({
      desde,
      hasta,
      aviso: comparablesPorHora(desde.fecha, hasta.fecha),
      cargaCambio: desde.cargaKg !== hasta.cargaKg,
    })
  }
  return tramos
}

/**
 * El tramo que la pantalla señala, si hay alguno.
 *
 * Manda el **más reciente** que no se sostiene, y no el peor: el historial se
 * mira para decidir qué hacer ahora, y la comparación que importa es contra la
 * última toma. Entre los no comparables gana el que rompe del todo sobre el que
 * solo avisa.
 */
export function tramoQueSeñalar(tomas: TomaDelHistorial[]): TramoDelHistorial | undefined {
  const tramos = tramosDelHistorial(tomas)
  for (let i = tramos.length - 1; i >= 0; i--) {
    if (!tramos[i].aviso.comparables) return tramos[i]
  }
  for (let i = tramos.length - 1; i >= 0; i--) {
    if (tramos[i].aviso.aviso) return tramos[i]
  }
  return undefined
}

/** Con menos de dos tomas buenas no hay tendencia que enseñar. */
export function hayTendencia(tomas: TomaDelHistorial[]): boolean {
  return tomasDeLaTendencia(tomas).length >= 2
}
