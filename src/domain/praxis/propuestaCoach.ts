import { proponerBajadaDeCarga, SALTO_KG_POR_DEFECTO, SUBE_RIR_POR_CANSANCIO, type Cansancio, type MotivoDeBajada, type RazonSinCalculo } from './cargaPropuesta'
import type { SerieVista } from './plan/listaBlanca'
import type { Trato } from './plan/responder'
import { filtroDeRiesgo } from './riesgo'

/**
 * El canal «proponer al coach» (decisiones de Bryan, 21-oct-2026). Dominio puro: arma las filas que la
 * app mandaría a `praxis_propuestas_coach`, dice cuándo vencen y recalcula el número desde la consola.
 *
 * Lo que manda aquí, por decisión de Bryan:
 *   - Una sola tabla con `tipo`: `bajar_carga` o `voy_a_escribirte`.
 *   - Sin serie registrada NO se manda fila al coach: Praxis le pide una serie a la persona primero.
 *   - El tema de «voy a escribirte» es una lista cerrada. Ningún campo de texto libre, en ninguna fila.
 *   - 12 horas de plazo; pasado el plazo la fila queda «vencida» (rojo suave en la bandeja).
 *   - La respuesta automática de Praxis tras el plazo NO existe todavía: va APAGADA y, aun encendida,
 *     no habla de salud, de riesgo, de ánimo ni de cargas (espera la revisión del psicólogo y del abogado).
 *   - La regla del RIR por cansancio está firmada por Bryan pero con revisión profesional pendiente:
 *     `reglaFirmada` sigue en `false`.
 */
export type TipoPropuesta = 'bajar_carga' | 'voy_a_escribirte'
export type EstadoPropuesta = 'pendiente' | 'aceptada' | 'ajustada' | 'rechazada' | 'atendida'

export const TEMAS_CONTACTO = ['animo', 'alimentacion', 'otro'] as const
export type TemaContacto = (typeof TEMAS_CONTACTO)[number]
export const ORIGENES_CONTACTO = ['ficha', 'filtro_clinico'] as const
export type OrigenContacto = (typeof ORIGENES_CONTACTO)[number]
export const MOTIVOS_RECHAZO = ['no_corresponde', 'ya_ajustado', 'lo_hablo_con_la_persona', 'otro'] as const
export type MotivoRechazo = (typeof MOTIVOS_RECHAZO)[number]

/** «Medio día» (Bryan, 21-oct): 12 horas. */
export const PLAZO_HORAS_PROPUESTA = 12

/** Interruptor de la respuesta automática de Praxis a las 12 h. APAGADO: no se enciende sin psicólogo y abogado. */
export const RESPUESTA_AUTOMATICA_ENCENDIDA = false

const FICHA_ID = /^[a-z0-9-]{1,60}$/
/** Identificador de ejercicio o microciclo: una referencia, nunca una frase. Igual que el check del SQL. */
export const ID_REFERENCIA = /^[A-Za-z0-9_.:-]{1,80}$/

export interface FilaBajarCarga {
  tipo: 'bajar_carga'
  microcicloId: string
  ejercicioId: string
  cansancio: Cansancio
  motivo: Exclude<MotivoDeBajada, 'dolor'>
  serieCargaKg: number
  serieReps: number
  serieRir: number
  rirObjetivo: number
  unRmKg: number | null
  /** `null` cuando no se pudo calcular; entonces `razonSinCalculo` dice por qué. */
  cargaPropuestaKg: number | null
  razonSinCalculo: Extract<RazonSinCalculo, 'fuera_de_tabla' | 'no_baja'> | null
  saltoKg: number
  reglaFirmada: false
}

export interface FilaVoyAEscribirte {
  tipo: 'voy_a_escribirte'
  origenContacto: OrigenContacto
  fichaId: string
  tema: TemaContacto
}

export type FilaPropuesta = FilaBajarCarga | FilaVoyAEscribirte

export type ResultadoArmarCarga = { tipo: 'pedir_serie' } | { tipo: 'derivar_a_salud' } | { tipo: 'id_invalido' } | { tipo: 'fila'; fila: FilaBajarCarga }

export interface PedidoCarga {
  series: readonly SerieVista[]
  cansancio: Cansancio
  motivo: MotivoDeBajada
  ejercicioId: string
  microcicloId: string
  saltoKg?: number
}

/** La última serie por `orden`; con el mismo orden gana la que viene después (igual que `proponerBajadaDeCarga`). */
function ultimaSerie(series: readonly SerieVista[]): SerieVista | undefined {
  return series.reduce<SerieVista | undefined>((mejor, s) => (!mejor || s.orden >= mejor.orden ? s : mejor), undefined)
}

export function armarPropuestaDeCarga(pedido: PedidoCarga): ResultadoArmarCarga {
  // El dolor no es una carga: sale por la capa de salud, antes de pedir nada.
  if (pedido.motivo === 'dolor') return { tipo: 'derivar_a_salud' }
  if (!ID_REFERENCIA.test(pedido.ejercicioId) || !ID_REFERENCIA.test(pedido.microcicloId)) return { tipo: 'id_invalido' }

  const calculo = proponerBajadaDeCarga({ series: pedido.series, cansancio: pedido.cansancio, motivo: pedido.motivo, saltoKg: pedido.saltoKg })
  if (calculo.tipo === 'derivar_a_salud') return { tipo: 'derivar_a_salud' }
  if (calculo.tipo === 'no_calcula' && (calculo.razon === 'sin_serie' || calculo.razon === 'sin_reps' || calculo.razon === 'sin_rir')) {
    return { tipo: 'pedir_serie' }
  }

  const comunes = {
    tipo: 'bajar_carga' as const,
    microcicloId: pedido.microcicloId,
    ejercicioId: pedido.ejercicioId,
    cansancio: pedido.cansancio,
    motivo: pedido.motivo,
    reglaFirmada: false as const,
  }
  const salto = pedido.saltoKg !== undefined && Number.isFinite(pedido.saltoKg) && pedido.saltoKg > 0 ? pedido.saltoKg : SALTO_KG_POR_DEFECTO
  if (calculo.tipo === 'propuesta') {
    return {
      tipo: 'fila',
      fila: {
        ...comunes,
        serieCargaKg: calculo.cargaActualKg,
        serieReps: calculo.reps,
        serieRir: calculo.rirDeLaSerie,
        rirObjetivo: calculo.rirObjetivo,
        unRmKg: calculo.unRmEstimadoKg,
        cargaPropuestaKg: calculo.cargaPropuestaKg,
        razonSinCalculo: null,
        saltoKg: salto,
      },
    }
  }
  // Serie completa pero sin número (fuera de la tabla o no baja): va al coach sin cifra y con la razón.
  const ultima = ultimaSerie(pedido.series)
  if (!ultima || ultima.reps == null || ultima.rir == null) return { tipo: 'pedir_serie' }
  return {
    tipo: 'fila',
    fila: {
      ...comunes,
      serieCargaKg: ultima.cargaKg,
      serieReps: ultima.reps,
      serieRir: ultima.rir,
      rirObjetivo: ultima.rir + SUBE_RIR_POR_CANSANCIO[pedido.cansancio],
      unRmKg: null,
      cargaPropuestaKg: null,
      razonSinCalculo: calculo.razon === 'fuera_de_tabla' ? 'fuera_de_tabla' : 'no_baja',
      saltoKg: salto,
    },
  }
}

export type ResultadoVoyAEscribirte = { ok: true; fila: FilaVoyAEscribirte } | { ok: false; motivo: 'tema' | 'origen' | 'ficha' }

/** La fila de «voy a escribirte»: solo listas cerradas y un identificador de ficha. Nunca la frase de la persona. */
export function armarVoyAEscribirte(entrada: { origenContacto: OrigenContacto; fichaId: string; tema: TemaContacto }): ResultadoVoyAEscribirte {
  if (!(TEMAS_CONTACTO as readonly string[]).includes(entrada.tema)) return { ok: false, motivo: 'tema' }
  if (!(ORIGENES_CONTACTO as readonly string[]).includes(entrada.origenContacto)) return { ok: false, motivo: 'origen' }
  if (!FICHA_ID.test(entrada.fichaId)) return { ok: false, motivo: 'ficha' }
  return { ok: true, fila: { tipo: 'voy_a_escribirte', origenContacto: entrada.origenContacto, fichaId: entrada.fichaId, tema: entrada.tema } }
}

/** Vencida = sigue pendiente y pasaron 12 horas o más (>=, no >). Una fecha ilegible no vence. */
export function estaVencida(fila: { creadoEn: string; estado: EstadoPropuesta }, ahora: Date): boolean {
  if (fila.estado !== 'pendiente') return false
  const creada = Date.parse(fila.creadoEn)
  if (!Number.isFinite(creada)) return false
  return ahora.getTime() - creada >= PLAZO_HORAS_PROPUESTA * 3_600_000
}

export interface EntradaContestar {
  tipo: TipoPropuesta
  /** Para `voy_a_escribirte`. Se acepta texto para poder vetar también 'salud' y 'riesgo'. */
  tema?: string
  vencida: boolean
  /** La frase de la persona, solo para pasarla por el filtro de riesgo; no se guarda. */
  frase: string
}

/**
 * ¿Praxis contesta sola porque el coach no lo hizo en 12 h? Hoy NO: la constante está apagada.
 * Aun encendida, solo se permite el caso más inocuo: un «voy a escribirte» vencido de tema `otro` y sin
 * marca de riesgo. Ánimo, alimentación, salud y riesgo esperan al psicólogo; las cargas no las toca Praxis.
 */
export function debeContestarPraxis(entrada: EntradaContestar, encendida: boolean = RESPUESTA_AUTOMATICA_ENCENDIDA): boolean {
  if (!encendida) return false
  if (!entrada.vencida) return false
  if (entrada.tipo !== 'voy_a_escribirte') return false
  if (entrada.tema !== 'otro') return false
  if (filtroDeRiesgo(entrada.frase) !== null) return false
  return true
}

export type ResultadoRecalculo = { resultado: 'coincide' | 'no_coincide'; recalculadaKg: number | null }

/** La consola recalcula con su propio cálculo y compara con el número que trae la fila. */
export function recalcularEnConsola(fila: FilaBajarCarga, series: readonly SerieVista[]): ResultadoRecalculo {
  const base: readonly SerieVista[] = series.length > 0 ? series : [{ orden: 1, cargaKg: fila.serieCargaKg, reps: fila.serieReps, rir: fila.serieRir }]
  const r = proponerBajadaDeCarga({ series: base, cansancio: fila.cansancio, motivo: fila.motivo, saltoKg: fila.saltoKg })
  const recalculadaKg = r.tipo === 'propuesta' ? r.cargaPropuestaKg : null
  const iguales =
    recalculadaKg === null || fila.cargaPropuestaKg === null
      ? recalculadaKg === fila.cargaPropuestaKg
      : Math.abs(recalculadaKg - fila.cargaPropuestaKg) < 1e-6
  return { resultado: iguales ? 'coincide' : 'no_coincide', recalculadaKg }
}

/** Lo que Praxis le pregunta a la persona cuando no hay serie: una sola pregunta, sin prometer nada ni dar cifras. */
export function preguntaPedirSerie(trato: Trato): string {
  return trato === 'usted'
    ? '¿Podría decirme cuántos kilos, cuántas repeticiones y cuántas repeticiones le quedaban en reserva en su última serie de este ejercicio? Con eso puedo armar el pedido para su coach.'
    : '¿Me dices cuántos kilos, cuántas repeticiones y cuántas repeticiones te quedaban en reserva en tu última serie de este ejercicio? Con eso puedo armar el pedido para tu coach.'
}
