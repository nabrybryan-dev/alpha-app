// Se carga dentro del service worker de la app (workbox.importScripts en vite.config.ts).
// Muestra el aviso del organizador y, al tocarlo, abre Mi plan (/mi-plan o /coach/mi-plan).
self.addEventListener('push', (event) => {
  let d = {}
  try {
    d = event.data ? event.data.json() : {}
  } catch {
    d = {}
  }
  event.waitUntil(
    self.registration.showNotification(d.titulo || 'Mi plan', {
      body: d.cuerpo || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || 'plan',
      data: { url: d.url || '/mi-plan' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/mi-plan'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ('focus' in v) {
          v.focus()
          if ('navigate' in v) return v.navigate(url)
          return undefined
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
