import type { EstadoPrimerPlan, RiesgoPrimerPlan } from '../../domain/consolaCoach/primerPlan'
import { modoNube, supabase } from '../supabase'

/**
 * `aprobaciones_primer_plan` (migración 0086): el PRIMER plan de un cliente nuevo espera a
 * que alguien con `aprobar_primer_plan` lo apruebe o lo rechace en la consola. La fila la
 * crea la cola de la landing (service_role); el navegador solo LEE y decide por la RPC
 * `decidir_primer_plan` — la tabla no tiene privilegio de escritura para `authenticated`.
 *
 * `COLUMNAS_PRIMER_PLAN` es la misma lista que el `create table` de la 0086; la prueba de
 * este archivo la compara contra el SQL para no desincronizarse en silencio.
 */
export const TABLA_PRIMER_PLAN = 'aprobaciones_primer_plan'

export const COLUMNAS_PRIMER_PLAN = [
  'id',
  'usuario_id',
  'microciclo_id',
  'estado',
  'riesgo',
  'motivo_riesgo',
  'dudas_pendientes',
  'plazo_hasta',
  'decidido_por',
  'motivo',
  'decidido_en',
  'motivo_espera',
  'creado_en',
  'actualizado_en',
] as const

const SELECCION = COLUMNAS_PRIMER_PLAN.join(',')

export interface FilaPrimerPlan {
  id: string
  usuario_id: string
  microciclo_id: string
  estado: string
  riesgo: string
  motivo_riesgo: string | null
  dudas_pendientes: string[] | null
  plazo_hasta: string
  decidido_por: string | null
  motivo: string | null
  decidido_en: string | null
  motivo_espera: string | null
  creado_en: string
  actualizado_en: string
}

export interface PrimerPlan {
  id: string
  usuarioId: string
  microcicloId: string
  estado: EstadoPrimerPlan
  riesgo: RiesgoPrimerPlan
  motivoRiesgo: string | null
  dudasPendientes: string[]
  plazoHasta: string
  decididoPor: string | null
  motivo: string | null
  decididoEn: string | null
  motivoEspera: string | null
}

const ESTADOS: readonly string[] = ['propuesto', 'aprobado', 'rechazado', 'vencido_aprobado', 'espera_bryan']
const RIESGOS: readonly string[] = ['bajo', 'medio', 'alto']

/** Una fila con forma inesperada se descarta entera: nunca se pinta a medias. */
export function aPrimerPlan(fila: FilaPrimerPlan): PrimerPlan | null {
  if (!ESTADOS.includes(fila.estado) || !RIESGOS.includes(fila.riesgo)) return null
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    microcicloId: fila.microciclo_id,
    estado: fila.estado as EstadoPrimerPlan,
    riesgo: fila.riesgo as RiesgoPrimerPlan,
    motivoRiesgo: fila.motivo_riesgo,
    dudasPendientes: Array.isArray(fila.dudas_pendientes) ? fila.dudas_pendientes : [],
    plazoHasta: fila.plazo_hasta,
    decididoPor: fila.decidido_por,
    motivo: fila.motivo,
    decididoEn: fila.decidido_en,
    motivoEspera: fila.motivo_espera,
  }
}

/** Los que siguen pendientes (`propuesto` o `espera_bryan`). Nunca lanza: ante cualquier
 *  error, sin conexión o sin permiso, `[]`. */
export async function primerosPlanesPendientes(): Promise<PrimerPlan[]> {
  if (!modoNube) return []
  try {
    const { data, error } = await supabase()
      .from(TABLA_PRIMER_PLAN)
      .select(SELECCION)
      .in('estado', ['propuesto', 'espera_bryan'])
      .order('plazo_hasta', { ascending: true })
    if (error || !data) return []
    return (data as unknown as FilaPrimerPlan[]).map(aPrimerPlan).filter((p): p is PrimerPlan => p !== null)
  } catch {
    return []
  }
}

export type ResultadoPlanPropuesto = { ok: true; datos: unknown } | { ok: false; error: string }

/** El `datos` del microciclo propuesto, para la vista previa. La lectura la abre la
 *  política `microciclos_lee_capacidad` (0083) a quien tenga `leer_entrenamiento`. */
export async function planPropuesto(microcicloId: string): Promise<ResultadoPlanPropuesto> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  try {
    const { data, error } = await supabase().from('microciclos').select('datos').eq('id', microcicloId).maybeSingle()
    if (error) return { ok: false, error: error.message || 'No se pudo leer el plan.' }
    if (!data) return { ok: false, error: 'No se encontró el plan propuesto.' }
    return { ok: true, datos: (data as { datos: unknown }).datos }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}

export type DecisionPrimerPlan = 'aprobar' | 'rechazar'
export type ResultadoDecision = { ok: true; plan: PrimerPlan } | { ok: false; error: string }

function mensajeDeError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return error.message || 'No tienes permiso para esta decisión.'
  if (error.code === 'P0002') return 'Este plan ya no existe.'
  return error.message || 'No se pudo guardar la decisión. Vuelve a intentarlo.'
}

/**
 * RPC `decidir_primer_plan` (0086). El actor sale de `auth.uid()` en el servidor. Aprobar
 * publica el plan (activa el microciclo) en la misma transacción. Rechazar exige motivo:
 * se comprueba aquí para no gastar una petición, y la base lo vuelve a exigir.
 */
export async function decidirPrimerPlan(
  aprobacionId: string,
  decision: DecisionPrimerPlan,
  motivo: string,
): Promise<ResultadoDecision> {
  const limpio = motivo.trim()
  if (decision === 'rechazar' && !limpio) return { ok: false, error: 'Escribe el motivo del rechazo.' }
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  try {
    const { data, error } = await supabase().rpc('decidir_primer_plan', {
      aprobacion_id: aprobacionId,
      decision,
      motivo: limpio || null,
    })
    if (error) return { ok: false, error: mensajeDeError(error) }
    const plan = data ? aPrimerPlan(data as unknown as FilaPrimerPlan) : null
    if (!plan) return { ok: false, error: 'La base devolvió una fila con forma inesperada.' }
    return { ok: true, plan }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}
