import { modoNube, supabase } from '../supabase'

/**
 * La organización guardada de la persona (migración 0179): qué escondió y si hay algo que deshacer. Solo se escribe por
 * las funciones `praxis_organizacion_aplicar` y `praxis_organizacion_deshacer`; las reglas (qué se puede esconder, tope,
 * choque entre aparatos, aviso al coach por peso o medidas) las valida la base, no el teléfono.
 *
 * Todo lo raro (sin nube, sin migración aplicada, red caída, respuesta con otra forma) cae en «no se pudo»: nunca se
 * dice «Listo» sin que la base haya contestado `aplicado`.
 */

export const RPC_APLICAR_ORGANIZACION = 'praxis_organizacion_aplicar'
export const RPC_DESHACER_ORGANIZACION = 'praxis_organizacion_deshacer'

export interface OrganizacionGuardada {
  version: number
  ocultas: string[]
  /** { id: lugares movidos } (negativo = hacia arriba). */
  movidas: Record<string, number>
  hayCambiosParaDeshacer: boolean
}

export type ResultadoDeGuardar = { resultado: 'aplicado'; version: number } | { resultado: 'choque' } | { resultado: 'no_se_pudo' }

/** Lo que se le manda a la base: solo ids del catálogo, nunca la frase. */
export type CambioParaGuardar =
  | { tipo: 'pieza'; accion: 'ocultar' | 'fijar' | 'mover_arriba' | 'mover_abajo'; pieza: string }
  | { tipo: 'restablecer' }
  | { tipo: 'solo_lo_importante'; piezas: string[] }

export interface DependenciasOrganizacion {
  rpc: (nombre: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>
  leerFila: (usuarioId: string) => Promise<{ data: unknown; error: unknown }>
  hayCambioSinDeshacer: (usuarioId: string) => Promise<{ data: unknown; error: unknown }>
}

const porDefecto = (): DependenciasOrganizacion => ({
  rpc: async (nombre, args) => {
    if (!modoNube) return { data: null, error: { code: 'sin_nube' } }
    const { data, error } = await supabase().rpc(nombre, args)
    return { data, error: error ? { code: error.code } : null }
  },
  // Filtra por la persona: el equipo puede leer todas las filas (soporte), y aquí solo cuenta la propia.
  leerFila: async (usuarioId) => {
    if (!modoNube) return { data: null, error: null }
    return supabase().from('praxis_organizacion').select('version,ocultas,movidas').eq('usuario_id', usuarioId).maybeSingle()
  },
  hayCambioSinDeshacer: async (usuarioId) => {
    if (!modoNube) return { data: [], error: null }
    return supabase().from('praxis_organizacion_cambios').select('id').eq('usuario_id', usuarioId).is('deshecho_en', null).limit(1)
  },
})

const VACIA: OrganizacionGuardada = { version: 0, ocultas: [], movidas: {}, hayCambiosParaDeshacer: false }

/** La organización de la persona; sin fila (nunca organizó) o ante cualquier error, la vacía. Nunca lanza. */
export async function leerOrganizacion(usuarioId: string, deps: Partial<DependenciasOrganizacion> = {}): Promise<OrganizacionGuardada> {
  const d = { ...porDefecto(), ...deps }
  try {
    const [fila, cambios] = await Promise.all([d.leerFila(usuarioId), d.hayCambioSinDeshacer(usuarioId)])
    if (fila.error) return VACIA
    const f = fila.data as { version?: unknown; ocultas?: unknown; movidas?: unknown } | null
    const ocultas = Array.isArray(f?.ocultas) ? f.ocultas.filter((x): x is string => typeof x === 'string') : []
    const version = typeof f?.version === 'number' ? f.version : 0
    const hay = !cambios.error && Array.isArray(cambios.data) && cambios.data.length > 0
    return { version, ocultas, movidas: leerMovidas(f?.movidas), hayCambiosParaDeshacer: hay }
  } catch {
    return VACIA
  }
}

function leerMovidas(x: unknown): Record<string, number> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {}
  return Object.fromEntries(Object.entries(x).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1])))
}

function leerResultado(data: unknown): ResultadoDeGuardar {
  const r = data as { resultado?: unknown; version?: unknown } | null
  if (r?.resultado === 'aplicado' && typeof r.version === 'number') return { resultado: 'aplicado', version: r.version }
  if (r?.resultado === 'choque') return { resultado: 'choque' }
  return { resultado: 'no_se_pudo' }
}

/** Guarda un cambio que la persona ya confirmó. `version`: la que se tenía al proponer (detecta el choque entre aparatos). */
export async function guardarCambioDeOrganizacion(cambio: CambioParaGuardar, version: number | null, deps: Partial<DependenciasOrganizacion> = {}): Promise<ResultadoDeGuardar> {
  const d = { ...porDefecto(), ...deps }
  try {
    const r = await d.rpc(RPC_APLICAR_ORGANIZACION, { p_cambio: cambio, p_version: version })
    return r.error ? { resultado: 'no_se_pudo' } : leerResultado(r.data)
  } catch {
    return { resultado: 'no_se_pudo' }
  }
}

/** Devuelve el último cambio. «nada que deshacer» también es «no se pudo» para la tarjeta (no se cambió nada). */
export async function deshacerUltimoCambioDeOrganizacion(deps: Partial<DependenciasOrganizacion> = {}): Promise<ResultadoDeGuardar> {
  const d = { ...porDefecto(), ...deps }
  try {
    const r = await d.rpc(RPC_DESHACER_ORGANIZACION, {})
    return r.error ? { resultado: 'no_se_pudo' } : leerResultado(r.data)
  } catch {
    return { resultado: 'no_se_pudo' }
  }
}
