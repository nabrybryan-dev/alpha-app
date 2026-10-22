import { coeficienteCarga, estimarUnRm } from '../cargas'
import type { SerieVista } from './plan/listaBlanca'

/**
 * Cuánto bajar una carga cuando la persona lo pide (decisión de Bryan, 20-oct-2026:
 * «Praxis pregunta y propone al coach»). Es una función PURA: no lee ni escribe nada.
 *
 * PRAXIS NO CAMBIA CARGAS Y NO LE ENSEÑA ESTE NÚMERO A LA PERSONA (LENGUAJE-DE-PRAXIS §3.6):
 * el resultado va al coach, que decide y es el único que escribe. Aquí solo se calcula.
 *
 * Cómo se calcula, con lo ya escrito:
 *   1. De la ÚLTIMA serie registrada (carga, reps, RIR) se estima el 1RM del día con la matriz
 *      `CARGAS` (`cargas.ts`, idéntica a la hoja CARGAS de los Excel del coach).
 *   2. El RIR objetivo sube según el cansancio declarado. La tabla provisional sale de
 *      `wiki/motor-decision/04-autorregulacion-prs-hooper.md` (banda PRS 0-2: «RIR +1/+2») y
 *      es coherente con `05-fatiga-intrasesion.md` (caída de carga de 3-5 %): con +1 RIR una
 *      serie de 100 kg x 8 a RIR 1 baja 4,2 % (95,8 kg sin redondear).
 *   3. La carga nueva es el 1RM por el coeficiente de las MISMAS reps al RIR objetivo, redondeada
 *      al salto de la barra o la máquina y nunca igual ni mayor a la actual.
 *
 * LA TABLA NO ESTÁ FIRMADA. Ninguna página dice «con este cansancio, sube tanto el RIR» para un
 * PEDIDO de la persona: las dos páginas citadas hablan del PRS previo a la sesión y de bajar
 * entre series. Mientras el coach no la firme, `reglaFirmada` sale en `false` y la consola no debe
 * presentar el número como decisión, solo como punto de partida.
 */

export type Cansancio = 'algo' | 'mucho'
export type MotivoDeBajada = 'cansancio' | 'tecnica' | 'dolor' | 'otro'

/** Cuánto sube el RIR objetivo según el cansancio declarado. PROVISIONAL, sin firmar. */
export const SUBE_RIR_POR_CANSANCIO: Readonly<Record<Cansancio, number>> = { algo: 1, mucho: 2 }

/** Salto de carga por defecto (kg): discos de 1,25 por lado. */
export const SALTO_KG_POR_DEFECTO = 2.5

export interface PedidoDeBajada {
  /** Las series registradas del ejercicio (la lista blanca de Praxis ya las expone). */
  series: readonly SerieVista[]
  cansancio: Cansancio
  motivo: MotivoDeBajada
  saltoKg?: number
}

export type RazonSinCalculo = 'sin_serie' | 'sin_reps' | 'sin_rir' | 'fuera_de_tabla' | 'no_baja'

export type PropuestaDeBajada =
  | {
      tipo: 'propuesta'
      cargaActualKg: number
      cargaPropuestaKg: number
      rirDeLaSerie: number
      rirObjetivo: number
      reps: number
      unRmEstimadoKg: number
      reglaFirmada: false
    }
  | { tipo: 'no_calcula'; razon: RazonSinCalculo }
  | { tipo: 'derivar_a_salud' }

function aSalto(valorKg: number, saltoKg: number): number {
  // Redondeo al salto más cercano; el resultado se limpia de ruido de coma flotante.
  return Math.round(Math.round(valorKg / saltoKg) * saltoKg * 1000) / 1000
}

export function proponerBajadaDeCarga(pedido: PedidoDeBajada): PropuestaDeBajada {
  // El dolor nunca se resuelve con una carga: sale por la capa de salud antes de calcular nada.
  if (pedido.motivo === 'dolor') return { tipo: 'derivar_a_salud' }

  // La última por `orden`; con el mismo orden repetido gana la que viene después en la lista.
  const ultima = pedido.series.reduce<SerieVista | undefined>((mejor, s) => (!mejor || s.orden >= mejor.orden ? s : mejor), undefined)
  if (!ultima || !Number.isFinite(ultima.cargaKg) || ultima.cargaKg <= 0) return { tipo: 'no_calcula', razon: 'sin_serie' }
  if (ultima.reps == null) return { tipo: 'no_calcula', razon: 'sin_reps' }
  if (ultima.rir == null) return { tipo: 'no_calcula', razon: 'sin_rir' }

  const unRm = estimarUnRm(ultima.cargaKg, ultima.reps, ultima.rir)
  const rirObjetivo = ultima.rir + SUBE_RIR_POR_CANSANCIO[pedido.cansancio]
  const coeficienteNuevo = coeficienteCarga(ultima.reps, rirObjetivo)
  if (unRm === undefined || coeficienteNuevo === undefined) return { tipo: 'no_calcula', razon: 'fuera_de_tabla' }

  // Un salto no finito o no positivo se ignora; una propuesta de 0 kg o menos (salto desproporcionado) no es una propuesta.
  const salto = pedido.saltoKg !== undefined && Number.isFinite(pedido.saltoKg) && pedido.saltoKg > 0 ? pedido.saltoKg : SALTO_KG_POR_DEFECTO
  const cargaPropuestaKg = aSalto(unRm * coeficienteNuevo, salto)
  if (!Number.isFinite(cargaPropuestaKg) || cargaPropuestaKg <= 0 || cargaPropuestaKg >= ultima.cargaKg) return { tipo: 'no_calcula', razon: 'no_baja' }

  return {
    tipo: 'propuesta',
    cargaActualKg: ultima.cargaKg,
    cargaPropuestaKg,
    rirDeLaSerie: ultima.rir,
    rirObjetivo,
    reps: ultima.reps,
    unRmEstimadoKg: unRm,
    reglaFirmada: false,
  }
}
