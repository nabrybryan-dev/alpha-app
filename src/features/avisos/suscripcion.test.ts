import { afterEach, describe, expect, it, vi } from 'vitest'
import { pedirPermisoDelNavegador, soportaAvisos, suscribirse } from './suscripcion'

const originalNotification = globalThis.Notification
const originalNavigator = globalThis.navigator

function ponerNavegador(opciones: {
  permiso?: NotificationPermission | 'lanza'
  registro?: unknown
  sinSoporte?: boolean
}) {
  if (opciones.sinSoporte) {
    // Se quita a propósito para simular un navegador sin soporte.
    delete (globalThis as { Notification?: unknown }).Notification
    return
  }
  // Doble de pruebas: solo se usa `requestPermission`, no el constructor.
  globalThis.Notification = {
    permission: 'default',
    requestPermission: () => {
      if (opciones.permiso === 'lanza') throw new Error('fuera de un gesto del usuario')
      return Promise.resolve(opciones.permiso ?? 'granted')
    },
  } as unknown as typeof Notification
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: { getRegistration: () => Promise.resolve(opciones.registro ?? null) },
    },
  })
}

afterEach(() => {
  globalThis.Notification = originalNotification
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator })
  vi.restoreAllMocks()
})

const CLAVE = 'BJ1TQ0FfLBs0aNU5r3YFtRZQhVj2sNfiiYlUCEuwB9wKk4vD3n6uH2WJ2qSPTQ0h5Q'

function registroConSuscripcion(claves: { p256dh?: string; auth?: string; endpoint?: string }) {
  const bytes = (t?: string) => (t ? new TextEncoder().encode(t).buffer : null)
  return {
    pushManager: {
      subscribe: () =>
        Promise.resolve({
          endpoint: claves.endpoint ?? 'https://push.example/abc',
          getKey: (nombre: string) => (nombre === 'p256dh' ? bytes(claves.p256dh) : bytes(claves.auth)),
        }),
    },
  }
}

describe('el permiso del navegador', () => {
  it('un navegador sin soporte no revienta: lo dice y ya', async () => {
    ponerNavegador({ sinSoporte: true })
    expect(soportaAvisos()).toBe(false)
    expect(await pedirPermisoDelNavegador()).toBe('no-soportado')
  })

  it('distingue conceder de rechazar', async () => {
    ponerNavegador({ permiso: 'granted' })
    expect(await pedirPermisoDelNavegador()).toBe('concedido')
    ponerNavegador({ permiso: 'denied' })
    expect(await pedirPermisoDelNavegador()).toBe('rechazado')
  })

  it('si el navegador lanza, se traga el error', async () => {
    ponerNavegador({ permiso: 'lanza' })
    expect(await pedirPermisoDelNavegador()).toBe('no-soportado')
  })
})

describe('la suscripción', () => {
  it('sin clave pública devuelve null, y eso NO es un fallo', async () => {
    // Mientras no exista la fontanería del empuje no hay a qué suscribirse, y
    // el permiso ya quedó registrado igual: medir antes de construir.
    ponerNavegador({ registro: registroConSuscripcion({ p256dh: 'a', auth: 'b' }) })
    expect(await suscribirse('')).toBeNull()
  })

  it('con clave y service worker devuelve lo que hay que guardar', async () => {
    ponerNavegador({ registro: registroConSuscripcion({ p256dh: 'clave', auth: 'secreto' }) })
    const s = await suscribirse(CLAVE)
    expect(s?.endpoint).toBe('https://push.example/abc')
    expect(s?.p256dh).toBeTruthy()
    expect(s?.auth).toBeTruthy()
  })

  it('una suscripción a medias NO se guarda', async () => {
    // Sin las dos claves el servidor no puede cifrar el aviso: la fila
    // parecería buena y no entregaría nunca.
    ponerNavegador({ registro: registroConSuscripcion({ p256dh: 'clave' }) })
    expect(await suscribirse(CLAVE)).toBeNull()
  })

  it('sin service worker registrado devuelve null sin lanzar', async () => {
    ponerNavegador({ registro: null })
    expect(await suscribirse(CLAVE)).toBeNull()
  })
})
