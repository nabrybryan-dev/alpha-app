import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tokenDeCrearClave } from './enlaceClave'
import { PuertaCrearClave } from './PuertaCrearClave'

const verificar = vi.fn()
vi.mock('../../data/supabase', () => ({
  supabase: () => ({ auth: { verifyOtp: verificar } }),
}))

/**
 * La vista previa de WhatsApp abre los enlaces antes que la persona. Un enlace que gaste el
 * código con solo abrirse le llega vencido a quien debía usarlo: por eso el código se gasta
 * al tocar el botón y nunca al cargar la pantalla.
 */
describe('PuertaCrearClave', () => {
  beforeEach(() => verificar.mockReset())

  it('abrir la pantalla no gasta el código', () => {
    render(<PuertaCrearClave token="abc123" onListo={vi.fn()} onVencido={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Crear mi contraseña →' })).toBeInTheDocument()
    expect(verificar).not.toHaveBeenCalled()
  })

  it('tocar el botón gasta el código y avisa que puede seguir', async () => {
    verificar.mockResolvedValue({ error: null })
    const onListo = vi.fn()
    const usuario = userEvent.setup()
    render(<PuertaCrearClave token="abc123" onListo={onListo} onVencido={vi.fn()} />)

    await usuario.click(screen.getByRole('button', { name: 'Crear mi contraseña →' }))

    expect(verificar).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'recovery' })
    expect(onListo).toHaveBeenCalledTimes(1)
  })

  it('un código vencido lleva a pedir otro', async () => {
    verificar.mockResolvedValue({ error: { code: 'otp_expired', message: 'Token has expired or is invalid' } })
    const onListo = vi.fn()
    const onVencido = vi.fn()
    const usuario = userEvent.setup()
    render(<PuertaCrearClave token="abc123" onListo={onListo} onVencido={onVencido} />)

    await usuario.click(screen.getByRole('button', { name: 'Crear mi contraseña →' }))

    expect(onVencido).toHaveBeenCalledTimes(1)
    expect(onListo).not.toHaveBeenCalled()
  })

  it('sin red no da el enlace por vencido: deja reintentar en español', async () => {
    // Así devuelve la librería un fallo de red: como `error`, sin lanzar.
    verificar.mockResolvedValue({ error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' } })
    const onVencido = vi.fn()
    const usuario = userEvent.setup()
    render(<PuertaCrearClave token="abc123" onListo={vi.fn()} onVencido={onVencido} />)

    await usuario.click(screen.getByRole('button', { name: 'Crear mi contraseña →' }))

    expect(await screen.findByText(/No pudimos conectarnos/)).toBeInTheDocument()
    expect(onVencido).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Crear mi contraseña →' })).toBeEnabled()
  })
})

describe('tokenDeCrearClave', () => {
  it('lee el código del enlace nuevo', () => {
    expect(tokenDeCrearClave('#crear-clave=ab12cd')).toBe('ab12cd')
  })

  it.each(['', '#type=recovery&access_token=x', '#crear-clave=', '#crear-clave=<script>', '#error_code=otp_expired'])(
    'ignora %s',
    (hash) => {
      expect(tokenDeCrearClave(hash)).toBeNull()
    },
  )
})
