/**
 * El permiso del navegador para avisar, y la suscripción que lo hace posible.
 *
 * **El permiso es de una sola bala.** Si la persona le dice que no al aviso del
 * navegador, en varios móviles ya no se puede volver a preguntar nunca. Por eso
 * este módulo NO se llama al abrir la app: se llama desde `PedirPermiso.tsx`,
 * después de que la persona haya dicho que sí en una pantalla nuestra que
 * explica para qué es. Eso sube mucho la aceptación y además parte el embudo en
 * dos trozos medibles.
 *
 * Nada de aquí lanza nunca. Un navegador sin soporte —o un permiso denegado— no
 * puede tumbar la pantalla desde la que se llama.
 */

export type ResultadoDelPermiso = 'no-soportado' | 'concedido' | 'rechazado'

export interface SuscripcionParaGuardar {
  endpoint: string
  p256dh: string
  auth: string
}

export function soportaAvisos(): boolean {
  return (
    typeof Notification !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  )
}

/**
 * Pide el permiso del navegador. Solo debe llamarse tras un toque de la persona
 * y tras haberle explicado para qué es.
 */
export async function pedirPermisoDelNavegador(): Promise<ResultadoDelPermiso> {
  if (!soportaAvisos()) return 'no-soportado'
  try {
    const respuesta = await Notification.requestPermission()
    return respuesta === 'granted' ? 'concedido' : 'rechazado'
  } catch {
    // Algunos navegadores lanzan si se pide fuera de un gesto del usuario.
    return 'no-soportado'
  }
}

function base64UrlABytes(base64Url: string): Uint8Array {
  const relleno = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const normal = (base64Url + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const crudo = atob(normal)
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)))
}

function bytesABase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Se suscribe al empuje y devuelve lo que hay que guardar, o `null`.
 *
 * Devolver `null` NO es un fallo del que haya que avisar a nadie: mientras no
 * exista la clave pública del servidor —la fontanería del empuje es la pieza
 * siguiente— aquí no hay a qué suscribirse, y el permiso ya se registró igual.
 * Ese es justo el punto: **medir cuánta gente acepta antes de construir el
 * empuje**, no al revés.
 */
export async function suscribirse(clavePublica: string): Promise<SuscripcionParaGuardar | null> {
  if (!soportaAvisos() || !clavePublica) return null
  try {
    const registro = await navigator.serviceWorker.getRegistration()
    if (!registro?.pushManager) return null
    const suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlABytes(clavePublica),
    })
    const endpoint = suscripcion.endpoint
    const p256dh = bytesABase64Url(suscripcion.getKey?.('p256dh') ?? null)
    const auth = bytesABase64Url(suscripcion.getKey?.('auth') ?? null)
    // Una suscripción a medias no se guarda: sin las dos claves el servidor no
    // puede cifrar el aviso, y una fila así parece buena y nunca entrega.
    if (!endpoint || !p256dh || !auth) return null
    return { endpoint, p256dh, auth }
  } catch {
    return null
  }
}
