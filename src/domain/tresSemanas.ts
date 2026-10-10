import { pautadoVsHechoDe } from './pautadoVsHecho'
import { semanaEsAdelantada, semanaEsVencida } from './rutaEntrenamiento'
import type { Microciclo } from './types'

/**
 * LA SEMANA PASADA, ESTA Y LA QUE VIENE (10-oct-2026, la presentación para el asesorado).
 *
 * Bryan, literal: «quiero que se pueda desplegar tanto la semana en la que estamos, como la
 * semana que viene y la semana pasada… cuando yo quiero presentar el plan para ver el pasado,
 * el presente y el futuro». Aquí solo se DECIDE cuál microciclo es cuál; qué se pinta de cada
 * uno es de la sección.
 *
 * POR QUÉ NO SE USA `estado` PARA ELEGIR. La base real lo desmiente el mismo día que se pidió
 * esto: había un microciclo `cerrado` que era el que cubre la fecha de hoy (se cerró el viernes
 * porque el siguiente ya estaba cargado) y un `activo` que empieza el lunes que viene. Mirar
 * `estado === 'activo'` (como hace `microcicloVigente`, que por eso no sirve aquí) habría
 * mostrado como «esta semana» una que todavía no empieza. Manda el calendario: cada microciclo
 * cubre `[fechaInicio, fechaInicio + cadenciaDias)`, y para saberlo se reutilizan
 * `semanaEsAdelantada` y `semanaEsVencida`, las mismas dos que ya usan Hoy y la Ruta.
 *
 * REGLAS
 * - «Esta» es el microciclo cuyo intervalo contiene hoy; si hay varios, el de `fechaInicio`
 *   más reciente. Si ninguno contiene hoy, el más reciente que ya empezó. Si ninguno ha
 *   empezado, no hay «esta»: no se promociona un futuro a presente.
 * - «La pasada» es el de `fechaInicio` inmediatamente anterior a «esta»; «la que viene», el
 *   inmediatamente posterior. Sin «esta» no hay pasada, y «la que viene» es el primero que
 *   arranca (así una persona que aún no empieza ve su primera semana).
 * - Un microciclo sin `fechaInicio` válida no entra: no se puede situar en el calendario.
 * - Dos con la misma `fechaInicio` son un dato duplicado: se queda el que no está
 *   `propuesto` y, a igualdad, el de número mayor.
 */

export type RolDeSemana = 'pasada' | 'esta' | 'siguiente'

/** Dónde cae la semana respecto a HOY (no respecto a cuál botón se pulsó). */
export type SituacionDeSemana = 'paso' | 'ahora' | 'viene'

export interface SemanaElegida {
  microciclo: Microciclo
  situacion: SituacionDeSemana
  /** Aún sin aprobar: se dice en la etiqueta, para no presentarla como un hecho. */
  propuesta: boolean
}

export type TresSemanas = Partial<Record<RolDeSemana, SemanaElegida>>

/** `AAAA-MM-DD` que además es una fecha de calendario (no un 2026-02-31). */
function esFechaIso(texto: unknown): texto is string {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false
  return new Date(`${texto}T00:00:00Z`).toISOString().slice(0, 10) === texto
}

/** Preferencia entre duplicados de una misma fecha de inicio. */
function mejorDeLosDuplicados(a: Microciclo, b: Microciclo): Microciclo {
  if ((a.estado === 'propuesto') !== (b.estado === 'propuesto')) return a.estado === 'propuesto' ? b : a
  return b.numero > a.numero ? b : a
}

function situacionDe(m: Microciclo, hoyIso: string): SituacionDeSemana {
  if (semanaEsAdelantada(m, hoyIso)) return 'viene'
  if (semanaEsVencida(m, hoyIso)) return 'paso'
  return 'ahora'
}

export function tresSemanasDeLaPersona(historial: readonly Microciclo[], hoyIso: string): TresSemanas {
  const porInicio = new Map<string, Microciclo>()
  for (const m of historial) {
    if (!esFechaIso(m.fechaInicio)) continue
    const previo = porInicio.get(m.fechaInicio)
    porInicio.set(m.fechaInicio, previo ? mejorDeLosDuplicados(previo, m) : m)
  }
  const ordenados = [...porInicio.values()].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))

  const yaEmpezaron = ordenados.filter((m) => !semanaEsAdelantada(m, hoyIso))
  const cubrenHoy = yaEmpezaron.filter((m) => !semanaEsVencida(m, hoyIso))
  // `ordenados` va de más antiguo a más reciente: el último es el de `fechaInicio` más reciente.
  const esta = cubrenHoy.at(-1) ?? yaEmpezaron.at(-1)

  let pasada: Microciclo | undefined
  let siguiente: Microciclo | undefined
  if (esta) {
    const i = ordenados.indexOf(esta)
    pasada = ordenados[i - 1]
    siguiente = ordenados[i + 1]
  } else {
    siguiente = ordenados[0]
  }

  const elegir = (m: Microciclo | undefined): SemanaElegida | undefined =>
    m ? { microciclo: m, situacion: situacionDe(m, hoyIso), propuesta: m.estado === 'propuesto' } : undefined

  return { pasada: elegir(pasada), esta: elegir(esta), siguiente: elegir(siguiente) }
}

export interface PieDeSemana {
  sesionesTotales: number
  /** Sesiones con al menos una serie anotada o un bloque de cardio hecho. */
  sesionesConAlgoAnotado: number
  /** Σ de series registradas (de `pautadoVsHechoDe`, la misma cuenta de la gráfica). */
  seriesAnotadas: number
  /** Σ de series pedidas (ídem). */
  seriesPedidas: number
}

/** El pie de una línea de cada semana. Las series salen de `pautadoVsHechoDe` para que no haya dos cuentas. */
export function pieDeLaSemana(microciclo: Microciclo): PieDeSemana {
  const { series } = pautadoVsHechoDe(microciclo)
  const conAlgo = microciclo.sesiones.filter(
    (s) => s.ejercicios.some((e) => e.series.length > 0) || (s.bloquesCardio ?? []).some((b) => Boolean(b.hechoEn)),
  ).length
  return {
    sesionesTotales: microciclo.sesiones.length,
    sesionesConAlgoAnotado: conAlgo,
    seriesAnotadas: series.hecho,
    seriesPedidas: series.pautado,
  }
}
