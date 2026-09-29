import {
  esEstadoComentario,
  esTipoComentario,
  type EstadoComentario,
  type TipoComentario,
} from '../../domain/comentariosApp'
import { modoNube, supabase } from '../supabase'
import type { Lectura } from './creadores'
import type { Escritura } from './decisiones'

/**
 * Comentarios de la app (migración 0095). Quien comenta lee SOLO los suyos por la vista
 * `mis_comentarios` (nunca la tabla: tiene campos internos del triaje) y envía por la
 * función `enviar_comentario`, que pone el autor, tapa correos y teléfonos, y acota el largo.
 * Este archivo no ofrece `insert` ni `update` porque la base los bloquea.
 *
 * Las columnas y los parámetros salen de aquí y las pruebas los comparan contra el SQL.
 */
export const VISTA_MIS_COMENTARIOS = 'mis_comentarios'
export const RPC_ENVIAR_COMENTARIO = 'enviar_comentario'

export const COLUMNAS_MIS_COMENTARIOS = ['id', 'creado_en', 'tipo', 'pantalla', 'texto', 'estado'] as const
export const PARAMETROS_ENVIAR_COMENTARIO = ['p_tipo', 'p_pantalla', 'p_texto', 'p_version'] as const

export interface FilaComentario {
  id: number | string
  creado_en: string
  tipo: string
  pantalla: string
  texto: string | null
  estado: string
}

export interface MiComentario {
  id: string
  creadoEn: string
  tipo: TipoComentario
  pantalla: string
  /** `null` cuando el texto crudo ya se purgó. */
  texto: string | null
  estado: EstadoComentario
}

/** Un valor que la app no conoce no se descarta en silencio: `null` y la lectura lo avisa. */
export function aComentario(f: FilaComentario): MiComentario | null {
  if (!esTipoComentario(f.tipo) || !esEstadoComentario(f.estado)) return null
  return { id: String(f.id), creadoEn: f.creado_en, tipo: f.tipo, pantalla: f.pantalla, texto: f.texto, estado: f.estado }
}

const motivoDe = (e: unknown) => (e instanceof Error && e.message ? e.message : 'la consulta falló')

/** Mis comentarios, el más reciente primero. Un vacío aquí es un vacío CONFIRMADO. Nunca lanza. */
export async function misComentarios(limite = 50): Promise<Lectura<MiComentario[]>> {
  if (!modoNube) return { ok: true, datos: [] }
  try {
    const { data, error } = await supabase()
      .from(VISTA_MIS_COMENTARIOS)
      .select(COLUMNAS_MIS_COMENTARIOS.join(','))
      .order('creado_en', { ascending: false })
      .order('id', { ascending: false })
      .limit(limite)
    if (error) return { ok: false, error: error.message || 'la consulta falló' }
    if (!Array.isArray(data)) return { ok: false, error: 'la respuesta no trajo filas' }
    const filas = data as unknown as FilaComentario[]
    const datos = filas.map(aComentario).filter((c): c is MiComentario => c !== null)
    if (datos.length !== filas.length) {
      return { ok: false, error: `${filas.length - datos.length} comentarios con valores que la app no conoce` }
    }
    return { ok: true, datos }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}

export interface EntradaComentario {
  tipo: TipoComentario
  /** `location.pathname`: la base vuelve a quitar `?` y `#`, pero no se manda de más. */
  pantalla: string
  texto: string
  version?: string | null
}

/** Envía un comentario. Si falla, lo dice (y la pantalla conserva lo escrito). */
export async function enviarComentario(entrada: EntradaComentario): Promise<Escritura> {
  if (!modoNube) return { ok: false, error: 'sin la nube conectada no se puede enviar' }
  try {
    const { data, error } = await supabase().rpc(RPC_ENVIAR_COMENTARIO, {
      p_tipo: entrada.tipo,
      p_pantalla: entrada.pantalla,
      p_texto: entrada.texto,
      p_version: entrada.version ?? null,
    })
    if (error) return { ok: false, error: error.message || 'la base rechazó el comentario' }
    return { ok: true, id: data === null || data === undefined ? null : String(data) }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}
