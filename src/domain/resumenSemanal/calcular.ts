import type { CheckinDiario, Sesion } from '../types'
import { sesionCompleta } from '../cumplimiento'
import { regularidadDelSueno, type Regularidad } from '../sueno/regularidad'

/**
 * Los números de la semana de una persona: lo que va debajo del vídeo de su
 * revisión semanal.
 *
 * Es una función PURA y devuelve **hechos, no adjetivos**. Nada de «vas
 * regular» ni «buena semana»: los cortes que separan un «bien» de un «regular»
 * no los ha puesto nadie todavía, y ponerlos yo sería inventar un criterio de
 * entrenador. Cuando Bryan los escriba, se añaden aquí y se prueban.
 *
 * La única etiqueta que sí sale es la del sueño, y porque no es nuestra: el
 * índice de regularidad tiene una escala publicada. Ver `domain/sueno/`.
 */
export interface DatosDeLaSemana {
  /** Las sesiones del microciclo vigente. */
  sesiones: Sesion[]
  /** Los check-ins de la persona; se usan los de los últimos días para el sueño. */
  checkins: CheckinDiario[]
  /** Adherencia nutricional ya calculada, si la hay. */
  adherenciaPct?: number
}

export interface ResumenSemanal {
  sesionesHechas: number
  sesionesPautadas: number
  adherenciaPct?: number
  /** Check-ins registrados de los últimos siete días. */
  checkinsDeLaSemana: number
  regularidad: Regularidad
}

/** Días que mira la ventana de la semana. */
export const DIAS_DE_LA_VENTANA = 7

function ultimosDias(checkins: CheckinDiario[], dias: number): CheckinDiario[] {
  // Se ordena por fecha y se cogen los últimos: no se filtra por «hoy» porque
  // esta función es pura y no sabe qué día es. Quien la llama decide qué le da.
  return [...checkins].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-dias)
}

export function resumenSemanal(datos: DatosDeLaSemana): ResumenSemanal {
  const sesiones = datos.sesiones ?? []
  const semana = ultimosDias(datos.checkins ?? [], DIAS_DE_LA_VENTANA)

  return {
    sesionesHechas: sesiones.filter(sesionCompleta).length,
    sesionesPautadas: sesiones.length,
    adherenciaPct: datos.adherenciaPct,
    checkinsDeLaSemana: semana.length,
    // El sueño mira TODOS los check-ins que se le pasen y no solo siete: el
    // índice necesita noches seguidas, y recortar a siete de calendario dejaría
    // fuera justo las que completan la racha.
    regularidad: regularidadDelSueno(
      (datos.checkins ?? []).map((c) => ({
        fecha: c.fecha,
        horaAcostarse: c.horaAcostarse,
        horaLevantarse: c.horaLevantarse,
      })),
    ),
  }
}
