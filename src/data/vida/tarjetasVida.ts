import { modoNube, supabase } from '../supabase'
import { revisarRespuestasTarjetaVida, type RespuestasTarjetaVida } from '../../domain/tarjetaVida'

/**
 * Lectura y escritura de `tarjetas_vida` (migración 0088) — la tarjeta semanal de 7
 * preguntas del agente de estilo de vida. Contrato completo en
 * `docs/specs/2026-09-27-mensajes-de-estilo-de-vida.md`.
 *
 * A diferencia de `consola/planesEstrategicos.ts`, aquí el ASESORADO también escribe: la
 * RLS deja insertar solo la propia (`usuario_id = auth.uid()`), y este módulo no repite
 * esa comprobación — la asume, igual que `planesEstrategicos.ts` asume el índice único de
 * `vigente`.
 */
export const TABLA_TARJETAS_VIDA = 'tarjetas_vida'

interface FilaTarjetaVida {
  id: string
  usuario_id: string
  semana_inicio: string
  respuestas: RespuestasTarjetaVida
  creado_en: string
}

export interface TarjetaVida {
  id: string
  usuarioId: string
  semanaInicio: string
  respuestas: RespuestasTarjetaVida
  creadoEn: string
}

function aTarjetaVida(fila: FilaTarjetaVida): TarjetaVida {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    semanaInicio: fila.semana_inicio,
    respuestas: fila.respuestas,
    creadoEn: fila.creado_en,
  }
}

/**
 * Todas las semanas ya respondidas por esta persona (solo `semana_inicio`, ligero: es lo
 * único que hace falta para decidir si `debeMostrarTarjeta` — `domain/tarjetaVida.ts`).
 * `[]` sin sesión de nube o si algo falla: no bloquea el resto de Bienestar.
 */
export async function semanasRespondidasDe(usuarioId: string): Promise<string[]> {
  if (!modoNube || !usuarioId) return []
  try {
    const { data, error } = await supabase()
      .from(TABLA_TARJETAS_VIDA)
      .select('semana_inicio')
      .eq('usuario_id', usuarioId)
    if (error || !data) return []
    return (data as { semana_inicio: string }[]).map((f) => f.semana_inicio)
  } catch {
    return []
  }
}

/** La tarjeta más reciente de una persona, o `null`. Para la consola del coach. */
export async function ultimaTarjetaVidaDe(usuarioId: string): Promise<TarjetaVida | null> {
  if (!modoNube || !usuarioId) return null
  try {
    const { data, error } = await supabase()
      .from(TABLA_TARJETAS_VIDA)
      .select('id,usuario_id,semana_inicio,respuestas,creado_en')
      .eq('usuario_id', usuarioId)
      .order('semana_inicio', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return aTarjetaVida(data as unknown as FilaTarjetaVida)
  } catch {
    return null
  }
}

export type ResultadoGuardarTarjetaVida =
  | { ok: true }
  | { ok: false; motivo: 'sin_nube' }
  | { ok: false; motivo: 'respuestas_invalidas'; reparos: string[] }
  | { ok: false; motivo: 'ya_respondida' }
  | { ok: false; motivo: 'error' }

/**
 * Guarda la tarjeta de una semana. Valida con el dominio ANTES de mandarla — la base
 * también acepta cualquier jsonb (`respuestas` es de forma abierta a propósito, ver el
 * spec), así que sin esto un error de captura llegaría a guardarse igual.
 *
 * `ya_respondida` distingue el conflicto esperado (la unique de `usuario_id,
 * semana_inicio`) de un error real: la persona no hizo nada mal, alguien ya contestó esa
 * semana — por ejemplo, dos pestañas abiertas a la vez.
 */
export async function guardarTarjetaVida(
  usuarioId: string,
  semanaInicio: string,
  respuestas: RespuestasTarjetaVida,
): Promise<ResultadoGuardarTarjetaVida> {
  if (!modoNube || !usuarioId) return { ok: false, motivo: 'sin_nube' }
  const reparos = revisarRespuestasTarjetaVida(respuestas)
  if (reparos.length > 0) return { ok: false, motivo: 'respuestas_invalidas', reparos: reparos.map((r) => r.motivo) }

  try {
    const { error } = await supabase()
      .from(TABLA_TARJETAS_VIDA)
      .insert({ usuario_id: usuarioId, semana_inicio: semanaInicio, respuestas })
    if (error) {
      // 23505 = unique_violation (Postgres/PostgREST).
      if (error.code === '23505') return { ok: false, motivo: 'ya_respondida' }
      return { ok: false, motivo: 'error' }
    }
    return { ok: true }
  } catch {
    return { ok: false, motivo: 'error' }
  }
}
