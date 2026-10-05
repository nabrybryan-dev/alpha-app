import {
  esEstadoPregunta,
  esEstadoRegla,
  esTipoReferencia,
  type EstadoPregunta,
  type EstadoRegla,
  type TipoReferencia,
} from '../../domain/mercadeoManuela'
import { modoNube, supabase } from '../supabase'
import type { Lectura } from './creadores'
import type { Escritura } from './decisiones'

/**
 * Buzón de mercadeo de Manuela (migración 0096): `mercadeo_preguntas` (pregunta, respuesta y
 * estado de la regla) y `mercadeo_referencias` (los enlaces). Manuela lee las suyas y el
 * coach todas (RLS). Las únicas escrituras son las funciones `responder_buzon_mercadeo`
 * (Manuela) y `mover_regla_mercadeo` (solo el coach); el navegador no inserta ni actualiza.
 *
 * Las columnas y los parámetros salen de aquí y las pruebas los comparan contra el SQL.
 */
export const TABLA_MERCADEO_PREGUNTAS = 'mercadeo_preguntas'
export const TABLA_MERCADEO_REFERENCIAS = 'mercadeo_referencias'
export const RPC_RESPONDER_BUZON = 'responder_buzon_mercadeo'
export const RPC_MOVER_REGLA = 'mover_regla_mercadeo'

export const COLUMNAS_MERCADEO_PREGUNTAS = [
  'id',
  'codigo',
  'texto',
  'tema',
  'uso',
  'destinataria_id',
  'enviada_en',
  'vence_en',
  'estado',
  'respuesta',
  'respondida_en',
  'regla_estado',
  'regla_codigo',
  'regla_enunciado',
  'regla_vigente_desde',
  'regla_revisar_antes_de',
] as const

export const COLUMNAS_MERCADEO_REFERENCIAS = ['id', 'pregunta_id', 'orden', 'tipo', 'url', 'url_normalizada', 'nota'] as const

export const PARAMETROS_RESPONDER_BUZON = ['p_pregunta_id', 'p_texto', 'p_referencias'] as const
export const PARAMETROS_MOVER_REGLA = ['p_id', 'p_estado', 'p_enunciado'] as const

interface FilaPregunta {
  id: string
  codigo: string
  texto: string
  tema: string
  uso: string
  destinataria_id: string
  enviada_en: string
  vence_en: string
  estado: string
  respuesta: string | null
  respondida_en: string | null
  regla_estado: string
  regla_codigo: string | null
  regla_enunciado: string | null
  regla_vigente_desde: string | null
  regla_revisar_antes_de: string | null
}

interface FilaReferencia {
  id: string
  pregunta_id: string
  orden: number
  tipo: string
  url: string
  url_normalizada: string
  nota: string
}

export interface Referencia {
  id: string
  orden: number
  tipo: TipoReferencia
  url: string
  urlNormalizada: string
  nota: string
}

export interface PreguntaMercadeo {
  id: string
  codigo: string
  texto: string
  tema: string
  uso: 'regla' | 'solo_contexto'
  destinatariaId: string
  enviadaEn: string
  venceEn: string
  estado: EstadoPregunta
  respuesta: string | null
  respondidaEn: string | null
  reglaEstado: EstadoRegla
  reglaCodigo: string | null
  reglaEnunciado: string | null
  reglaVigenteDesde: string | null
  reglaRevisarAntesDe: string | null
  referencias: Referencia[]
}

/** Un valor que la app no conoce no se descarta en silencio: `null` y la lectura lo avisa. */
export function aPregunta(f: FilaPregunta, referencias: Referencia[]): PreguntaMercadeo | null {
  if (!esEstadoPregunta(f.estado) || !esEstadoRegla(f.regla_estado)) return null
  if (f.uso !== 'regla' && f.uso !== 'solo_contexto') return null
  return {
    id: f.id,
    codigo: f.codigo,
    texto: f.texto,
    tema: f.tema,
    uso: f.uso,
    destinatariaId: f.destinataria_id,
    enviadaEn: f.enviada_en,
    venceEn: f.vence_en,
    estado: f.estado,
    respuesta: f.respuesta,
    respondidaEn: f.respondida_en,
    reglaEstado: f.regla_estado,
    reglaCodigo: f.regla_codigo,
    reglaEnunciado: f.regla_enunciado,
    reglaVigenteDesde: f.regla_vigente_desde,
    reglaRevisarAntesDe: f.regla_revisar_antes_de,
    referencias,
  }
}

export function aReferencia(f: FilaReferencia): Referencia | null {
  if (!esTipoReferencia(f.tipo)) return null
  return { id: f.id, orden: f.orden, tipo: f.tipo, url: f.url, urlNormalizada: f.url_normalizada, nota: f.nota }
}

const motivoDe = (e: unknown) => (e instanceof Error && e.message ? e.message : 'la consulta falló')

/**
 * Las preguntas visibles con sus referencias: las pendientes primero (por fecha de vencimiento)
 * y luego las respondidas, la más reciente primero. Un vacío es un vacío CONFIRMADO; un fallo
 * (también el de las referencias) es un fallo. Nunca lanza.
 */
export async function preguntasDeMercadeo(): Promise<Lectura<PreguntaMercadeo[]>> {
  if (!modoNube) return { ok: true, datos: [] }
  try {
    const p = await supabase()
      .from(TABLA_MERCADEO_PREGUNTAS)
      .select(COLUMNAS_MERCADEO_PREGUNTAS.join(','))
      .order('enviada_en', { ascending: false })
      .order('id', { ascending: true })
      .limit(200)
    if (p.error) return { ok: false, error: p.error.message || 'la consulta falló' }
    if (!Array.isArray(p.data)) return { ok: false, error: 'la respuesta no trajo filas' }
    const filas = p.data as unknown as FilaPregunta[]
    if (filas.length === 0) return { ok: true, datos: [] }

    const r = await supabase()
      .from(TABLA_MERCADEO_REFERENCIAS)
      .select(COLUMNAS_MERCADEO_REFERENCIAS.join(','))
      .in('pregunta_id', filas.map((f) => f.id))
      .order('orden', { ascending: true })
      .limit(2000)
    if (r.error) return { ok: false, error: r.error.message || 'la consulta de referencias falló' }
    if (!Array.isArray(r.data)) return { ok: false, error: 'la respuesta no trajo las referencias' }
    const refsFilas = r.data as unknown as FilaReferencia[]
    const refs = refsFilas.map(aReferencia)
    if (refs.some((x) => x === null)) return { ok: false, error: 'referencias con un tipo que la app no conoce' }

    const datos: PreguntaMercadeo[] = []
    for (const f of filas) {
      const propias = refsFilas
        .filter((x) => x.pregunta_id === f.id)
        .map(aReferencia)
        .filter((x): x is Referencia => x !== null)
      const q = aPregunta(f, propias)
      if (q === null) return { ok: false, error: 'una pregunta con valores que la app no conoce' }
      datos.push(q)
    }
    return { ok: true, datos }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}

export interface EntradaReferencia {
  tipo: TipoReferencia
  url: string
  nota: string
}

/** La respuesta de Manuela con sus referencias. La base decide si vale (una vez, sin vencer, sin contactos). */
export async function responderBuzon(preguntaId: string, texto: string, referencias: EntradaReferencia[]): Promise<Escritura> {
  if (!modoNube) return { ok: false, error: 'sin la nube conectada no se puede responder' }
  try {
    const { error } = await supabase().rpc(RPC_RESPONDER_BUZON, {
      p_pregunta_id: preguntaId,
      p_texto: texto,
      p_referencias: referencias.map((r) => ({ tipo: r.tipo, url: r.url, nota: r.nota })),
    })
    if (error) return { ok: false, error: error.message || 'la base rechazó la respuesta' }
    return { ok: true, id: preguntaId }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}

/** Solo el coach mueve la regla; la base lo comprueba y exige las 3 referencias para «vigente». */
export async function moverRegla(preguntaId: string, estado: Exclude<EstadoRegla, 'sin_regla' | 'caducada'>, enunciado?: string): Promise<Escritura> {
  if (!modoNube) return { ok: false, error: 'sin la nube conectada no se puede mover la regla' }
  try {
    const { error } = await supabase().rpc(RPC_MOVER_REGLA, {
      p_id: preguntaId,
      p_estado: estado,
      p_enunciado: enunciado ?? null,
    })
    if (error) return { ok: false, error: error.message || 'la base rechazó el cambio de la regla' }
    return { ok: true, id: preguntaId }
  } catch (e) {
    return { ok: false, error: motivoDe(e) }
  }
}
