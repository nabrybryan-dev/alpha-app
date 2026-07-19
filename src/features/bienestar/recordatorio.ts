const CLAVE_ULTIMA = 'alpha-notif-bienestar'
const HORA_RECORDATORIO = 18 // 6 pm

export function soporteNotificaciones(): boolean {
  return typeof Notification !== 'undefined'
}

export function permisoActual(): NotificationPermission | 'no-soportado' {
  return soporteNotificaciones() ? Notification.permission : 'no-soportado'
}

/** Pide el permiso del navegador (requiere un toque del usuario). */
export async function activarRecordatorios(): Promise<NotificationPermission | 'no-soportado'> {
  if (!soporteNotificaciones()) return 'no-soportado'
  return Notification.requestPermission()
}

async function mostrar(titulo: string, cuerpo: string): Promise<void> {
  try {
    const registro = await navigator.serviceWorker?.getRegistration()
    if (registro) {
      await registro.showNotification(titulo, {
        body: cuerpo,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'bienestar-diario',
      })
      return
    }
  } catch {
    // sin service worker disponible: intenta la vía directa
  }
  try {
    new Notification(titulo, { body: cuerpo, icon: '/icon-192.png' })
  } catch {
    // navegador sin soporte: no hay nada que hacer
  }
}

/**
 * Después de las 6 pm, si el asesorado no ha llenado su check-in de hoy,
 * dispara UNA notificación (máximo una por día). Se llama al abrir la app,
 * al volver a ella y en un chequeo periódico mientras esté abierta.
 */
export async function revisarRecordatorioBienestar(
  hayCheckinHoy: boolean,
  hoy: string,
): Promise<void> {
  if (permisoActual() !== 'granted') return
  if (hayCheckinHoy) return
  if (new Date().getHours() < HORA_RECORDATORIO) return
  if (localStorage.getItem(CLAVE_ULTIMA) === hoy) return
  localStorage.setItem(CLAVE_ULTIMA, hoy)
  await mostrar(
    'Tu check-in de bienestar te espera 🔴',
    'Ya pasan de las 6 pm y aún no registras tu día. Toma 1 minuto: sueño, energía y estrés. El coach programa tu semana con esos datos.',
  )
}
