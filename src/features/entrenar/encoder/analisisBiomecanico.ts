import type { PerfilAntropometrico } from '../../../domain/types'
import { planDeMedida, type PlanDeMedida } from '../../../domain/biomecanica/palancas'
import {
  personalizarBiomecanica,
  varianteBiomecanicaDe,
  type PersonalizacionBiomecanica,
  type VarianteBiomecanica,
} from '../../../domain/biomecanica/personalizacion'
import { patronDeCategoria } from '../../../domain/patrones/catalogo'
import { descripcionDeCadena, fraseDelPatron } from '../../../domain/patrones/acciones'

export interface EntradaAnalisisBiomecanico {
  categoria: string
  nombreEjercicio: string
  antropometria?: PerfilAntropometrico
  /** Toma ya procesada. Este módulo no abre ni controla dispositivos. */
  capturaActual?: CapturaBiomecanica
  /** Toma semanal contra la que se quiere comparar. */
  capturaAnterior?: CapturaBiomecanica
}

/**
 * Firma cerrada de comparabilidad semanal. Si una sola pieza cambia ya no se
 * atribuye la diferencia de resultado al paso del tiempo.
 */
export interface FirmaEncoder {
  readonly patron: string
  readonly variante: string
  readonly cargaKg: number
  readonly rom: string
  readonly escala: string
  readonly fps: number
  readonly version: string
}

export interface CapturaBiomecanica<TResult = unknown> {
  readonly firma: FirmaEncoder
  readonly resultado: TResult
}

export type EstadoDeAnalisisEncoder =
  | { estado: 'sin-grabacion' }
  | {
      estado: 'incompatible'
      /** Nombre de cada componente de firma que impide comparar. */
      motivos: string[]
      firmaActual: FirmaEncoder
      firmaAnterior: FirmaEncoder
    }
  | {
      estado: 'analizado'
      firma: FirmaEncoder
      reglaIds: string[]
      /** Se conservan por referencia y nunca se reescriben. */
      resultado: unknown
      comparacionAnterior?: unknown
    }

export interface TrazaBiomecanica {
  variante: VarianteBiomecanica
  patronId?: string
  cadena?: 'cerrada' | 'abierta'
  origenLinea?: PlanDeMedida['linea']['origen']
  perfilActualizadoEn?: string
  reglasAplicadas: string[]
  aprobaciones: Array<{
    reglaId: string
    estado: 'aprobada'
    responsable: 'coach'
    fecha: '2026-09-01'
  }>
  fuentes: string[]
}

export interface AnalisisBiomecanico {
  categoria: string
  nombreEjercicio: string
  patron?: {
    id: string
    titulo: string
    cadena: 'cerrada' | 'abierta'
    descripcionCadena: string
    accion: string
  }
  plan?: PlanDeMedida
  personalizacion?: PersonalizacionBiomecanica
  trazabilidad: TrazaBiomecanica
  limites: string[]
  encoder: EstadoDeAnalisisEncoder
}

const CAMPOS_DE_FIRMA = [
  'patron',
  'variante',
  'cargaKg',
  'rom',
  'escala',
  'fps',
  'version',
] as const satisfies readonly (keyof FirmaEncoder)[]

/**
 * Devuelve todos los desacuerdos; no se detiene en el primero porque una nueva
 * variante grabada además a otros FPS necesita explicar las dos causas.
 */
export function motivosDeIncompatibilidad(
  actual: FirmaEncoder,
  anterior: FirmaEncoder,
): string[] {
  return CAMPOS_DE_FIRMA
    .filter((campo) => !Object.is(actual[campo], anterior[campo]))
    .map((campo) => `${campo}: ${String(actual[campo])} != ${String(anterior[campo])}`)
}

export function firmasEncoderCompatibles(
  actual: FirmaEncoder,
  anterior: FirmaEncoder,
): boolean {
  return motivosDeIncompatibilidad(actual, anterior).length === 0
}

function estadoDelEncoder(
  actual: CapturaBiomecanica | undefined,
  anterior: CapturaBiomecanica | undefined,
  reglaIds: string[],
): EstadoDeAnalisisEncoder {
  if (!actual) return { estado: 'sin-grabacion' }

  if (anterior) {
    const motivos = motivosDeIncompatibilidad(actual.firma, anterior.firma)
    if (motivos.length > 0) {
      return {
        estado: 'incompatible',
        motivos,
        firmaActual: actual.firma,
        firmaAnterior: anterior.firma,
      }
    }
  }

  return {
    estado: 'analizado',
    firma: actual.firma,
    reglaIds: [...reglaIds],
    resultado: actual.resultado,
    comparacionAnterior: anterior?.resultado,
  }
}

/**
 * Une patrón, modelo de palanca y perfil individual sin generar prescripción.
 * Toda conclusión individual conserva el id y la aprobación de la regla que
 * la produjo; si no hay ocho medidas válidas, devuelve solo la mecánica base.
 */
export function analizarBiomecanica(
  entrada: EntradaAnalisisBiomecanico,
): AnalisisBiomecanico {
  const {
    categoria,
    nombreEjercicio,
    antropometria,
    capturaActual,
    capturaAnterior,
  } = entrada
  const patron = patronDeCategoria(categoria, nombreEjercicio)
  const plan = planDeMedida(categoria, nombreEjercicio)
  const variante = varianteBiomecanicaDe(categoria, nombreEjercicio)
  const personalizacion = antropometria
    ? personalizarBiomecanica(categoria, nombreEjercicio, antropometria)
    : undefined
  const aplicaciones = personalizacion?.aplicaciones.filter((a) => a.aplica) ?? []
  const reglaIds = aplicaciones.map((a) => a.reglaId)

  const fuentes = new Set<string>()
  for (const aplicacion of aplicaciones) {
    fuentes.add(aplicacion.regla.evidenciaAFavor.fuente)
    fuentes.add(aplicacion.regla.evidenciaContraria.fuente)
  }

  return {
    categoria,
    nombreEjercicio,
    patron: patron
      ? {
          id: patron.id,
          titulo: patron.titulo,
          cadena: patron.cadena,
          descripcionCadena: descripcionDeCadena(patron),
          accion: fraseDelPatron(patron),
        }
      : undefined,
    plan,
    personalizacion,
    trazabilidad: {
      variante,
      patronId: patron?.id,
      cadena: patron?.cadena,
      origenLinea: plan?.linea.origen,
      perfilActualizadoEn: antropometria?.actualizadoEn,
      reglasAplicadas: reglaIds,
      aprobaciones: aplicaciones.map((a) => ({ reglaId: a.reglaId, ...a.regla.aprobacion })),
      fuentes: [...fuentes],
    },
    limites: [...new Set([...(plan?.limites ?? []), ...(personalizacion?.limites ?? [])])],
    encoder: estadoDelEncoder(capturaActual, capturaAnterior, reglaIds),
  }
}

export const analisisBiomecanico = analizarBiomecanica
