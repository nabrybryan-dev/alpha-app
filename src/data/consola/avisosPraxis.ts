import { esNivelAviso, esOrigenAviso, type NivelAviso, type OrigenAviso } from '../../domain/praxis/aviso'
import { modoNube, supabase } from '../supabase'
import type { Escritura } from './decisiones'

/**
 * Los avisos de Praxis al coach (migración 0108, SIN APLICAR al escribir esto).
 *
 * La tabla `praxis_avisos_coach` guarda quién, cuándo, por dónde llegó y el TIPO de señal; jamás
 * la frase. Solo el coach la lee (RLS): cualquier otra sesión recibe una lista vacía de la base,
 * no un error, y por eso la pantalla decide quién ve el módulo ANTES de pedirla.
 *
 * Mientras la migración no esté aplicada la tabla no existe: eso se devuelve como `sinTabla`, y la
 * consola dice «falta aplicar la migración 0108» y nada más. Un fallo cualquiera NO se disfraza de
 * «sin avisos» (una lista vacía aquí es un vacío confirmado).
 */
export const TABLA_AVISOS_PRAXIS = 'praxis_avisos_coach'
export const COLUMNAS_AVISOS_PRAXIS = ['id', 'usuario_id', 'creado_en', 'origen', 'nivel', 'atendido_en', 'atendido_por'] as const

/** Cuántos pendientes y cuántos atendidos se piden. Los pendientes van primero y casi nunca pasan de unos pocos. */
export const MAX_PENDIENTES = 200
export const MAX_ATENDIDOS = 30

export interface AvisoPraxis {
  id: string
  usuarioId: string
  creadoEn: string
  origen: OrigenAviso
  nivel: NivelAviso
  atendidoEn: string | null
  atendidoPor: string | null
}

interface FilaAviso {
  id: string
  usuario_id: string
  creado_en: string
  origen: string
  nivel: string
  atendido_en: string | null
  atendido_por: string | null
}

export type LecturaAvisos =
  | { ok: true; datos: AvisoPraxis[] }
  | { ok: false; error: string; /** La tabla no existe: la migración 0108 no está aplicada. */ sinTabla: boolean }

/** Un valor que la app no conoce no se descarta en silencio: `null` y la lectura lo avisa. */
export function aAviso(f: FilaAviso): AvisoPraxis | null {
  if (!esNivelAviso(f.nivel) || !esOrigenAviso(f.origen)) return null
  return {
    id: String(f.id), usuarioId: f.usuario_id, creadoEn: f.creado_en, origen: f.origen, nivel: f.nivel,
    atendidoEn: f.atendido_en, atendidoPor: f.atendido_por,
  }
}

/** La tabla no existe: Postgres (42P01) o la caché de esquema de PostgREST (PGRST205). */
const noExiste = (codigo: string | undefined) => codigo === '42P01' || codigo === 'PGRST205'
const motivoDe = (e: unknown) => (e instanceof Error && e.message ? e.message : 'la consulta falló')

async function leer(atendidos: boolean): Promise<LecturaAvisos> {
  // Sin la nube (modo demo) no hay avisos que leer: un vacío confirmado.
  if (!modoNube) return { ok: true, datos: [] }
  try {
    const base = supabase().from(TABLA_AVISOS_PRAXIS).select(COLUMNAS_AVISOS_PRAXIS.join(','))
    const consulta = atendidos ? base.not('atendido_en', 'is', null) : base.is('atendido_en', null)
    const { data, error } = await consulta
      .order('creado_en', { ascending: false })
      .limit(atendidos ? MAX_ATENDIDOS : MAX_PENDIENTES)
    if (error) return { ok: false, error: error.message || 'la consulta falló', sinTabla: noExiste(error.code) }
    if (!Array.isArray(data)) return { ok: false, error: 'la respuesta no trajo filas', sinTabla: false }
    const filas = data as unknown as FilaAviso[]
    const datos = filas.map(aAviso).filter((a): a is AvisoPraxis => a !== null)
    if (datos.length !== filas.length) {
      return { ok: false, error: `${filas.length - datos.length} avisos con valores que la app no conoce`, sinTabla: false }
    }
    return { ok: true, datos }
  } catch (e) {
    return { ok: false, error: motivoDe(e), sinTabla: false }
  }
}

/** Los avisos sin atender, el más reciente primero. Nunca lanza. */
export const avisosPendientes = () => leer(false)
/** Los últimos avisos ya atendidos. Nunca lanza. */
export const avisosAtendidos = () => leer(true)

/**
 * Marca un aviso como atendido, por quien llama. La base solo deja a un coach, solo sobre un aviso
 * que sigue pendiente y solo a su nombre; si no toca ninguna fila (otro coach lo atendió antes, o
 * no hay permiso) lo dice, no finge que quedó.
 */
export async function marcarAvisoAtendido(id: string, atendidoPor: string): Promise<Escritura> {
  if (!modoNube) return { ok: false, error: 'sin la nube conectada no se puede marcar' }
  try {
    const { data, error } = await supabase()
      .from(TABLA_AVISOS_PRAXIS)
      .update({ atendido_en: new Date().toISOString(), atendido_por: atendidoPor })
      .eq('id', id)
      .is('atendido_en', null)
      .select('id')
    if (error) return { ok: false, error: error.message || 'la base rechazó la marca' }
    if (!Array.isArray(data) || data.length === 0) return { ok: false, error: 'el aviso ya no estaba pendiente, o no tienes permiso' }
    return { ok: true, id }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}
