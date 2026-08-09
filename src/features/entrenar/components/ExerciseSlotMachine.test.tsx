/**
 * La tragamonedas de la cabecera del ejercicio.
 *
 * Lo que estos tests protegen: que la información del ejercicio SIEMPRE se pueda
 * leer —el gabinete es decoración, el dato no—, que `prefers-reduced-motion`
 * apague el giro de verdad y no solo el desenfoque, y que el auto-giro no siga
 * corriendo cuando la sesión terminó ni después de desmontar.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExerciseSlotMachine, type DatosSlotEjercicio } from './ExerciseSlotMachine'

const ejercicio: DatosSlotEjercicio = {
  nombre: 'Peso muerto rumano con mancuernas',
  patron: 'Bisagra de cadera',
  categoria: 'Compuesto · Cadena posterior',
  tecnica: 'Excéntrico 3 s · cadera atrás',
  referencia: 'Video · vista lateral 45°',
}

let reducido = false

function mockMatchMedia(valor: boolean) {
  reducido = valor
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reducido,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  })
}

function montar(props: Partial<Parameters<typeof ExerciseSlotMachine>[0]> = {}) {
  return render(
    <ExerciseSlotMachine
      ejercicio={ejercicio}
      indice={1}
      total={4}
      rango="(8-12)"
      {...props}
    />,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  mockMatchMedia(false)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ExerciseSlotMachine', () => {
  it('muestra el contador de ejercicio con dos dígitos y el rango sin paréntesis', () => {
    montar()
    expect(screen.getByText('Ejercicio 01 / 04')).toBeInTheDocument()
    expect(screen.getByText('Rango 8-12')).toBeInTheDocument()
  })

  it('la primera parada es el nombre del ejercicio', () => {
    montar()
    act(() => void vi.advanceTimersByTime(1000))
    expect(screen.getByText('Peso muerto rumano con mancuernas')).toBeInTheDocument()
  })

  it('el paginador tiene una parada por dato: cinco', () => {
    montar()
    expect(screen.getAllByRole('button', { name: /^Ver / })).toHaveLength(5)
  })

  it('tocar un punto lleva a esa parada', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /nota técnica/i }))
    act(() => void vi.advanceTimersByTime(1000))
    expect(screen.getByText('Excéntrico 3 s · cadera atrás')).toBeInTheDocument()
  })

  it('la palanca avanza a la parada siguiente', () => {
    montar()
    act(() => void vi.advanceTimersByTime(1000))
    fireEvent.click(screen.getByRole('button', { name: /girar la información/i }))
    act(() => void vi.advanceTimersByTime(1000))
    expect(screen.getByText('Bisagra de cadera')).toBeInTheDocument()
  })

  it('gira solo cada 4,2 s mientras la sesión está activa', () => {
    montar({ activa: true })
    act(() => void vi.advanceTimersByTime(1000))
    expect(screen.getByText('Peso muerto rumano con mancuernas')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(4200 + 1000))
    expect(screen.getByText('Bisagra de cadera')).toBeInTheDocument()
  })

  it('con la sesión terminada NO gira solo: la celebración manda', () => {
    montar({ activa: false })
    act(() => void vi.advanceTimersByTime(1000))
    const antes = screen.getByTestId('slot-ejercicio').dataset.parada
    act(() => void vi.advanceTimersByTime(4200 * 3))
    expect(screen.getByTestId('slot-ejercicio').dataset.parada).toBe(antes)
  })

  it('con prefers-reduced-motion no gira solo ni desenfoca', () => {
    mockMatchMedia(true)
    montar({ activa: true })
    expect(screen.getByTestId('slot-ejercicio').dataset.reducido).toBe('si')
    act(() => void vi.advanceTimersByTime(4200 * 2))
    expect(screen.getByTestId('slot-ejercicio').dataset.girando).toBe('no')
    expect(screen.getByText('Peso muerto rumano con mancuernas')).toBeInTheDocument()
  })

  it('con reduced-motion el paginador SIGUE funcionando, sin giro', () => {
    mockMatchMedia(true)
    montar()
    fireEvent.click(screen.getByRole('button', { name: /referencia visual/i }))
    expect(screen.getByText('Video · vista lateral 45°')).toBeInTheDocument()
    expect(screen.getByTestId('slot-ejercicio').dataset.girando).toBe('no')
  })

  // El reset al cambiar de ejercicio se consigue con `key` en el padre —no con
  // un efecto—, así que aquí se reproduce el remontaje tal cual lo hace
  // TarjetaEjercicio.
  it('al cambiar de ejercicio (remontaje por key) vuelve a la primera parada', () => {
    const { rerender } = render(
      <ExerciseSlotMachine key="a" ejercicio={ejercicio} indice={1} total={4} rango="(8-12)" />,
    )
    fireEvent.click(screen.getByRole('button', { name: /nota técnica/i }))
    act(() => void vi.advanceTimersByTime(1000))
    rerender(
      <ExerciseSlotMachine
        key="b"
        ejercicio={{ ...ejercicio, nombre: 'Sentadilla en Smith' }}
        indice={2}
        total={4}
        rango="(6-8)"
      />,
    )
    act(() => void vi.advanceTimersByTime(1000))
    expect(screen.getByText('Sentadilla en Smith')).toBeInTheDocument()
    expect(screen.getByTestId('slot-ejercicio').dataset.parada).toBe('EJERCICIO')
  })

  it('sin los campos nuevos no rompe: muestra guion en lugar de undefined', () => {
    montar({ ejercicio: { nombre: 'Remo con barra' } })
    fireEvent.click(screen.getByRole('button', { name: /patrón de movimiento/i }))
    act(() => void vi.advanceTimersByTime(1000))
    // Hay dos guiones: la categoría de la línea superior y el valor del tambor.
    // El que importa es el del tambor, y nunca puede decir «undefined».
    const slot = screen.getByTestId('slot-ejercicio')
    expect(slot.dataset.parada).toBe('PATRÓN DE MOVIMIENTO')
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(slot.textContent).not.toMatch(/undefined/)
  })

  it('al desmontar no deja temporizadores vivos', () => {
    const { unmount } = montar({ activa: true })
    unmount()
    expect(() => act(() => void vi.advanceTimersByTime(4200 * 3))).not.toThrow()
  })
})
