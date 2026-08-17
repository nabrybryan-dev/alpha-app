import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Revelar } from './Revelar'

let reducido = false

function declararMatchMedia() {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: reducido && consulta.includes('prefers-reduced-motion'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

/** IntersectionObserver tampoco existe en jsdom: se declara sin disparar nada. */
function declararObserver() {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
}

beforeEach(() => {
  reducido = false
  declararMatchMedia()
  declararObserver()
})

afterEach(() => vi.unstubAllGlobals())

describe('Revelar', () => {
  it('empieza oculto y espera a entrar al viewport', () => {
    const { container } = render(<Revelar>hola</Revelar>)
    expect(container.firstElementChild?.className).not.toContain('revelado')
  })

  it('con movimiento reducido el contenido sale ya revelado', () => {
    // Sin esto habria un parpadeo: oculto primero y visible de golpe, que es
    // justo el movimiento que la persona pidio no ver.
    reducido = true
    declararMatchMedia()
    const { container } = render(<Revelar>hola</Revelar>)
    expect(container.firstElementChild?.className).toContain('revelado')
  })

  it('sin IntersectionObserver revela de inmediato, no deja el contenido escondido', () => {
    // Se BORRA la propiedad, no se pone a undefined. `Revelar` pregunta con
    // `'IntersectionObserver' in window`, y un stub a undefined deja la
    // propiedad definida: la guarda pasaria y reventaria el constructor. Eso
    // seria un fallo del test, no del componente.
    const original = Reflect.getOwnPropertyDescriptor(window, 'IntersectionObserver')
    Reflect.deleteProperty(window, 'IntersectionObserver')
    try {
      const { container } = render(<Revelar>hola</Revelar>)
      expect(container.firstElementChild?.className).toContain('revelado')
    } finally {
      if (original) Reflect.defineProperty(window, 'IntersectionObserver', original)
    }
  })

  it('aplica el retraso para escalonar listas', () => {
    const { container } = render(<Revelar retrasoMs={120}>hola</Revelar>)
    expect((container.firstElementChild as HTMLElement).style.transitionDelay).toBe('120ms')
  })
})
