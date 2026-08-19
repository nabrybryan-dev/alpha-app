import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LoginPage } from './LoginPage'

/**
 * Tests de caracterización: `LoginPage` no tenía ninguno y se iba a tocar para
 * meterle el fondo de marca. Se escriben contra el comportamiento de HOY para
 * que el cambio de fondo no se lleve nada por delante sin que salte un rojo.
 *
 * No cubren el camino que habla con Supabase —eso pide un doble y es otra
 * tanda—, sino lo que se ve y lo que valida antes de salir a la red.
 */
describe('LoginPage', () => {
  it('presenta la marca y el lema', () => {
    render(<LoginPage />)
    expect(screen.getByRole('heading', { name: 'Alpha Athletics' })).toBeInTheDocument()
    expect(screen.getByText('100% personalizado, 0% genérico')).toBeInTheDocument()
  })

  it('abre en modo login, con correo y contraseña', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText('tu@correo.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ENTRAR' })).toBeInTheDocument()
  })

  it('no sale a la red con los campos vacíos', async () => {
    const usuario = userEvent.setup()
    render(<LoginPage />)

    await usuario.click(screen.getByRole('button', { name: 'ENTRAR' }))

    expect(screen.getByText('Escribe tu correo y tu contraseña')).toBeInTheDocument()
  })

  it('al pedir recuperación esconde la contraseña y cambia el botón', async () => {
    const usuario = userEvent.setup()
    render(<LoginPage />)

    await usuario.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }))

    expect(screen.queryByPlaceholderText('Contraseña')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Enviar enlace de recuperación →' }),
    ).toBeInTheDocument()
  })

  it('la recuperación exige correo antes de intentar nada', async () => {
    const usuario = userEvent.setup()
    render(<LoginPage />)

    await usuario.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }))
    await usuario.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación →' }))

    expect(screen.getByText('Escribe tu correo para enviarte el enlace')).toBeInTheDocument()
  })

  it('vuelve a login y limpia el error de la pantalla anterior', async () => {
    const usuario = userEvent.setup()
    render(<LoginPage />)

    await usuario.click(screen.getByRole('button', { name: 'ENTRAR' }))
    expect(screen.getByText('Escribe tu correo y tu contraseña')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }))
    expect(screen.queryByText('Escribe tu correo y tu contraseña')).toBeNull()
  })

  it('lleva el fondo del rack, decorativo y sin anunciar', () => {
    const { container } = render(<LoginPage />)
    // Por la ruta y no por posición: el primer `img` de la página es el águila.
    const fondo = container.querySelector('img[src="/fondos/login-rack.jpg"]')

    expect(fondo).not.toBeNull()
    expect(fondo).toHaveAttribute('alt', '')
    expect(fondo).toHaveAttribute('aria-hidden', 'true')
  })

  it('no descarga el loop en el login: aquí el vídeo no es el contenido', () => {
    const { container } = render(<LoginPage />)
    const video = container.querySelector('video')

    // Mientras LOOP_HERO sea null no hay vídeo; cuando lo haya, sin precarga.
    if (video) expect(video).toHaveAttribute('preload', 'none')
    else expect(video).toBeNull()
  })
})
