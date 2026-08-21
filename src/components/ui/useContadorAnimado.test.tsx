import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useContadorAnimado } from './useContadorAnimado'

let reducido = false

function declararMatchMedia() {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: reducido && consulta.includes('prefers-reduced-motion'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function Sonda({ objetivo }: { objetivo: number }) {
  return <span data-testid="v">{Math.round(useContadorAnimado(objetivo))}</span>
}

beforeEach(() => {
  reducido = false
  declararMatchMedia()
})

afterEach(() => vi.unstubAllGlobals())

describe('useContadorAnimado', () => {
  it('con movimiento reducido devuelve el objetivo desde el primer render', () => {
    // No cuenta ni pasa por cero: la cifra ya esta puesta cuando aparece.
    reducido = true
    declararMatchMedia()
    const { getByTestId } = render(<Sonda objetivo={42} />)
    expect(getByTestId('v').textContent).toBe('42')
  })

  it('sin movimiento reducido arranca en cero para poder contar hasta el objetivo', () => {
    const { getByTestId } = render(<Sonda objetivo={42} />)
    expect(getByTestId('v').textContent).toBe('0')
  })

  it('con movimiento reducido sigue al objetivo cuando cambia', () => {
    reducido = true
    declararMatchMedia()
    const { getByTestId, rerender } = render(<Sonda objetivo={10} />)
    expect(getByTestId('v').textContent).toBe('10')
    rerender(<Sonda objetivo={99} />)
    expect(getByTestId('v').textContent).toBe('99')
  })
})
