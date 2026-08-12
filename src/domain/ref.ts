import { coeficienteCarga } from './cargas'
import type { EjercicioPrescrito } from './types'

/**
 * REF — Ratio Estímulo / Fatiga.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ RESUELVE
 * ────────────────────────────────────────────────────────────────────────────
 * El motor sabe decir **cuánto** trabajo toca (`volumenDelBloque`), pero no
 * **cuán duro** es ese trabajo. Dos microciclos con las mismas 12 series por
 * grupo pueden ser un paseo o un despeñadero según reps e intensidad. El REF es
 * el eje que faltaba.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DE DÓNDE SALE
 * ────────────────────────────────────────────────────────────────────────────
 * Del libro del coach `Excel. Ratio estímulo - fatiga por ejercicio`. La fórmula
 * es una sola:
 *
 *     REF = repeticiones / (100 − %1RM)
 *
 * En el Excel el %1RM se saca dividiendo la carga real entre el 1RM, que el
 * usuario teclea a mano. **Aquí no hace falta el 1RM**: la matriz CARGAS de
 * `cargas.ts` ya da la fracción del 1RM que representa una serie de `reps` a
 * `rir`, y esa fracción *es* el %1RM. El 1RM se cancela.
 *
 * Eso tiene una consecuencia práctica grande: el REF de una serie **prescrita**
 * se calcula con `reps` y `rirObjetivo` y nada más — los dos campos que la carga
 * ya escribe. No hace falta test de fuerza máxima, ni encoder de velocidad, ni
 * esperar a que el asesorado registre nada.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TRAMPA: EL REF NO SE SUMA ENTRE EJERCICIOS
 * ────────────────────────────────────────────────────────────────────────────
 * En la hoja «Mes 1» cada ejercicio acumula el suyo (jalón 2,22 · press banca
 * 1,80 · remo 1,13). Las dos escalas de abajo son **por ejercicio**, no por
 * sesión completa ni por persona.
 *
 * No es una suposición: los ocho ejercicios de la semana 1 de esa hoja suman
 * **10,76**. Si la escala se aplicara al total, la propia hoja de ejemplo del
 * autor saldría al doble del umbral «no recomendado más de una semana» (4,6) y
 * al cuádruple del «muy difícil» de sesión (2,3). Leídos por ejercicio, en
 * cambio, sus doce valores caen entre 0,88 y 2,22 — todos en las dos bandas
 * centrales, que es como se ve una semana bien programada.
 *
 * Sumar entre ejercicios daría siempre «insostenible» y el aviso se volvería
 * ruido. Un indicador de carga global de la persona es otra cosa y necesitaría
 * su propia escala.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LO QUE INTERPOLO YO
 * ────────────────────────────────────────────────────────────────────────────
 * El Excel escribe los tramos como «< 0,4» y «0,4 a 1,3», sin decir a quién
 * pertenece el valor del corte. Aquí el corte cae siempre en el tramo superior
 * (0,4 es ya «recuperable»). Es criterio, no dato.
 */

/** Tramos del REF acumulado de un ejercicio en **una sesión**. */
export type TramoSesion = 'poco-estimulo' | 'recuperable' | 'acumulacion' | 'muy-dificil'

/** Tramos del REF de un ejercicio en **una semana** (suma de sus sesiones). */
export type TramoSemana = 'descarga' | 'carga' | 'demandante' | 'insostenible'

/** Cortes por sesión, tal cual el Excel. */
export const CORTES_SESION = { recuperable: 0.4, acumulacion: 1.3, muyDificil: 2.3 } as const

/** Cortes por semana, tal cual el Excel. */
export const CORTES_SEMANA = { carga: 2.0, demandante: 3.4, insostenible: 4.6 } as const

/**
 * REF de una serie a partir del %1RM directo (0–100, ambos excluidos).
 *
 * Es la fórmula del Excel sin intermediarios. Existe aparte de `refDeSerie` para
 * poder anclarla al libro del coach sin pasar por la matriz CARGAS: el ejemplo
 * del Excel (10 reps al 75 % del 1RM) queda **fuera** de esa matriz, cuyo techo
 * para 10 reps es 68 % (RIR 0).
 */
export function refDesdePorcentaje(reps: number, porcentaje1Rm: number): number | undefined {
  if (!Number.isFinite(reps) || reps <= 0) return undefined
  if (!Number.isFinite(porcentaje1Rm)) return undefined
  // Al 100 % el denominador es cero y el REF no está definido. Por encima sería
  // negativo, que es peor: daría un ratio bajo para la serie más dura posible.
  if (porcentaje1Rm <= 0 || porcentaje1Rm >= 100) return undefined
  return reps / (100 - porcentaje1Rm)
}

/**
 * REF de una serie prescrita, vía matriz CARGAS.
 *
 * Fuera de tabla devuelve undefined en vez de extrapolar, igual que
 * `coeficienteCarga`: una serie de 30 reps a RIR 6 no dice nada útil, y un
 * número inventado aquí acabaría en un aviso al coach.
 */
export function refDeSerie(reps: number, rir: number): number | undefined {
  const coeficiente = coeficienteCarga(reps, rir)
  if (coeficiente === undefined) return undefined
  return refDesdePorcentaje(reps, coeficiente * 100)
}

/**
 * REF acumulado de una tanda de series.
 *
 * Basta con que **una** caiga fuera de la matriz para que no se devuelva nada:
 * una suma parcial haría parecer la tanda más blanda de lo que es, y ese es
 * justo el error que el aviso debería cazar.
 */
export function refDeSeries(series: readonly { reps: number; rir: number }[]): number | undefined {
  if (series.length === 0) return undefined
  let total = 0
  for (const s of series) {
    const ref = refDeSerie(s.reps, s.rir)
    if (ref === undefined) return undefined
    total += ref
  }
  return total
}

/**
 * REF acumulado de un ejercicio en una sesión.
 *
 * Si el ejercicio trae ondulación, se suma serie a serie con sus reps y su RIR
 * propios; si no, todas las series comparten `repsDiana` y `rirObjetivo`, que es
 * como quedaban los microciclos antes de que la ondulación se guardara.
 */
export function refDeEjercicio(ejercicio: EjercicioPrescrito): number | undefined {
  const ondulado = ejercicio.seriesPrescritas
  if (ondulado && ondulado.length > 0) return refDeSeries(ondulado)
  return refDeSeries(
    Array.from({ length: Math.max(0, ejercicio.sets) }, () => ({
      reps: ejercicio.repsDiana,
      rir: ejercicio.rirObjetivo,
    })),
  )
}

/** Qué significa el REF de un ejercicio en una sesión. */
export function clasificarSesion(ref: number): TramoSesion {
  if (ref < CORTES_SESION.recuperable) return 'poco-estimulo'
  if (ref < CORTES_SESION.acumulacion) return 'recuperable'
  if (ref < CORTES_SESION.muyDificil) return 'acumulacion'
  return 'muy-dificil'
}

/** Qué significa el REF de un ejercicio a lo largo de una semana. */
export function clasificarSemana(ref: number): TramoSemana {
  if (ref < CORTES_SEMANA.carga) return 'descarga'
  if (ref < CORTES_SEMANA.demandante) return 'carga'
  if (ref < CORTES_SEMANA.insostenible) return 'demandante'
  return 'insostenible'
}
