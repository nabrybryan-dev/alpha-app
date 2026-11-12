import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Foco } from './Foco'

function declararReducido(reducido: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: reducido && consulta.includes('prefers-reduced-motion'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => vi.unstubAllGlobals())

const RECT = { x: 16, y: 120, ancho: 358, alto: 96 }

describe('Foco', () => {
  it('dibuja el rectángulo que le dan, con borde rojo', () => {
    declararReducido(false)
    const { container } = render(<Foco rect={RECT} />)
    const aro = container.firstElementChild as HTMLElement
    expect(aro.style.left).toBe('16px')
    expect(aro.style.top).toBe('120px')
    expect(aro.style.width).toBe('358px')
    expect(aro.style.height).toBe('96px')
    expect(aro.style.border).toContain('var(--rojo)')
    expect(aro.dataset.foco).toBe('on')
  })

  it('no atrapa toques ni con velo ni apagado, y se oculta a los lectores', () => {
    declararReducido(false)
    for (const rect of [RECT, null]) {
      const { container, unmount } = render(<Foco rect={rect} velo />)
      const aro = container.firstElementChild as HTMLElement
      expect(aro.style.pointerEvents).toBe('none')
      expect(aro).toHaveAttribute('aria-hidden', 'true')
      unmount()
    }
  })

  it('el velo de 3000 px solo está si se pide', () => {
    declararReducido(false)
    const con = render(<Foco rect={RECT} velo />).container.firstElementChild as HTMLElement
    expect(con.style.boxShadow).toContain('3000px')
    const sin = render(<Foco rect={RECT} velo={false} />).container.firstElementChild as HTMLElement
    expect(sin.style.boxShadow).toBe('')
  })

  it('apagado (rect null) queda invisible', () => {
    declararReducido(false)
    const { container } = render(<Foco rect={null} />)
    const aro = container.firstElementChild as HTMLElement
    expect(aro.dataset.foco).toBe('off')
    expect(aro.style.opacity).toBe('0')
    expect(aro.style.visibility).toBe('hidden')
  })

  it('se desliza con movimiento normal', () => {
    declararReducido(false)
    const aro = render(<Foco rect={RECT} />).container.firstElementChild as HTMLElement
    expect(aro.style.transition).toContain('left')
  })

  it('con movimiento reducido salta sin transición', () => {
    declararReducido(true)
    const aro = render(<Foco rect={RECT} />).container.firstElementChild as HTMLElement
    expect(aro.style.transition).toBe('none')
  })
})
