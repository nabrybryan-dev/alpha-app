import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const recuperar = vi.fn()
vi.mock('../../data/supabase', () => ({
  supabase: () => ({ auth: { resetPasswordForEmail: recuperar } }),
}))

/** El camino de quien crea o recupera su contraseña desde su correo. */
describe('LoginPage · contraseña desde el correo', () => {
  beforeEach(() => recuperar.mockReset())

  it('con un enlace vencido explica qué pasó y deja pedir otro', () => {
    render(<LoginPage enlaceVencido />)

    expect(screen.getByText(/enlace ya venció o ya se usó/)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Contraseña')).toBeNull()
    expect(screen.getByRole('button', { name: 'Enviarme el enlace →' })).toBeInTheDocument()
  })

  it('quien entra por primera vez encuentra cómo crear su contraseña', async () => {
    const usuario = userEvent.setup()
    render(<LoginPage />)

    await usuario.click(screen.getByRole('button', { name: '¿Primera vez o se te olvidó tu contraseña?' }))

    expect(screen.getByRole('button', { name: 'Enviarme el enlace →' })).toBeInTheDocument()
  })

  it('confirma el envío al correo escrito', async () => {
    recuperar.mockResolvedValue({ error: null })
    const usuario = userEvent.setup()
    render(<LoginPage enlaceVencido />)

    await usuario.type(screen.getByPlaceholderText('tu@correo.com'), ' luisa@ejemplo.com ')
    await usuario.click(screen.getByRole('button', { name: 'Enviarme el enlace →' }))

    expect(recuperar).toHaveBeenCalledWith('luisa@ejemplo.com', { redirectTo: window.location.origin })
    expect(await screen.findByText(/te llegará un enlace para crear tu contraseña/)).toBeInTheDocument()
  })

  it('si el envío falla no muestra el error técnico en inglés', async () => {
    recuperar.mockResolvedValue({ error: { message: 'Email address not authorized' } })
    const usuario = userEvent.setup()
    render(<LoginPage enlaceVencido />)

    await usuario.type(screen.getByPlaceholderText('tu@correo.com'), 'luisa@ejemplo.com')
    await usuario.click(screen.getByRole('button', { name: 'Enviarme el enlace →' }))

    expect(await screen.findByText(/No pudimos enviar el correo/)).toBeInTheDocument()
    expect(screen.queryByText(/not authorized/)).toBeNull()
  })
})
