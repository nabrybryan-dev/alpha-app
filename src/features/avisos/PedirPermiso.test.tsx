import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../data/nube/avisos', () => ({ guardarDecisionDeAviso: () => Promise.resolve() }))

const { PedirPermiso } = await import('./PedirPermiso')

const original = globalThis.Notification

beforeEach(() => {
  localStorage.clear()
  globalThis.Notification = { permission: 'default', requestPermission: () => Promise.resolve('denied') } as unknown as typeof Notification
  Object.defineProperty(globalThis.navigator, 'serviceWorker', { configurable: true, value: {} })
})
afterEach(() => {
  globalThis.Notification = original
})

describe('la tarjeta «¿Te avisamos en el teléfono?»', () => {
  it('H-03: «Sí» sin permiso manda a Yo, no a «los ajustes de tu teléfono» (que la app no puede abrir)', async () => {
    render(<PedirPermiso usuarioId="u-1" />)
    await userEvent.click(screen.getByRole('button', { name: 'Sí, avísame' }))
    const aviso = await screen.findByRole('status')
    expect(aviso.textContent).toMatch(/Yo/)
    expect(aviso.textContent).not.toMatch(/ajustes de tu teléfono/)
  })
})
