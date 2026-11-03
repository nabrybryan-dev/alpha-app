/**
 * Quien abre un enlace de contraseña arranca con el ingreso detenido: `alCambiar` se salta el
 * estado inicial para no hidratar durante la recuperación. Al terminar, el SIGNED_OUT de
 * «Ir a iniciar sesión» también se saltaba y la app se quedaba para siempre en «Sincronizando…»,
 * con la contraseña ya guardada (registros de producción y prueba real del 31-oct-2026).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from './SessionProvider'

type Oyente = (evento: string, sesion: { user: { id: string } } | null) => void

const arnes = vi.hoisted(() => ({ oyente: null as Oyente | null }))

vi.mock('../data/supabase', () => ({
  modoNube: true,
  sesionDeFunciones: async () => null,
  supabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u-valentina' } } } }),
      onAuthStateChange: (cb: Oyente) => {
        arnes.oyente = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      updateUser: async () => ({ error: null }),
      signOut: async () => {
        arnes.oyente?.('SIGNED_OUT', null)
        return { error: null }
      },
    },
    from: () => ({}),
    rpc: async () => ({ data: [], error: null }),
  }),
}))

describe('SessionProvider · al terminar de crear la contraseña', () => {
  beforeEach(() => {
    window.location.hash = '#access_token=x&type=recovery'
  })
  afterEach(() => {
    window.location.hash = ''
  })

  it('«Ir a iniciar sesión» sale de «Sincronizando…» y deja la URL limpia', async () => {
    const usuario = userEvent.setup()
    render(
      <SessionProvider>
        <p>dentro de la app</p>
      </SessionProvider>,
    )

    await usuario.type(screen.getByPlaceholderText('Nueva contraseña'), 'secreta1')
    await usuario.type(screen.getByPlaceholderText('Repite la contraseña'), 'secreta1')
    await usuario.click(screen.getByRole('button', { name: 'Guardar contraseña →' }))
    await usuario.click(await screen.findByRole('button', { name: 'Ir a iniciar sesión →' }))

    await vi.waitFor(() => {
      expect(screen.queryByPlaceholderText('Nueva contraseña')).toBeNull()
      expect(screen.queryByText('Sincronizando…')).toBeNull()
    })
    expect(screen.queryByText('dentro de la app')).toBeNull()
    expect(window.location.hash).toBe('')
  })
})
