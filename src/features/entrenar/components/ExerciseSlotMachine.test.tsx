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

  /**
   * Antes las paradas sin dato salían con un «—». No era un detalle: de los 506
   * ejercicios activos, 272 no tienen contenido demo (medido el 2026-08-09), así
   * que en más de la mitad de la sesión el tambor paraba en un guion una de cada
   * cinco vueltas.
   */
  it('sin los campos nuevos no monta paradas vacías ni enseña guiones', () => {
    montar({ ejercicio: { nombre: 'Remo con barra' } })
    act(() => void vi.advanceTimersByTime(1000))
    const slot = screen.getByTestId('slot-ejercicio')
    expect(slot.dataset.parada).toBe('EJERCICIO')
    expect(screen.getByText('Remo con barra')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Ver / })).toHaveLength(1)
    expect(slot.textContent).not.toMatch(/undefined/)
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('un ejercicio sin contenido demo tiene cuatro paradas, no cinco con un hueco', () => {
    montar({ ejercicio: { ...ejercicio, referencia: undefined } })
    act(() => void vi.advanceTimersByTime(1000))
    expect(screen.getAllByRole('button', { name: /^Ver / })).toHaveLength(4)
    expect(screen.queryByRole('button', { name: /referencia visual/i })).not.toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  /**
   * La cabecera fija se redujo a número y rango. La categoría vivía también ahí
   * y se quitó: es una de las cinco paradas, y enseñarla fija le quitaba sentido
   * a que el tambor rotara hasta ella.
   */
  it('la línea fija es mínima: número y rango, sin la categoría', () => {
    montar()
    act(() => void vi.advanceTimersByTime(1000))
    expect(screen.getByText('Ejercicio 01 / 04')).toBeInTheDocument()
    expect(screen.getByText('Rango 8-12')).toBeInTheDocument()
    // La categoría solo aparece cuando el tambor para en ella.
    expect(screen.queryByText('Compuesto · Cadena posterior')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ver categoría/i }))
    act(() => void vi.advanceTimersByTime(1000))
    expect(screen.getByText('Compuesto · Cadena posterior')).toBeInTheDocument()
  })

  it('al desmontar no deja temporizadores vivos', () => {
    const { unmount } = montar({ activa: true })
    unmount()
    expect(() => act(() => void vi.advanceTimersByTime(4200 * 3))).not.toThrow()
  })
})

/**
 * La física del tambor.
 *
 * La primera versión no giraba: cambiaba el contenido con un fundido y aplicaba
 * la curva de rebote a la opacidad, donde el rebote no se percibe. Estos tests
 * fijan que la cinta se DESPLAZA, que pasa por símbolos entre dato y dato, y que
 * `reduced-motion` no recorre nada en vez de recorrerlo más despacio.
 */
describe('ExerciseSlotMachine · el tambor gira de verdad', () => {
  const slot = () => screen.getByTestId('slot-ejercicio')
  const cinta = () => slot().querySelector('[data-cinta]') as HTMLElement
  const girar = () => fireEvent.click(screen.getByRole('button', { name: /girar la información/i }))
  /** Deja pasar el giro de entrada, que arranca solo al montar. */
  const asentado = () => act(() => void vi.advanceTimersByTime(1000))

  it('en reposo la ventana monta UNA celda: el dato no se duplica en el DOM', () => {
    montar()
    asentado()
    expect(cinta().children).toHaveLength(1)
    expect(slot().dataset.pos).toBe('0')
  })

  it('la cinta se desplaza y da al menos una vuelta entera antes de parar', () => {
    montar()
    asentado()
    girar()
    act(() => void vi.advanceTimersByTime(100))
    // Diez celdas es la vuelta completa. El destino son dos celdas más allá,
    // así que sin la vuelta esto valdría 2 y no se leería como un tambor.
    expect(Number(slot().dataset.pos)).toBeGreaterThanOrEqual(10)
    expect(cinta().style.transform).toBe(`translateY(${-Number(slot().dataset.pos) * 104}px)`)
    act(() => void vi.advanceTimersByTime(2000))
    // Al asentar se normaliza: la parada 1 vive en la celda 2.
    expect(slot().dataset.pos).toBe('2')
    expect(cinta().children).toHaveLength(1)
  })

  it('entre parada y parada pasa un símbolo', () => {
    montar()
    asentado()
    girar()
    act(() => void vi.advanceTimersByTime(100))
    expect(cinta().textContent).toMatch(/[⚡★🔥✦]/u)
  })

  it('primero corre lineal y desenfocado, y frena con la curva de rebote', () => {
    montar()
    asentado()
    girar()

    act(() => void vi.advanceTimersByTime(100))
    expect(cinta().style.transition).toMatch(/linear/)
    expect(cinta().style.filter).toBe('blur(1.1px)')

    // A los 596 ms (16 de arranque + 580 de giro) empieza la frenada.
    act(() => void vi.advanceTimersByTime(600))
    expect(cinta().style.transition).toMatch(/cubic-bezier/)
    expect(cinta().style.filter).toBe('')
  })

  it('con reduced-motion la cinta no recorre nada: la parada cambia en el sitio', () => {
    mockMatchMedia(true)
    montar()
    fireEvent.click(screen.getByRole('button', { name: /nota técnica/i }))
    // Parada 3 → celda 6, sin pasar por ninguna intermedia.
    expect(slot().dataset.pos).toBe('6')
    expect(cinta().children).toHaveLength(1)
    expect(cinta().style.transition).toBe('none')
    expect(cinta().style.filter).toBe('')
  })

  /**
   * Tocar un punto justo antes de un tic automático te arrancaba de la parada
   * que acababas de pedir. El reloj del auto-giro se reinicia con cada gesto.
   */
  it('un gesto de la persona devuelve a cero el reloj del giro automático', () => {
    montar({ activa: true })
    asentado()
    // Casi se cumple el ciclo automático…
    act(() => void vi.advanceTimersByTime(4000))
    fireEvent.click(screen.getByRole('button', { name: /ver nota técnica/i }))
    act(() => void vi.advanceTimersByTime(1000))
    expect(slot().dataset.parada).toBe('NOTA TÉCNICA')
    // …y los 200 ms que le faltaban al tic viejo ya no se la llevan.
    act(() => void vi.advanceTimersByTime(1000))
    expect(slot().dataset.parada).toBe('NOTA TÉCNICA')
  })

  it('mientras gira, la cinta sale del árbol de accesibilidad', () => {
    montar()
    asentado()
    expect(cinta().getAttribute('aria-hidden')).toBe('false')
    girar()
    act(() => void vi.advanceTimersByTime(100))
    expect(cinta().getAttribute('aria-hidden')).toBe('true')
    act(() => void vi.advanceTimersByTime(2000))
    expect(cinta().getAttribute('aria-hidden')).toBe('false')
  })

  it('tocar otro punto a mitad de giro abandona el giro anterior, no lo encadena', () => {
    montar()
    asentado()
    girar()
    act(() => void vi.advanceTimersByTime(200))
    fireEvent.click(screen.getByRole('button', { name: /referencia visual/i }))
    act(() => void vi.advanceTimersByTime(2000))
    // Manda el último destino, y la cinta queda en reposo en su celda.
    expect(slot().dataset.parada).toBe('REFERENCIA VISUAL')
    expect(slot().dataset.pos).toBe('8')
    expect(slot().dataset.girando).toBe('no')
  })
})
