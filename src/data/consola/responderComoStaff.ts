import { modoNube, supabase } from '../supabase'

/**
 * RPC `responder_como_staff(cuestionario_id, respuesta)` (migración 0083): el staff con la
 * capacidad `responder_por_asesorado` responde un cuestionario a nombre de un asesorado.
 *
 * El actor lo pone la base (`auth.uid()` dentro de la función), nunca este archivo — no
 * hay parámetro para mandarlo, y aunque lo hubiera la función lo ignora (Q2 de Astra: un
 * `_respondido_por` en el jsonb "no acredita autoría"). La respuesta queda marcada
 * `origen='staff'` y `respondido_por=auth.uid()` del lado del servidor.
 */

export type ResultadoResponderComoStaff = { ok: true } | { ok: false; error: string }

const CODIGO_SIN_PERMISO = '42501'
const CODIGO_CUESTIONARIO_NO_UNICO = 'P0002'

function mensajeDeError(error: { code?: string; message: string }): string {
  if (error.code === CODIGO_SIN_PERMISO) return 'No tienes permiso para responder por el asesorado.'
  if (error.code === CODIGO_CUESTIONARIO_NO_UNICO) {
    return 'El cuestionario no existe o está asignado a más de una persona: no se puede responder por nadie en concreto.'
  }
  return error.message || 'No se pudo guardar la respuesta. Vuelve a intentarlo.'
}

/** Nunca lanza: sin conexión (modo demo) o ante cualquier error de la base, devuelve un
 *  resultado con `error` legible en vez de tumbar la pantalla. */
export async function responderComoStaff(
  cuestionarioId: string,
  respuesta: Record<string, unknown>,
): Promise<ResultadoResponderComoStaff> {
  if (!modoNube) return { ok: false, error: 'Sin conexión con la base: esto es un demo.' }
  try {
    const { error } = await supabase().rpc('responder_como_staff', {
      cuestionario_id: cuestionarioId,
      respuesta,
    })
    if (error) return { ok: false, error: mensajeDeError(error) }
    return { ok: true }
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : 'Error de red.' }
  }
}
