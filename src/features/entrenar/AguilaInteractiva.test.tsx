import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AguilaInteractiva } from './AguilaInteractiva'

let reducido = false
const animar = vi.fn()

function declararMatchMedia() {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: reducido && consulta.includes('prefers-reduced-motion'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

beforeEach(() => {
  reducido = false
  animar.mockClear()
  declararMatchMedia()
  // jsdom no implementa la Web Animations API.
  vi.stubGlobal('HTMLElement', window.HTMLElement)
  window.HTMLElement.prototype.animate = animar as unknown as HTMLElement['animate']
})

afterEach(() => vi.unstubAllGlobals())

describe('AguilaInteractiva', () => {
  it('el aguila es decorativa: se anuncia el boton, no la imagen', () => {
    render(<AguilaInteractiva />)
    expect(screen.getByRole('button', { name: 'Águila Alpha' })).toBeInTheDocument()
    // La <img> lleva alt vacio y aria-hidden, asi que no sale como imagen.
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('al tocarla da la vuelta', async () => {
    const usuario = userEvent.setup()
    render(<AguilaInteractiva />)
    await usuario.click(screen.getByRole('button', { name: 'Águila Alpha' }))
    expect(animar).toHaveBeenCalledTimes(1)
  })

  it('con movimiento reducido no gira', async () => {
    reducido = true
    declararMatchMedia()
    const usuario = userEvent.setup()
    render(<AguilaInteractiva />)
    await usuario.click(screen.getByRole('button', { name: 'Águila Alpha' }))
    expect(animar).not.toHaveBeenCalled()
  })

  it('sin matchMedia, tocarla no revienta', async () => {
    // El aguila esta en el Splash y en el Login. Llamaba window.matchMedia(...)
    // a pelo, sin comprobar que existiera, asi que donde no existe el toque
    // lanzaba un TypeError en la pantalla de entrada.
    vi.stubGlobal('matchMedia', undefined)
    const usuario = userEvent.setup()
    render(<AguilaInteractiva />)
    await usuario.click(screen.getByRole('button', { name: 'Águila Alpha' }))
    expect(animar).toHaveBeenCalledTimes(1)
  })
})
