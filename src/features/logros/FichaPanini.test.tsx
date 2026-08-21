import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FichaPanini } from './FichaPanini'
import type { AsesoradoDestacado } from '../../data/contenido/asesoradosDestacados'

let reducido = false

function declararMatchMedia() {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: reducido && consulta.includes('prefers-reduced-motion'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

/** Ficha inventada: los datos reales de asesorados no entran en los tests. */
const ficha: AsesoradoDestacado = {
  id: 'prueba',
  nombre: 'Persona De Prueba',
  rol: 'Rol de prueba',
  superpoder: 'Constancia',
  historia: 'Historia de prueba.',
  frase: 'Frase de prueba.',
}

/** La tarjeta que se inclina es la que lleva la clase `ficha-3d`. */
function tarjeta(container: HTMLElement) {
  return container.querySelector('.ficha-3d') as HTMLElement
}

beforeEach(() => {
  reducido = false
  declararMatchMedia()
})

afterEach(() => vi.unstubAllGlobals())

describe('FichaPanini', () => {
  it('muestra el superpoder como rareza de la carta', () => {
    render(<FichaPanini ficha={ficha} />)
    expect(screen.getByText('Constancia')).toBeInTheDocument()
  })

  it('se inclina siguiendo el dedo', () => {
    const { container } = render(<FichaPanini ficha={ficha} />)
    const carta = tarjeta(container)
    fireEvent.pointerMove(carta, { clientX: 10, clientY: 10 })
    expect(carta.style.transform).toContain('rotate')
  })

  it('con movimiento reducido no se inclina', () => {
    reducido = true
    declararMatchMedia()
    const { container } = render(<FichaPanini ficha={ficha} />)
    const carta = tarjeta(container)
    fireEvent.pointerMove(carta, { clientX: 10, clientY: 10 })
    expect(carta.style.transform).toBe('')
  })

  it('al soltar vuelve a su sitio', () => {
    const { container } = render(<FichaPanini ficha={ficha} />)
    const carta = tarjeta(container)
    fireEvent.pointerMove(carta, { clientX: 10, clientY: 10 })
    fireEvent.pointerLeave(carta)
    expect(carta.style.transform).toBe('rotateX(0deg) rotateY(0deg)')
  })

  it('sin matchMedia no revienta al mover el dedo', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { container } = render(<FichaPanini ficha={ficha} />)
    const carta = tarjeta(container)
    expect(() => fireEvent.pointerMove(carta, { clientX: 10, clientY: 10 })).not.toThrow()
  })
})
