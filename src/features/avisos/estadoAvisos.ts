import { guardarDecisionDeAviso } from '../../data/nube/avisos'
import { claveVapidPublica } from './clavePublica'
import { pedirPermisoDelNavegador, soportaAvisos, suscribirse } from './suscripcion'

/**
 * El estado REAL de los avisos en este aparato, para el interruptor de «Yo» (H-03, decisión de Bryan, 28-oct).
 *
 *   · `no-soportado`: el navegador no sabe de avisos (o no hay service worker).
 *   · `bloqueado`: la persona le dijo que no al navegador; desde la app NO se puede volver a preguntar.
 *   · `sin-preguntar`: el navegador aún no ha preguntado (incluye a quien dijo «Ahora no» en nuestra tarjeta de
 *     Hoy, que nunca llegó al navegador): aquí SÍ se puede pedir.
 *   · `apagado`: el navegador lo permite pero no hay suscripción (la quitó aquí, o nunca se creó).
 *   · `activo`: permitido y suscrito: el servidor puede avisarle aunque la app esté cerrada.
 */
export type EstadoAvisos = 'no-soportado' | 'bloqueado' | 'sin-preguntar' | 'apagado' | 'activo'

/** Dónde se recuerda, en ESTE aparato, que la tarjeta de Hoy ya preguntó (la misma clave que usa `PedirPermiso`). */
export const CLAVE_VISTO = 'alpha-aviso-preguntado'

const CLAVE_PUBLICA = claveVapidPublica(import.meta.env.VITE_VAPID_PUBLIC_KEY)

async function suscripcionActual(): Promise<PushSubscription | null> {
  try {
    const registro = await navigator.serviceWorker.getRegistration()
    return (await registro?.pushManager?.getSubscription()) ?? null
  } catch {
    return null
  }
}

export async function leerEstadoAvisos(): Promise<EstadoAvisos> {
  if (!soportaAvisos()) return 'no-soportado'
  if (Notification.permission === 'denied') return 'bloqueado'
  if (Notification.permission === 'default') return 'sin-preguntar'
  return (await suscripcionActual()) ? 'activo' : 'apagado'
}

function recordarQueYaSePregunto() {
  try {
    localStorage.setItem(CLAVE_VISTO, 'si')
  } catch {
    // Un navegador que no deja guardar preferencias no puede bloquear esto.
  }
}

/**
 * Enciende los avisos. Solo debe llamarse tras un toque de la persona. Si el navegador aún no ha preguntado, pregunta
 * (también a quien antes dijo «Ahora no» en la tarjeta de Hoy). La decisión se guarda SIEMPRE, salga o no la suscripción.
 */
export async function activarAvisos(usuarioId: string): Promise<EstadoAvisos> {
  if (!soportaAvisos()) return 'no-soportado'
  recordarQueYaSePregunto()
  let concedido = Notification.permission === 'granted'
  if (!concedido && Notification.permission === 'default') {
    concedido = (await pedirPermisoDelNavegador()) === 'concedido'
  }
  const suscripcion = concedido ? await suscribirse(CLAVE_PUBLICA) : null
  await guardarDecisionDeAviso({ usuarioId, dijoSi: concedido, suscripcion })
  return leerEstadoAvisos()
}

/**
 * Apaga los avisos: quita la suscripción del aparato y deja guardado que dijo que no (sin endpoint, el servidor ya no
 * le escribe). El permiso del navegador se queda como está: volver a encender no pregunta otra vez.
 */
export async function apagarAvisos(usuarioId: string): Promise<EstadoAvisos> {
  const suscripcion = await suscripcionActual()
  try {
    await suscripcion?.unsubscribe()
  } catch {
    // Si el navegador no la suelta, igual se deja dicho que no: el servidor deja de usarla.
  }
  await guardarDecisionDeAviso({ usuarioId, dijoSi: false, suscripcion: null })
  return leerEstadoAvisos()
}
