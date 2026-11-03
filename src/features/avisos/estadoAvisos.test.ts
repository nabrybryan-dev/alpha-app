import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const guardar = vi.fn<(d: unknown) => Promise<void>>(() => Promise.resolve())
vi.mock('../../data/nube/avisos', () => ({ guardarDecisionDeAviso: (d: unknown) => guardar(d) }))

const { activarAvisos, apagarAvisos, CLAVE_VISTO, leerEstadoAvisos } = await import('./estadoAvisos')

const originalNotification = globalThis.Notification
const originalNavigator = globalThis.navigator

interface Doble {
  permiso: NotificationPermission
  pide?: NotificationPermission
  suscrito?: boolean
  sinSoporte?: boolean
}

/** Un navegador de mentira: permiso, service worker y suscripción. Devuelve las llamadas que importan. */
function ponerNavegador(o: Doble) {
  const llamadas = { pidio: 0, desuscribio: 0 }
  if (o.sinSoporte) {
    delete (globalThis as { Notification?: unknown }).Notification
    return llamadas
  }
  const estado = { permiso: o.permiso, suscrito: o.suscrito ?? false }
  const bytes = (t: string) => new TextEncoder().encode(t).buffer
  globalThis.Notification = {
    get permission() {
      return estado.permiso
    },
    requestPermission: () => {
      llamadas.pidio++
      estado.permiso = o.pide ?? 'granted'
      return Promise.resolve(estado.permiso)
    },
  } as unknown as typeof Notification
  const suscripcion = {
    endpoint: 'https://push.example/abc',
    getKey: (n: string) => bytes(n === 'p256dh' ? 'clave-p' : 'clave-a'),
    unsubscribe: () => {
      llamadas.desuscribio++
      estado.suscrito = false
      return Promise.resolve(true)
    },
  }
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        getRegistration: () =>
          Promise.resolve({
            pushManager: {
              getSubscription: () => Promise.resolve(estado.suscrito ? suscripcion : null),
              subscribe: () => {
                estado.suscrito = true
                return Promise.resolve(suscripcion)
              },
            },
          }),
      },
    },
  })
  return llamadas
}

beforeEach(() => {
  localStorage.clear()
  guardar.mockClear()
})

afterEach(() => {
  globalThis.Notification = originalNotification
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator })
})

describe('el estado real de los avisos', () => {
  it('sin soporte del navegador', async () => {
    ponerNavegador({ permiso: 'default', sinSoporte: true })
    expect(await leerEstadoAvisos()).toBe('no-soportado')
  })

  it('bloqueado, sin preguntar, apagado y activo según el permiso y la suscripción', async () => {
    ponerNavegador({ permiso: 'denied' })
    expect(await leerEstadoAvisos()).toBe('bloqueado')
    ponerNavegador({ permiso: 'default' })
    expect(await leerEstadoAvisos()).toBe('sin-preguntar')
    ponerNavegador({ permiso: 'granted', suscrito: false })
    expect(await leerEstadoAvisos()).toBe('apagado')
    ponerNavegador({ permiso: 'granted', suscrito: true })
    expect(await leerEstadoAvisos()).toBe('activo')
  })
})

describe('encender y apagar', () => {
  it('quien dijo «Ahora no» (flag puesto, el navegador nunca preguntó) puede volver a pedir y queda suscrito', async () => {
    localStorage.setItem(CLAVE_VISTO, 'si')
    const llamadas = ponerNavegador({ permiso: 'default' })
    expect(await activarAvisos('u-1')).toBe('activo')
    expect(llamadas.pidio).toBe(1)
    expect(guardar).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 'u-1', dijoSi: true, suscripcion: expect.objectContaining({ endpoint: 'https://push.example/abc' }) }),
    )
  })

  it('si el navegador dice que no, queda bloqueado y se guarda el no', async () => {
    ponerNavegador({ permiso: 'default', pide: 'denied' })
    expect(await activarAvisos('u-1')).toBe('bloqueado')
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ dijoSi: false }))
  })

  it('con el permiso ya dado y la suscripción quitada, encender no vuelve a preguntar', async () => {
    const llamadas = ponerNavegador({ permiso: 'granted', suscrito: false })
    expect(await activarAvisos('u-1')).toBe('activo')
    expect(llamadas.pidio).toBe(0)
  })

  it('apagar quita la suscripción y guarda el no sin endpoint', async () => {
    const llamadas = ponerNavegador({ permiso: 'granted', suscrito: true })
    expect(await apagarAvisos('u-1')).toBe('apagado')
    expect(llamadas.desuscribio).toBe(1)
    expect(guardar).toHaveBeenCalledWith({ usuarioId: 'u-1', dijoSi: false, suscripcion: null })
  })
})
