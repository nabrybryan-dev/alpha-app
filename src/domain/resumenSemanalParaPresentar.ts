import { resumenMicrociclo } from './cumplimiento'
import { porcentajeAdherencia } from './nutricion/adherencia'
import type { AdherenciaNutricional, CheckinDiario, MedidaCorporal, Microciclo } from './types'

/**
 * Lo que Manuela abre para mostrarle a un asesorado en la llamada (8-oct-2026,
 * pedido por Bryan): los números reales de ESTA semana, nada inventado.
 *
 * NO vuelve a calcular nada que ya calcule otra pantalla — reutiliza
 * `resumenMicrociclo` (lo mismo que usa `calculosDeLaRuta` para el salón) y
 * `porcentajeAdherencia` (lo mismo que usa Nutrición). Si un día se corrige
 * cómo se cuenta una sesión completa, esta pantalla lo hereda sola.
 *
 * Cada número es opcional por separado y por la misma razón que el resto del
 * dominio: sin dato no se inventa uno, se omite. Una presentación con un hueco
 * es honesta; una con un número relleno no lo es.
 */
export interface ResumenSemanalParaPresentar {
  microcicloNumero: number
  sesiones: { registradas: number; totales: number }
  /** Promedio de horas de sueño de los check-ins de esta semana. */
  horasSuenoPromedio?: number
  /** Adherencia nutricional SOLO de los días de esta semana (no histórica). */
  adherenciaNutricionPct?: number
  /** El peso más reciente que tenga registrado, sea de esta semana o de antes. */
  pesoKg?: number
  /** Cuánto cambió desde la medida más vieja dentro de la ventana, y en cuántos días. */
  pesoDelta?: { kg: number; dias: number }
}

/** Cuántos días hacia atrás cuenta como "esta semana" para sueño y adherencia,
 *  cuando el microciclo no trae su propia ventana clara. */
const VENTANA_DIAS = 7

function diasEntre(desde: string, hasta: string): number {
  const ms = new Date(`${hasta}T00:00:00`).getTime() - new Date(`${desde}T00:00:00`).getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

function promedio(valores: readonly number[]): number | undefined {
  if (valores.length === 0) return undefined
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10
}

export function resumenSemanalParaPresentar(
  microciclo: Microciclo | undefined,
  checkins: readonly CheckinDiario[],
  adherencias: readonly AdherenciaNutricional[],
  medidas: readonly MedidaCorporal[],
  hoy: string,
): ResumenSemanalParaPresentar | undefined {
  if (!microciclo) return undefined

  // La ventana es desde que arrancó el microciclo o los últimos 7 días, lo que sea más
  // corto — un microciclo que lleva 2 días no promedia sueño de una semana que no vivió.
  const inicioVentana =
    diasEntre(microciclo.fechaInicio, hoy) < VENTANA_DIAS ? microciclo.fechaInicio : undefined

  const enVentana = <T extends { fecha: string }>(items: readonly T[]): T[] =>
    items.filter((i) => {
      if (i.fecha > hoy) return false
      return inicioVentana ? i.fecha >= inicioVentana : diasEntre(i.fecha, hoy) < VENTANA_DIAS
    })

  const checkinsSemana = enVentana(checkins)
  const adherenciasSemana = enVentana(adherencias)

  const horasSueno = checkinsSemana
    .map((c) => c.horasSueno)
    .filter((h): h is number => h !== undefined)

  const medidasConPeso = [...medidas]
    .filter((m) => m.pesoKg !== undefined)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ultimaMedida = medidasConPeso.at(-1)
  // La más vieja DENTRO de los últimos 14 días: comparar contra algo de hace meses
  // contaría una tendencia que no es la de ahora.
  const medidaPrevia = [...medidasConPeso]
    .filter((m) => m.fecha !== ultimaMedida?.fecha && diasEntre(m.fecha, hoy) <= 14)
    .at(0)

  return {
    microcicloNumero: microciclo.numero,
    sesiones: (() => {
      const r = resumenMicrociclo(microciclo)
      return { registradas: r.sesionesRegistradas, totales: r.sesionesTotales }
    })(),
    horasSuenoPromedio: promedio(horasSueno),
    adherenciaNutricionPct: adherenciasSemana.length > 0 ? porcentajeAdherencia(adherenciasSemana) : undefined,
    pesoKg: ultimaMedida?.pesoKg,
    pesoDelta:
      ultimaMedida && medidaPrevia && medidaPrevia.pesoKg !== undefined && ultimaMedida.pesoKg !== undefined
        ? {
            kg: Math.round((ultimaMedida.pesoKg - medidaPrevia.pesoKg) * 10) / 10,
            dias: diasEntre(medidaPrevia.fecha, ultimaMedida.fecha),
          }
        : undefined,
  }
}
