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

describe('PedirPermiso — la acción principal es el botón con cuerpo', () => {
  it('«Sí, avísame» lleva btn-3d y sigue pidiendo el permiso al tocarlo', async () => {
    render(<PedirPermiso usuarioId="u-1" />)
    const si = screen.getByRole('button', { name: 'Sí, avísame' })
    expect(si).toHaveClass('btn-3d')
    await userEvent.click(si)
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })
})
