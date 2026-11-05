import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MiniBarra, MiniBarras } from './MiniBarras'

function declararReducido(reducido: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: reducido && consulta.includes('prefers-reduced-motion'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const barras = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('i'))

describe('MiniBarras', () => {
  it('nacen a cero y crecen tras el primer fotograma', () => {
    declararReducido(false)
    const { container } = render(<MiniBarras valores={[0.4, 0.8]} etiqueta="2 ejercicios" />)
    expect(barras(container).every((b) => b.style.transform === 'scaleY(0)')).toBe(true)
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(barras(container).every((b) => b.style.transform === 'scaleY(1)')).toBe(true)
  })

  it('escalona: cada barra espera 80 ms mas que la anterior', () => {
    declararReducido(false)
    const { container } = render(<MiniBarras valores={[0.4, 0.5, 0.6]} etiqueta="3" />)
    const t = barras(container).map((b) => b.style.transition)
    expect(t[0]).toContain(' 0ms')
    expect(t[1]).toContain(' 80ms')
    expect(t[2]).toContain(' 160ms')
  })

  it('con movimiento reducido salen ya crecidas y sin transicion', () => {
    declararReducido(true)
    const { container } = render(<MiniBarras valores={[0.4, 0.8]} etiqueta="2" />)
    for (const b of barras(container)) {
      expect(b.style.transform).toBe('scaleY(1)')
      expect(b.style.transition).toBe('none')
    }
  })

  it('la altura sale del dato, acotada entre el minimo y 100 %', () => {
    declararReducido(true)
    const { container } = render(<MiniBarras valores={[0.5, 3, -2, Number.NaN]} etiqueta="x" />)
    expect(barras(container).map((b) => b.style.height)).toEqual(['50%', '100%', '6%', '6%'])
  })

  it('sin dato es un trazo distinto, no una barra roja a cero', () => {
    declararReducido(true)
    const { container } = render(<MiniBarras valores={[undefined, 0.5]} etiqueta="x" />)
    const [sin, con] = barras(container)
    expect(sin.dataset.barra).toBe('sin-dato')
    expect(sin.style.background).toContain('--linea')
    expect(con.dataset.barra).toBe('dato')
    expect(con.style.background).toContain('--rojo')
  })

  it('el lector oye la etiqueta y las barras van ocultas', () => {
    declararReducido(true)
    const { container } = render(<MiniBarras valores={[0.4]} etiqueta="1 ejercicio" />)
    expect(screen.getByText('1 ejercicio')).toBeInTheDocument()
    expect(container.querySelector('[data-minibarras]')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('MiniBarra', () => {
  it('se llena a su proporcion y sin dato queda vacia', () => {
    declararReducido(true)
    const a = render(<MiniBarra valor={0.6} etiqueta="60 %" />).container.querySelector('i')!
    expect(a.style.width).toBe('60%')
    const b = render(<MiniBarra valor={undefined} etiqueta="sin dato" />).container.querySelector('i')!
    expect(b.style.width).toBe('0%')
    expect(b.dataset.barra).toBe('sin-dato')
  })

  it('con movimiento reducido no anima', () => {
    declararReducido(true)
    const i = render(<MiniBarra valor={1} etiqueta="100 %" />).container.querySelector('i')!
    expect(i.style.transition).toBe('none')
    expect(i.style.transform).toBe('scaleX(1)')
  })
})
