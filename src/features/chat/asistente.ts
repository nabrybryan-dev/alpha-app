export interface SesionAlpha {
  access_token: string
  url: string
}

export interface RespuestaAlpha {
  texto: string
  /**
   * Id de la fila que la funcion YA escribio en `mensajes`. Viene sin definir
   * si no se pudo guardar; en ese caso la app la pinta igual con un id local y
   * la respuesta se pierde al rehidratar, pero la persona ya la leyo.
   */
  mensajeId?: string
}

/**
 * Pide la respuesta del Centro de Respuestas. Devuelve null ante cualquier
 * problema: si el asistente falla, el mensaje del asesorado ya quedo enviado
 * al coach y el chat sigue funcionando como siempre. Nunca lanza.
 *
 * No manda el usuario: lo saca el servidor del token. Mandarlo permitiria
 * pasar el de otra persona.
 */
export async function pedirRespuestaAlpha(
  mensaje: string,
  sesion: SesionAlpha | null,
): Promise<RespuestaAlpha | null> {
  if (!sesion?.access_token || !sesion.url) return null

  try {
    const r = await fetch(`${sesion.url}/functions/v1/responder-chat`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${sesion.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ mensaje }),
    })
    if (!r.ok) return null
    const datos = await r.json()
    const texto = typeof datos?.respuesta === 'string' ? datos.respuesta.trim() : ''
    if (!texto) return null
    const mensajeId = typeof datos?.mensaje_id === 'string' ? datos.mensaje_id : undefined
    return { texto, mensajeId }
  } catch {
    return null
  }
}
