export interface SesionAlpha {
  access_token: string
  url: string
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
): Promise<string | null> {
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
    return texto || null
  } catch {
    return null
  }
}
