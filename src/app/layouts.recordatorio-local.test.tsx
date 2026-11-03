import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * H-03 (decisión de Bryan, 28-oct): el recordatorio de las 6 pm del check-in sale del SERVIDOR (`avisos-plan`).
 * El aviso local, que solo funcionaba con la app abierta, ya no se dispara desde el layout.
 */
vi.mock('./SessionProvider', () => ({
  useSesion: () => ({
    usuario: { id: 'u-sin-checkin', nombre: 'Persona', rol: 'asesorado', avatarIniciales: 'PE' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  }),
  useSesionOpcional: () => null,
}))
vi.mock('../features/coach/consola/useCapacidades', () => ({
  useCapacidades: () => ({ cargando: false, tiene: () => false, usuarioId: 'u-sin-checkin' }),
}))
vi.mock('../components/ui/TopBar', () => ({ TopBar: ({ titulo }: { titulo: string }) => <h1>{titulo}</h1> }))
vi.mock('../features/plan/BannerPlanHoy', () => ({ BannerPlanHoy: () => null }))

const { AsesoradoLayout } = await import('./layouts')

const original = globalThis.Notification
const showNotification = vi.fn(() => Promise.resolve())
const crear = vi.fn()

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T19:30:00-05:00'))
  const Falso = function (this: unknown, ...a: unknown[]) {
    crear(...a)
  } as unknown as typeof Notification
  Object.defineProperty(Falso, 'permission', { value: 'granted' })
  globalThis.Notification = Falso
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: () => Promise.resolve({ showNotification }) },
  })
})
afterEach(() => {
  vi.useRealTimers()
  globalThis.Notification = original
  showNotification.mockClear()
  crear.mockClear()
})

describe('AsesoradoLayout · recordatorio local', () => {
  it('pasadas las 6 pm sin check-in, el layout ya no dispara una notificación local', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AsesoradoLayout />}>
            <Route index element={<p>Inicio</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(showNotification).not.toHaveBeenCalled()
    expect(crear).not.toHaveBeenCalled()
  })
})
