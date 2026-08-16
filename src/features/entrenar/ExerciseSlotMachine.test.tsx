import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExerciseSlotMachine } from './ExerciseSlotMachine'

/** `matchMedia` no existe en jsdom: se declara con el valor que pida el test. */
function conMovimientoReducido(reducido: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: reducido && consulta.includes('prefers-reduced-motion'),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const BASE = {
  index: 0,
  total: 4,
  nombre: 'Peso muerto rumano',
  patron: 'Bisagra de cadera',
  clase: 'Compuesto · Cadena posterior',
  tecnica: 'Excéntrico 3 s · cadera atrás',
  categoria: 'BISAGRA DE CADERA',
  rango: '8-12',
}

describe('ExerciseSlotMachine', () => {
  beforeEach(() => {
    conMovimientoReducido(false)
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('muestra el nombre del ejercicio', () => {
    render(<ExerciseSlotMachine {...BASE} autoSpin={false} />)
    expect(screen.getAllByText('Peso muerto rumano').length).toBeGreaterThan(0)
  })

  /**
   * El nombre completo tiene que estar SIEMPRE en el árbol de accesibilidad,
   * aunque el tambor esté parado en otro dato. La máquina es decorativa en su
   * movimiento, nunca en su información.
   */
  it('deja el nombre accesible aunque el tambor gire a otra parada', () => {
    render(<ExerciseSlotMachine {...BASE} autoSpin={false} />)
    const paginador = screen.getByRole('button', { name: /ver nota técnica/i })
    act(() => {
      paginador.click()
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getAllByText('Peso muerto rumano').length).toBeGreaterThan(0)
  })

  it('la palanca cambia de parada', () => {
    render(<ExerciseSlotMachine {...BASE} autoSpin={false} />)
    const palanca = screen.getByRole('button', { name: /girar información del ejercicio/i })
    expect(screen.getByRole('button', { name: /ver ejercicio/i })).toHaveAttribute('aria-current', 'true')
    act(() => {
      palanca.click()
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: /ver patrón de movimiento/i })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('con prefers-reduced-motion no gira solo', () => {
    conMovimientoReducido(true)
    render(<ExerciseSlotMachine {...BASE} />)
    const antes = screen.getByRole('button', { name: /ver ejercicio/i }).getAttribute('aria-current')
    act(() => {
      vi.advanceTimersByTime(15000)
    })
    expect(screen.getByRole('button', { name: /ver ejercicio/i }).getAttribute('aria-current')).toBe(antes)
  })

  /** Sin patrón, sin clase, sin técnica y sin referencia: una sola parada. */
  it('no se rompe con los datos opcionales ausentes', () => {
    render(
      <ExerciseSlotMachine
        index={2}
        total={4}
        nombre="Sentadilla"
        categoria="SENTADILLA"
        rango="6-8"
        autoSpin={false}
      />,
    )
    expect(screen.getAllByText('Sentadilla').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /^ver /i })).toHaveLength(1)
  })

  it('numera el ejercicio con dos cifras', () => {
    render(<ExerciseSlotMachine {...BASE} index={2} total={4} autoSpin={false} />)
    expect(screen.getByText(/Ejercicio 03 \/ 04/)).toBeInTheDocument()
  })
})
