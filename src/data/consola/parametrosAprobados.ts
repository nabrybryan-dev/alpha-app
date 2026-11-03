import { canonizarParametros, type ParametrosCanonicos } from '../../domain/consolaCoach/parametrosAprobados'
import { modoNube, supabase } from '../supabase'

/**
 * `parametros_aprobados` (migración 0158): la aprobación de los parámetros de un plan
 * renovado, aparte de la del plan. El navegador LEE la fila y escribe SOLO por la RPC
 * `aprobar_parametros_plan`, que firma con `auth.uid()` y exige que los valores sean los
 * que el plan trae ahora.
 *
 * Modo demo: sin red; la aprobación vive en memoria mientras la pestaña esté abierta.
 */
export const TABLA_PARAMETROS_APROBADOS = 'parametros_aprobados'

export interface ParametrosAprobadosFila {
  planRenovadoId: string
  parametros: ParametrosCanonicos
  aprobadoPor: string
  aprobadoEn: string
}

interface FilaBase {
  plan_renovado_id: string
  parametros: unknown
  aprobado_por: string
  aprobado_en: string
}

export type LecturaParametrosAprobados =
  | { ok: true; aprobacion: ParametrosAprobadosFila | null }
  | { ok: false; error: string }
export type ResultadoAprobarParametros = { ok: true; aprobacion: ParametrosAprobadosFila } | { ok: false; error: string }

/** Estado local del modo demo. Se vacía con `reiniciarDemoParametros` (las pruebas). */
const demo = new Map<string, ParametrosAprobadosFila>()
const FIRMANTE_DEMO = 'demo'

export function reiniciarDemoParametros(): void {
  demo.clear()
}

/** Una fila con forma inesperada se descarta entera: nunca se pinta a medias. */
export function aParametrosAprobados(fila: FilaBase): ParametrosAprobadosFila | null {
  const p = fila.parametros
  if (typeof p !== 'object' || p === null || Array.isArray(p)) return null
  return {
    planRenovadoId: fila.plan_renovado_id,
    parametros: canonizarParametros(p as Record<string, unknown>),
    aprobadoPor: fila.aprobado_por,
    aprobadoEn: fila.aprobado_en,
  }
}

function mensajeDeError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return 'No tienes permiso para aprobar los parámetros.'
  if (error.code === 'P0002') return 'Este plan ya no existe.'
  return error.message || 'No se pudo guardar la aprobación. Vuelve a intentarlo.'
}

/** La aprobación de parámetros de ESE plan renovado, o `null` si nadie la dio. Nunca lanza. */
export async function leerParametrosAprobados(planRenovadoId: string): Promise<LecturaParametrosAprobados> {
  if (!modoNube) return { ok: true, aprobacion: demo.get(planRenovadoId) ?? null }
  try {
    const { data, error } = await supabase()
      .from(TABLA_PARAMETROS_APROBADOS)
      .select('plan_renovado_id,parametros,aprobado_por,aprobado_en')
      .eq('plan_renovado_id', planRenovadoId)
      .maybeSingle()
    if (error) return { ok: false, error: error.message || 'No se pudo leer la aprobación de parámetros.' }
    if (!data) return { ok: true, aprobacion: null }
    const fila = aParametrosAprobados(data as unknown as FilaBase)
    if (!fila) return { ok: false, error: 'La base devolvió una fila con forma inesperada.' }
    return { ok: true, aprobacion: fila }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}

/** RPC `aprobar_parametros_plan` (0158). Falla si los valores ya no son los del plan. */
export async function aprobarParametrosPlan(
  planRenovadoId: string,
  parametros: Record<string, unknown>,
): Promise<ResultadoAprobarParametros> {
  const canonicos = canonizarParametros(parametros)
  if (!modoNube) {
    const fila: ParametrosAprobadosFila = {
      planRenovadoId,
      parametros: canonicos,
      aprobadoPor: FIRMANTE_DEMO,
      aprobadoEn: new Date().toISOString(),
    }
    demo.set(planRenovadoId, fila)
    return { ok: true, aprobacion: fila }
  }
  try {
    const { data, error } = await supabase().rpc('aprobar_parametros_plan', {
      p_plan_renovado_id: planRenovadoId,
      p_parametros: canonicos,
    })
    if (error) return { ok: false, error: mensajeDeError(error) }
    const fila = data ? aParametrosAprobados(data as unknown as FilaBase) : null
    if (!fila) return { ok: false, error: 'La base devolvió una fila con forma inesperada.' }
    return { ok: true, aprobacion: fila }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}
