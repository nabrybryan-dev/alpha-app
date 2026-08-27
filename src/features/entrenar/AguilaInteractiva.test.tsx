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

  // Este test decia `expect(animar).not.toHaveBeenCalled()`, o sea que con la
  // preferencia activa el toque no hacia NADA. La intencion era buena —que no gire—
  // pero estaba escrita como «cero», y cero es justo lo que no se puede hacer: el
  // `.press` que envuelve al aguila tambien queda anulado por la preferencia, asi
  // que no quedaba ni una sola senal y el elemento sigue anunciandose como boton.
  // Ahora se comprueba la regla de verdad, que es mas estricta que la anterior y
  // muerde por los dos lados: tiene que haber acuse, y ese acuse NO puede mover ni
  // rotar ni escalar nada.
  it('con movimiento reducido acusa el toque, pero no gira ni escala', async () => {
    reducido = true
    declararMatchMedia()
    const usuario = userEvent.setup()
    render(<AguilaInteractiva />)
    await usuario.click(screen.getByRole('button', { name: 'Águila Alpha' }))

    expect(animar).toHaveBeenCalledTimes(1)
    const [fotogramas] = animar.mock.calls[0] as [Array<Record<string, unknown>>]
    // Ni una sola propiedad de movimiento: ni transform, ni rotate, ni scale.
    for (const f of fotogramas) {
      expect(f.transform).toBeUndefined()
      expect(f.rotate).toBeUndefined()
      expect(f.scale).toBeUndefined()
    }
    // Y si algo que se pueda ver: la opacidad, que es lo que la norma de
    // accesibilidad manda conservar cuando se quita el movimiento.
    expect(fotogramas.some((f) => f.opacity !== undefined)).toBe(true)
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
