import {
  esAutor,
  esEstadoHallazgoM,
  esTipoHallazgo,
  type ComentarioHallazgo,
  type HallazgoMercadeo,
} from '../../domain/hallazgosMercadeo'
import { modoNube, supabase } from '../supabase'
import type { Lectura } from './creadores'
import type { Escritura } from './decisiones'

/**
 * Hallazgos de la investigación de mercadeo y su hilo (migración 0103): `mercadeo_hallazgos` y
 * `mercadeo_hallazgo_comentarios`. Leen Manuela (`responder_mercadeo`) y el coach (RLS). La única
 * escritura desde la app es `comentar_hallazgo_mercadeo`; los hallazgos y las respuestas del
 * agente los escribe `service_role`. Las columnas y el parámetro salen de aquí y las pruebas los
 * comparan contra el SQL.
 */
export const TABLA_HALLAZGOS = 'mercadeo_hallazgos'
export const TABLA_COMENTARIOS_HALLAZGO = 'mercadeo_hallazgo_comentarios'
export const RPC_COMENTAR_HALLAZGO = 'comentar_hallazgo_mercadeo'

export const COLUMNAS_HALLAZGOS = [
  'id', 'codigo', 'tipo', 'titulo', 'resumen', 'fuente_nombre', 'fuente_url', 'fuente_fecha', 'estado',
] as const
export const COLUMNAS_COMENTARIOS_HALLAZGO = ['id', 'hallazgo_id', 'autor', 'texto', 'en_respuesta_a', 'creado_en'] as const
export const PARAMETROS_COMENTAR_HALLAZGO = ['p_hallazgo_id', 'p_texto'] as const

interface FilaHallazgo {
  id: string
  codigo: string
  tipo: string
  titulo: string
  resumen: string
  fuente_nombre: string | null
  fuente_url: string | null
  fuente_fecha: string | null
  estado: string
}
interface FilaComentario {
  id: string
  hallazgo_id: string
  autor: string
  texto: string
  en_respuesta_a: string | null
  creado_en: string
}

const motivoDe = (e: unknown) => (e instanceof Error && e.message ? e.message : 'la consulta falló')

/** Si la tabla no existe todavía (la 0103 sin aplicar), la pantalla dice «pendiente», no «error». */
export const TEXTO_PENDIENTE_0103 = 'Pendiente de activar (migración 0103)'
export function esTablaAusente0103(error: string): boolean {
  return /could not find the table|schema cache|PGRST205|42P01|relation .*does not exist/i.test(error)
}

/**
 * Los hallazgos con su hilo. Un valor que la app no conoce no se descarta en silencio: la lectura
 * falla y lo dice. Un vacío es un vacío CONFIRMADO. Nunca lanza.
 */
export async function hallazgosDeMercadeo(): Promise<Lectura<HallazgoMercadeo[]>> {
  if (!modoNube) return { ok: true, datos: [] }
  try {
    const h = await supabase()
      .from(TABLA_HALLAZGOS)
      .select(COLUMNAS_HALLAZGOS.join(','))
      .order('creado_en', { ascending: false })
      .order('id', { ascending: true })
      .limit(200)
    if (h.error) return { ok: false, error: h.error.message || 'la consulta falló' }
    if (!Array.isArray(h.data)) return { ok: false, error: 'la respuesta no trajo filas' }
    const filas = h.data as unknown as FilaHallazgo[]
    if (filas.length === 0) return { ok: true, datos: [] }

    const c = await supabase()
      .from(TABLA_COMENTARIOS_HALLAZGO)
      .select(COLUMNAS_COMENTARIOS_HALLAZGO.join(','))
      .in('hallazgo_id', filas.map((f) => f.id))
      .order('creado_en', { ascending: true })
      .limit(2000)
    if (c.error) return { ok: false, error: c.error.message || 'la consulta de comentarios falló' }
    if (!Array.isArray(c.data)) return { ok: false, error: 'la respuesta no trajo los comentarios' }
    const comentariosFilas = c.data as unknown as FilaComentario[]

    const comentarios: ComentarioHallazgo[] = []
    for (const f of comentariosFilas) {
      if (!esAutor(f.autor)) return { ok: false, error: 'un comentario con un autor que la app no conoce' }
      comentarios.push({ id: f.id, hallazgoId: f.hallazgo_id, autor: f.autor, texto: f.texto, enRespuestaA: f.en_respuesta_a, creadoEn: f.creado_en })
    }

    const datos: HallazgoMercadeo[] = []
    for (const f of filas) {
      if (!esTipoHallazgo(f.tipo) || !esEstadoHallazgoM(f.estado)) {
        return { ok: false, error: 'un hallazgo con un tipo o un estado que la app no conoce' }
      }
      datos.push({
        id: f.id,
        codigo: f.codigo,
        tipo: f.tipo,
        titulo: f.titulo,
        resumen: f.resumen,
        fuenteNombre: f.fuente_nombre,
        fuenteUrl: f.fuente_url,
        fuenteFecha: f.fuente_fecha,
        estado: f.estado,
        comentarios: comentarios.filter((x) => x.hallazgoId === f.id),
      })
    }
    return { ok: true, datos }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}

/** Un comentario de Manuela o de Bryan. La base decide si vale (permiso, sin contactos, no descartado). */
export async function comentarHallazgo(hallazgoId: string, texto: string): Promise<Escritura> {
  if (!modoNube) return { ok: false, error: 'sin la nube conectada no se puede comentar' }
  try {
    const { data, error } = await supabase().rpc(RPC_COMENTAR_HALLAZGO, { p_hallazgo_id: hallazgoId, p_texto: texto })
    if (error) return { ok: false, error: error.message || 'la base rechazó el comentario' }
    return { ok: true, id: typeof data === 'string' ? data : null }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}
