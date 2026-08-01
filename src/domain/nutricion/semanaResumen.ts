import type { RegistroComida } from '../types'
import type { AlimentoIndice } from './busqueda'
import { resumenDelDia } from './resumen'

/**
 * Lo que suma una semana de registro, día a día.
 *
 * EL PROMEDIO SOLO CUENTA LOS DÍAS REGISTRADOS. Un día en blanco no es un día
 * de cero calorías: es un día que no se anotó. Meterlo en la media como 0
 * hundiría el promedio y haría creer -al asesorado y al coach- que comió mucho
 * menos de lo que comió. Es la diferencia entre "no cumplió" y "no registró", y
 * las dos piden decisiones opuestas: una es ajustar el plan, la otra es
 * preguntarle qué pasó.
 */

type BuscarAlimento = (id: string) => AlimentoIndice | undefined

export interface DiaDeLaSemana {
  fecha: string
  kcal: number
  proteinaG: number
  /** `false` cuando no anotó nada. Distinto de haber anotado 0. */
  registrado: boolean
}

export interface ResumenSemana {
  dias: DiaDeLaSemana[]
  /** Días con algo anotado, de 7. */
  diasRegistrados: number
  /** Media de kcal SOLO de los días registrados. 0 si no hay ninguno. */
  promedioKcal: number
  promedioProteinaG: number
  /** Diferencia contra la pauta diaria. Negativo = por debajo. */
  contraPauta: number
  /** Comidas con algo dentro en toda la semana. */
  comidasRegistradas: number
}

export function resumenDeSemana(
  porDia: RegistroComida[][],
  fechas: string[],
  porId: BuscarAlimento,
  pautaKcal: number,
): ResumenSemana {
  const dias = porDia.map((comidas, i) => {
    const conAlgo = comidas.filter((c) => c.items.length > 0)
    const total = resumenDelDia(conAlgo, porId)
    return {
      fecha: fechas[i] ?? '',
      kcal: Math.round(total.porDia.kcal ?? 0),
      proteinaG: Math.round(total.porDia.proteina_g ?? 0),
      registrado: conAlgo.length > 0,
    }
  })

  const registrados = dias.filter((d) => d.registrado)
  const media = (valores: number[]) =>
    valores.length === 0 ? 0 : Math.round(valores.reduce((a, b) => a + b, 0) / valores.length)

  const promedioKcal = media(registrados.map((d) => d.kcal))

  return {
    dias,
    diasRegistrados: registrados.length,
    promedioKcal,
    promedioProteinaG: media(registrados.map((d) => d.proteinaG)),
    // Sin ningún día registrado no hay nada que comparar: cero, y no un déficit
    // de 2.100 kcal que nadie ha tenido.
    contraPauta: registrados.length === 0 ? 0 : promedioKcal - pautaKcal,
    comidasRegistradas: porDia.flat().filter((c) => c.items.length > 0).length,
  }
}
