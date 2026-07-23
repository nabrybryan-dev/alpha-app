import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DescansoTimer } from './DescansoTimer'

// Reloj fijo para que `Date.now()` sea determinista (el timer cuenta contra un
// timestamp `hasta`, no contra ticks acumulados).
const BASE = new Date('2026-01-01T00:00:00Z').getTime()

function avanzar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('DescansoTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('muestra la cuenta regresiva y descuenta con el tiempo', () => {
    render(<DescansoTimer hasta={BASE + 120_000} totalSeg={120} onCerrar={vi.fn()} onMas15={vi.fn()} />)
    expect(screen.getByText('2:00')).toBeInTheDocument()
    avanzar(10_000)
    expect(screen.getByText('1:50')).toBeInTheDocument()
  })

  it('en pausa congela el conteo y muestra la señal "en pausa"', () => {
    render(<DescansoTimer hasta={BASE + 120_000} totalSeg={120} onCerrar={vi.fn()} onMas15={vi.fn()} />)
    avanzar(20_000)
    expect(screen.getByText('1:40')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Pausar descanso' }))
    expect(screen.getByText('Descanso · en pausa')).toBeInTheDocument()

    avanzar(30_000) // en pausa NO debe descontar
    expect(screen.getByText('1:40')).toBeInTheDocument()
  })

  it('al reanudar, el tiempo pausado no se descuenta del descanso', () => {
    render(<DescansoTimer hasta={BASE + 120_000} totalSeg={120} onCerrar={vi.fn()} onMas15={vi.fn()} />)
    avanzar(20_000) // 1:40
    fireEvent.click(screen.getByRole('button', { name: 'Pausar descanso' }))
    avanzar(30_000) // 30 s en pausa (deben ignorarse)
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar descanso' }))
    avanzar(15_000) // 15 s corriendo

    // 20 + 15 = 35 s efectivos → 120 - 35 = 85 s → "1:25".
    // Sin la compensación de pausa serían 65 s corridos → "0:55".
    expect(screen.getByText('1:25')).toBeInTheDocument()
  })

  it('+15s y Saltar disparan sus callbacks (Saltar, una sola vez)', () => {
    const onMas15 = vi.fn()
    const onCerrar = vi.fn()
    render(<DescansoTimer hasta={BASE + 120_000} totalSeg={120} onCerrar={onCerrar} onMas15={onMas15} />)

    fireEvent.click(screen.getByRole('button', { name: '+15s' }))
    expect(onMas15).toHaveBeenCalledTimes(1)

    const saltar = screen.getByRole('button', { name: 'Saltar' })
    fireEvent.click(saltar)
    fireEvent.click(saltar) // el guardado `cerrado` evita el doble cierre
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })

  it('al llegar a cero muestra el letrero y luego se cierra solo', () => {
    const onCerrar = vi.fn()
    render(<DescansoTimer hasta={BASE + 3_000} totalSeg={3} onCerrar={onCerrar} onMas15={vi.fn()} />)
    avanzar(3_100) // llega a 0 → letrero "¡DALE!"
    expect(screen.getByText(/DALE/)).toBeInTheDocument()
    avanzar(2_640) // el letrero sale y cierra
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })
})
