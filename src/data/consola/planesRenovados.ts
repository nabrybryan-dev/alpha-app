import type { EstadoPlanRenovado, RiesgoPlanRenovado } from '../../domain/consolaCoach/planRenovado'
import { modoNube, supabase } from '../supabase'
import type { LecturaBandeja } from './primerosPlanes'

/**
 * `aprobaciones_plan_estrategico` (migración 0087): el plan estratégico RENOVADO (borrador
 * del agente de renovación, `planes_estrategicos.estado = 'borrador'`) espera a que alguien
 * con `aprobar_plan_estrategico` lo apruebe o lo rechace en la consola. La fila la crea el
 * agente (service_role); el navegador solo LEE y decide por la RPC `decidir_plan_estrategico`.
 *
 * `COLUMNAS_PLAN_RENOVADO` es la misma lista que el `create table` de la 0087; la prueba de
 * este archivo la compara contra el SQL.
 */
export const TABLA_PLAN_RENOVADO = 'aprobaciones_plan_estrategico'

export const COLUMNAS_PLAN_RENOVADO = [
  'id',
  'usuario_id',
  'plan_id',
  'hash',
  'estado',
  'riesgo',
  'clinico',
  'motivo_riesgo',
  'dudas_pendientes',
  'justificacion',
  'supuestos',
  'preguntas_para_bryan',
  'plazo_hasta',
  'decidido_por',
  'motivo',
  'decidido_en',
  'motivo_espera',
  'creado_en',
  'actualizado_en',
] as const

const SELECCION = COLUMNAS_PLAN_RENOVADO.join(',')

export interface FilaPlanRenovado {
  id: string
  usuario_id: string
  plan_id: string
  hash: string
  estado: string
  riesgo: string
  clinico: boolean | null
  motivo_riesgo: string | null
  dudas_pendientes: string[] | null
  justificacion: unknown
  supuestos: string[] | null
  preguntas_para_bryan: unknown
  plazo_hasta: string
  decidido_por: string | null
  motivo: string | null
  decidido_en: string | null
  motivo_espera: string | null
  creado_en: string
  actualizado_en: string
}

export interface PlanRenovado {
  id: string
  usuarioId: string
  planId: string
  hash: string
  estado: EstadoPlanRenovado
  riesgo: RiesgoPlanRenovado
  clinico: boolean
  motivoRiesgo: string | null
  dudasPendientes: string[]
  /** Crudo (jsonb): lo lee `leerJustificacion` del dominio. */
  justificacion: unknown[]
  supuestos: string[]
  /** Crudo (jsonb): lo lee `leerPreguntasParaBryan` del dominio. */
  preguntasParaBryan: unknown[]
  plazoHasta: string
  decididoPor: string | null
  motivo: string | null
  decididoEn: string | null
  motivoEspera: string | null
}

const ESTADOS: readonly string[] = ['propuesto', 'aprobado', 'rechazado', 'vencido_aprobado', 'espera_bryan']
const RIESGOS: readonly string[] = ['bajo', 'medio', 'alto']

/** Una fila con forma inesperada se descarta entera: nunca se pinta a medias. */
export function aPlanRenovado(fila: FilaPlanRenovado): PlanRenovado | null {
  if (!ESTADOS.includes(fila.estado) || !RIESGOS.includes(fila.riesgo)) return null
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    planId: fila.plan_id,
    hash: fila.hash,
    estado: fila.estado as EstadoPlanRenovado,
    riesgo: fila.riesgo as RiesgoPlanRenovado,
    // Ante la duda, clínico: así la pantalla no ofrece a Manuela algo que es de Bryan.
    clinico: fila.clinico !== false,
    motivoRiesgo: fila.motivo_riesgo,
    dudasPendientes: Array.isArray(fila.dudas_pendientes) ? fila.dudas_pendientes : [],
    justificacion: Array.isArray(fila.justificacion) ? fila.justificacion : [],
    supuestos: Array.isArray(fila.supuestos) ? fila.supuestos : [],
    preguntasParaBryan: Array.isArray(fila.preguntas_para_bryan) ? fila.preguntas_para_bryan : [],
    plazoHasta: fila.plazo_hasta,
    decididoPor: fila.decidido_por,
    motivo: fila.motivo,
    decididoEn: fila.decidido_en,
    motivoEspera: fila.motivo_espera,
  }
}

/** Los pendientes (`propuesto` o `espera_bryan`). Nunca lanza: ante un error,
 *  `{ ok: false, error }`, no una bandeja vacía (APP-F01). En demo, vacía de verdad. */
export async function planesRenovadosPendientes(): Promise<LecturaBandeja<PlanRenovado>> {
  if (!modoNube) return { ok: true, datos: [] }
  try {
    const { data, error } = await supabase()
      .from(TABLA_PLAN_RENOVADO)
      .select(SELECCION)
      .in('estado', ['propuesto', 'espera_bryan'])
      .order('plazo_hasta', { ascending: true })
    if (error) return { ok: false, error: error.message || 'No se pudo leer la bandeja.' }
    if (!data) return { ok: false, error: 'La base no devolvió la bandeja.' }
    return {
      ok: true,
      datos: (data as unknown as FilaPlanRenovado[]).map(aPlanRenovado).filter((p): p is PlanRenovado => p !== null),
    }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}

export interface BorradorYVigente {
  borrador: { version: number; contenido: unknown }
  /** `null` si la persona aún no tiene plan vigente. */
  vigente: { version: number; contenido: unknown } | null
}

export type ResultadoBorradorYVigente = { ok: true; datos: BorradorYVigente } | { ok: false; error: string }

interface FilaContenido {
  id: string
  version: number
  vigente: boolean
  contenido: unknown
}

/**
 * El borrador y el vigente de la persona, para la vista previa y la diferencia. Una sola
 * consulta: el staff con `leer_entrenamiento` los lee por la política de la 0083/0087.
 */
export async function borradorYVigente(usuarioId: string, planId: string): Promise<ResultadoBorradorYVigente> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  try {
    const { data, error } = await supabase()
      .from('planes_estrategicos')
      .select('id,version,vigente,contenido')
      .eq('usuario_id', usuarioId)
      .or(`id.eq.${planId},vigente.eq.true`)
    if (error) return { ok: false, error: error.message || 'No se pudo leer el plan.' }
    const filas = (data ?? []) as unknown as FilaContenido[]
    const borrador = filas.find((f) => f.id === planId)
    if (!borrador) return { ok: false, error: 'No se encontró el borrador del plan.' }
    const vigente = filas.find((f) => f.vigente && f.id !== planId) ?? null
    return {
      ok: true,
      datos: {
        borrador: { version: borrador.version, contenido: borrador.contenido },
        vigente: vigente ? { version: vigente.version, contenido: vigente.contenido } : null,
      },
    }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}

export type DecisionPlanRenovado = 'aprobar' | 'rechazar'
export type ResultadoDecisionPlan = { ok: true; plan: PlanRenovado } | { ok: false; error: string }

function mensajeDeError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return error.message || 'No tienes permiso para esta decisión.'
  if (error.code === 'P0002') return 'Este plan ya no existe.'
  return error.message || 'No se pudo guardar la decisión. Vuelve a intentarlo.'
}

/**
 * RPC `decidir_plan_estrategico` (0087). El actor sale de `auth.uid()` en el servidor.
 * Aprobar apaga el vigente y enciende el borrador en la misma transacción. Rechazar exige
 * motivo: se comprueba aquí para no gastar una petición, y la base lo vuelve a exigir.
 */
export async function decidirPlanEstrategico(
  aprobacionId: string,
  decision: DecisionPlanRenovado,
  motivo: string,
): Promise<ResultadoDecisionPlan> {
  const limpio = motivo.trim()
  if (decision === 'rechazar' && !limpio) return { ok: false, error: 'Escribe el motivo del rechazo.' }
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  try {
    const { data, error } = await supabase().rpc('decidir_plan_estrategico', {
      aprobacion_id: aprobacionId,
      decision,
      motivo: limpio || null,
    })
    if (error) return { ok: false, error: mensajeDeError(error) }
    const plan = data ? aPlanRenovado(data as unknown as FilaPlanRenovado) : null
    if (!plan) return { ok: false, error: 'La base devolvió una fila con forma inesperada.' }
    return { ok: true, plan }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}
