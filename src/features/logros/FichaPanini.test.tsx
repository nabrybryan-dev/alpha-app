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

/**
 * jsdom no hace layout: `getBoundingClientRect` devuelve ceros, y el hook se
 * retira por su propia guarda en vez de dividir entre cero. Hay que darle caja.
 *
 * Antes esto no hacía falta y eso era el problema: la inclinación vivía dentro
 * del componente sin esa guarda, y con la caja a cero escribía
 * `rotateY(Infinity deg)`. El test decía «contiene rotate» y pasaba —sobre un
 * transform que ningún navegador puede pintar—.
 */
function conCaja(el: HTMLElement) {
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0 }) as DOMRect
}

/**
 * `fireEvent.pointerMove` no sirve: jsdom no implementa `PointerEvent`, así que
 * testing-library cae a un `Event` genérico y `clientX`/`clientY` se pierden por
 * el camino. Un `MouseEvent` con nombre `pointermove` sí las lleva.
 */
function mover(el: HTMLElement, x: number, y: number) {
  fireEvent(el, new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true }))
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
    conCaja(carta)
    // Esquina superior izquierda: inclina hacia arriba y hacia la izquierda, y
    // los grados son finitos. Comprobar solo que dice «rotate» dejaba pasar un
    // `Infinity`.
    mover(carta, 0, 0)
    expect(carta.style.transform).toBe('rotateX(12.00deg) rotateY(-12.00deg)')
  })

  it('con movimiento reducido no se inclina', () => {
    reducido = true
    declararMatchMedia()
    const { container } = render(<FichaPanini ficha={ficha} />)
    const carta = tarjeta(container)
    conCaja(carta)
    mover(carta, 10, 10)
    expect(carta.style.transform).toBe('')
  })

  it('al soltar vuelve a su sitio', () => {
    const { container } = render(<FichaPanini ficha={ficha} />)
    const carta = tarjeta(container)
    conCaja(carta)
    mover(carta, 10, 10)
    fireEvent.pointerLeave(carta)
    expect(carta.style.transform).toBe('rotateX(0deg) rotateY(0deg)')
  })

  it('sin matchMedia no revienta al mover el dedo', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { container } = render(<FichaPanini ficha={ficha} />)
    const carta = tarjeta(container)
    conCaja(carta)
    expect(() => mover(carta, 10, 10)).not.toThrow()
  })
})
