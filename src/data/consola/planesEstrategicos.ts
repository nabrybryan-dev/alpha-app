import { modoNube, supabase } from '../supabase'

/**
 * Lectura de `planes_estrategicos` (migración 0083) — revisiones INMUTABLES del plan
 * estratégico por persona. Un único `vigente=true` por persona, forzado en la base por un
 * índice único parcial (`planes_estrategicos_un_vigente_por_persona`); este archivo no
 * repite esa garantía, la asume.
 *
 * SOLO LECTURA, igual que `cadenaCorridas.ts`: la escribe exclusivamente `service_role`.
 */
export const TABLA_PLANES_ESTRATEGICOS = 'planes_estrategicos'

export const COLUMNAS_PLANES_ESTRATEGICOS = [
  'id',
  'usuario_id',
  'version',
  'vigente',
  'contenido',
  'hash',
  'creado_en',
] as const

const SELECCION_PLANES_ESTRATEGICOS = COLUMNAS_PLANES_ESTRATEGICOS.join(',')

export interface FilaPlanEstrategico {
  id: string
  usuario_id: string
  version: number
  vigente: boolean
  contenido: unknown
  hash: string
  creado_en: string
}

export interface PlanEstrategico {
  id: string
  usuarioId: string
  version: number
  vigente: boolean
  /** El contenido jsonb del plan (objetivo, horizonte, filas…). Forma libre a propósito:
   *  la fija quien lo genera (la cadena), no este repo de lectura. */
  contenido: unknown
  hash: string
  creadoEn: string
}

function aPlanEstrategico(fila: FilaPlanEstrategico): PlanEstrategico {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    version: fila.version,
    vigente: fila.vigente,
    contenido: fila.contenido,
    hash: fila.hash,
    creadoEn: fila.creado_en,
  }
}

/**
 * El plan estratégico VIGENTE de una persona, o `null` si no tiene ninguno (o si algo
 * falla: sin sesión, sin red, tabla aún no aplicada). Nunca lanza — mismo contrato que
 * `medioPublicado` en `nube/medios.ts`: un plan que no carga no puede tumbar el resto de
 * la ficha del asesorado.
 */
export async function planVigente(usuarioId: string): Promise<PlanEstrategico | null> {
  if (!modoNube || !usuarioId) return null
  try {
    const { data, error } = await supabase()
      .from(TABLA_PLANES_ESTRATEGICOS)
      .select(SELECCION_PLANES_ESTRATEGICOS)
      .eq('usuario_id', usuarioId)
      .eq('vigente', true)
      .maybeSingle()

    if (error || !data) return null
    return aPlanEstrategico(data as unknown as FilaPlanEstrategico)
  } catch {
    return null
  }
}

/**
 * Todas las versiones de una persona, de la más reciente a la más vieja — el historial
 * completo de revisiones inmutables. `planVigente` no es un caso particular de esta lista
 * filtrado en memoria porque pedir solo el vigente es una consulta más barata que traer
 * todo el historial para leer una fila.
 */
export async function historialDePlanes(usuarioId: string): Promise<PlanEstrategico[]> {
  if (!modoNube || !usuarioId) return []
  try {
    const { data, error } = await supabase()
      .from(TABLA_PLANES_ESTRATEGICOS)
      .select(SELECCION_PLANES_ESTRATEGICOS)
      .eq('usuario_id', usuarioId)
      .order('version', { ascending: false })

    if (error || !data) return []
    return (data as unknown as FilaPlanEstrategico[]).map(aPlanEstrategico)
  } catch {
    return []
  }
}
