/**
 * LOS MENSAJES DEL EQUIPO A PRAXIS (migración 0159, decisión de Bryan, 3-nov-2026). Guarda la frase COMPLETA de una persona
 * del equipo (coach, nutricionista o el puesto de coach; de asesorados nada) junto con la intención que ya etiquetó el
 * registrador, para que Bryan o Manuela la etiqueten por clase (CRITERIO-CAPA-INTENCION-20261103). No llama a ningún modelo.
 *
 * Se escribe con el JWT de la persona (RLS `es_staff()`), nunca con service_role. Cualquier fallo (rol, insert) NO afecta
 * la respuesta: deja una línea `praxis-registro: mensaje_equipo <motivo>`, sin la frase.
 */

/** Tope de la columna `frase` en `praxis_mensajes_equipo` (check de la migración 0159). */
export const FRASE_MENSAJE_MAX = 600

interface EntornoMensajes {
  entorno: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string }
  fetch: typeof fetch
}
interface SesionMensajes { token: string; usuarioId: string; rol?: string | null; puesto?: boolean }

export async function guardarMensajeEquipo(d: EntornoMensajes, s: SesionMensajes, frase: string, intencion: readonly string[]): Promise<void> {
  try {
    if (s.rol !== 'coach' && s.rol !== 'nutricionista' && s.puesto !== true) return
    const r = await d.fetch(`${d.entorno.SUPABASE_URL}/rest/v1/praxis_mensajes_equipo`, {
      method: 'POST',
      headers: { apikey: d.entorno.SUPABASE_ANON_KEY, authorization: `Bearer ${s.token}`, 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify({
        usuario_id: s.usuarioId,
        frase: frase.trim().slice(0, FRASE_MENSAJE_MAX), // una frase más larga no se pierde, se guarda recortada
        intencion_registrador: [...intencion].slice(0, 8),
      }),
    })
    console.log('praxis-registro: mensaje_equipo', r.ok ? 'ok' : `http_${r.status}`)
  } catch (e) {
    console.log('praxis-registro: mensaje_equipo', `error_${e instanceof Error ? e.name : 'desconocido'}`)
  }
}
