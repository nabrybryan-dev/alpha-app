import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExerciseSlotMachine } from './ExerciseSlotMachine'
import { THEMES, temaDeEjercicio } from './slotThemes'

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
  total: 5,
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
    render(<ExerciseSlotMachine {...BASE} />)
    expect(screen.getAllByText('Peso muerto rumano').length).toBeGreaterThan(0)
  })

  /**
   * El nombre completo tiene que estar SIEMPRE en el árbol de accesibilidad,
   * aunque el tambor esté parado en otro dato. La máquina es decorativa en su
   * movimiento, nunca en su información.
   */
  it('deja el nombre accesible aunque el tambor gire a otra parada', () => {
    render(<ExerciseSlotMachine {...BASE} />)
    act(() => {
      screen.getByRole('button', { name: /ver nota técnica/i }).click()
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getAllByText('Peso muerto rumano').length).toBeGreaterThan(0)
  })

  it('la palanca cambia de parada', () => {
    render(<ExerciseSlotMachine {...BASE} />)
    expect(screen.getByRole('button', { name: /ver ejercicio/i })).toHaveAttribute('aria-current', 'true')
    act(() => {
      screen.getByRole('button', { name: /girar información del ejercicio/i }).click()
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByRole('button', { name: /ver patrón/i })).toHaveAttribute('aria-current', 'true')
  })

  /** Cada ejercicio monta la máquina que le toca, y ciclan cada cinco. */
  describe('asignación de máquina', () => {
    it.each([
      [0, 'LIBERTY BELL'],
      [1, 'FRUIT MACHINE'],
      [2, 'SEVENS & BARS'],
      [3, 'DIAMOND SALON'],
      [4, 'CASH BONANZA'],
    ])('el ejercicio %i monta %s', (index, nombreMaquina) => {
      render(<ExerciseSlotMachine {...BASE} index={index} />)
      expect(screen.getByText(nombreMaquina)).toBeInTheDocument()
    })

    it('el sexto ejercicio vuelve a la primera máquina', () => {
      expect(temaDeEjercicio(5).nombre).toBe('LIBERTY BELL')
      expect(temaDeEjercicio(9).nombre).toBe('CASH BONANZA')
    })

    it('las cinco se distinguen: ni fuente, ni acento, ni cadencia se repiten', () => {
      expect(new Set(THEMES.map((t) => t.fuente)).size).toBe(5)
      expect(new Set(THEMES.map((t) => t.acento)).size).toBe(5)
      expect(new Set(THEMES.map((t) => t.step)).size).toBe(5)
      expect(new Set(THEMES.map((t) => t.marquesina)).size).toBeGreaterThan(1)
    })
  })

  it('con prefers-reduced-motion no hay blur ni escalonado', () => {
    conMovimientoReducido(true)
    const { container } = render(<ExerciseSlotMachine {...BASE} />)
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(container.innerHTML).not.toContain('blur(')
    // El gabinete conserva su estética: solo se apaga el movimiento.
    expect(screen.getByText('LIBERTY BELL')).toBeInTheDocument()
  })

  it('no gira solo: el reloj está anulado por defecto', () => {
    render(<ExerciseSlotMachine {...BASE} />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    const antes = screen.getByRole('button', { name: /ver ejercicio/i }).getAttribute('aria-current')
    act(() => {
      vi.advanceTimersByTime(20000)
    })
    expect(screen.getByRole('button', { name: /ver ejercicio/i }).getAttribute('aria-current')).toBe(antes)
  })

  it('cada punto del paginador tiene 44px de área táctil', () => {
    render(<ExerciseSlotMachine {...BASE} />)
    const punto = screen.getByRole('button', { name: /ver patrón/i })
    expect(punto.style.width).toBe('44px')
    expect(punto.style.height).toBe('44px')
  })

  it('no se rompe con los datos opcionales ausentes', () => {
    render(<ExerciseSlotMachine index={2} total={5} nombre="Sentadilla" categoria="SENTADILLA" rango="6-8" />)
    expect(screen.getAllByText('Sentadilla').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /^ver /i })).toHaveLength(1)
  })

  it('numera el ejercicio con dos cifras', () => {
    render(<ExerciseSlotMachine {...BASE} index={2} total={5} />)
    expect(screen.getByText(/Ejercicio 03 \/ 05/)).toBeInTheDocument()
  })
})
