import { modoNube, supabase } from '../supabase'

/**
 * Las respuestas del coach a las preguntas que la cadena de agentes le dejó (migración 0110,
 * SIN APLICAR al escribir esto).
 *
 * La tabla `respuestas_coach_cadena` guarda UNA fila por pregunta (`id_pregunta`, el `cp-…` que
 * pone el importador), con quién respondió y cuándo. Solo la escribe la RPC
 * `responder_pregunta_coach` (quien responde lo pone la base, `auth.uid()`; este archivo no manda
 * actor) y solo la leen el coach y la nutricionista. NO es `responder_como_staff` (0083): aquella
 * responde POR el asesorado a un cuestionario suyo; esta es la palabra del coach a una pregunta
 * que la cadena le hizo a él.
 *
 * Mientras la migración no está aplicada la tabla no existe: se devuelve `sinTabla` y la consola
 * muestra las preguntas con un aviso, sin romperse. Un fallo cualquiera NO se disfraza de «sin
 * respuestas»: si no se sabe qué está respondido, la pantalla lo dice.
 */
export const TABLA_RESPUESTAS_COACH = 'respuestas_coach_cadena'
export const COLUMNAS_RESPUESTAS_COACH = [
  'id_pregunta', 'usuario_id', 'paso', 'texto', 'respuesta', 'respondido_por', 'quien', 'respondido_en',
] as const

export interface RespuestaCoach {
  idPregunta: string
  usuarioId: string
  paso: number
  texto: string
  respuesta: string
  respondidoPor: string | null
  quien: string
  respondidoEn: string
}

interface FilaRespuesta {
  id_pregunta: string
  usuario_id: string
  paso: number
  texto: string
  respuesta: string
  respondido_por: string | null
  quien: string
  respondido_en: string
}

export type LecturaRespuestas =
  | { ok: true; datos: RespuestaCoach[] }
  | { ok: false; error: string; /** La tabla no existe: la migración 0110 no está aplicada. */ sinTabla: boolean }

export function aRespuesta(f: FilaRespuesta): RespuestaCoach {
  return {
    idPregunta: f.id_pregunta, usuarioId: f.usuario_id, paso: f.paso, texto: f.texto, respuesta: f.respuesta,
    respondidoPor: f.respondido_por, quien: f.quien, respondidoEn: f.respondido_en,
  }
}

/** La tabla no existe: Postgres (42P01) o la caché de esquema de PostgREST (PGRST205). */
const noExiste = (codigo: string | undefined) => codigo === '42P01' || codigo === 'PGRST205'
/** La función no existe todavía (PostgREST: PGRST202; Postgres: 42883). */
const funcionNoExiste = (codigo: string | undefined) => codigo === 'PGRST202' || codigo === '42883'
const motivoDe = (e: unknown) => (e instanceof Error && e.message ? e.message : 'la consulta falló')

/** Las respuestas ya dadas, la más reciente primero. Nunca lanza. */
export async function respuestasDelCoach(): Promise<LecturaRespuestas> {
  // Sin la nube (modo demo) no hay respuestas guardadas: un vacío confirmado.
  if (!modoNube) return { ok: true, datos: [] }
  try {
    const { data, error } = await supabase()
      .from(TABLA_RESPUESTAS_COACH)
      .select(COLUMNAS_RESPUESTAS_COACH.join(','))
      .order('respondido_en', { ascending: false })
      .limit(500)
    if (error) return { ok: false, error: error.message || 'la consulta falló', sinTabla: noExiste(error.code) }
    if (!Array.isArray(data)) return { ok: false, error: 'la respuesta no trajo filas', sinTabla: false }
    return { ok: true, datos: (data as unknown as FilaRespuesta[]).map(aRespuesta) }
  } catch (e) {
    return { ok: false, error: motivoDe(e), sinTabla: false }
  }
}

export interface EntradaRespuestaCoach {
  idPregunta: string
  usuarioId: string
  paso: number
  texto: string
  respuesta: string
}

export type ResultadoResponder = { ok: true } | { ok: false; error: string; sinMigracion: boolean }

/** Guarda la respuesta del coach. Nunca simula el éxito: si la base la rechaza, lo dice. */
export async function responderPreguntaCoach(e: EntradaRespuestaCoach): Promise<ResultadoResponder> {
  if (!modoNube) return { ok: false, error: 'sin la nube conectada no se puede responder', sinMigracion: false }
  const respuesta = e.respuesta.trim()
  if (respuesta.length === 0) return { ok: false, error: 'escribe la respuesta antes de guardar', sinMigracion: false }
  try {
    const { error } = await supabase().rpc('responder_pregunta_coach', {
      p_id_pregunta: e.idPregunta,
      p_usuario_id: e.usuarioId,
      p_paso: e.paso,
      p_texto: e.texto,
      p_respuesta: respuesta,
    })
    if (error) {
      if (funcionNoExiste(error.code)) {
        return { ok: false, error: 'falta aplicar la migración 0110 para poder responder', sinMigracion: true }
      }
      if (error.code === '42501') {
        return { ok: false, error: 'solo el coach o la nutricionista pueden responder', sinMigracion: false }
      }
      return { ok: false, error: error.message || 'la base rechazó la respuesta', sinMigracion: false }
    }
    return { ok: true }
  } catch (e2) {
    return { ok: false, error: motivoDe(e2), sinMigracion: false }
  }
}
