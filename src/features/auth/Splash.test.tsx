import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Splash } from './Splash'

afterEach(() => vi.useRealTimers())

describe('Splash', () => {
  it('presenta la marca y el lema', () => {
    render(<Splash onListo={() => {}} />)
    expect(screen.getByText('Alpha Athletics')).toBeInTheDocument()
    expect(screen.getByText('Forjado para rendir')).toBeInTheDocument()
  })

  it('pone el fondo del rack como decorativo y con medidas propias', () => {
    const { container } = render(<Splash onListo={() => {}} />)
    const fondo = container.querySelector('img')

    expect(fondo).not.toBeNull()
    expect(fondo).toHaveAttribute('src', '/fondos/ancla-rack-splash.jpg')
    // Decorativo: no aporta información, así que no debe anunciarse.
    expect(fondo).toHaveAttribute('alt', '')
    expect(fondo).toHaveAttribute('aria-hidden', 'true')
    // Con medidas la reserva de espacio evita el salto de maquetación.
    expect(fondo).toHaveAttribute('width', '1080')
    expect(fondo).toHaveAttribute('height', '1920')
  })

  it('contiene el fondo en vez de recortarlo, para no comerse la torre', () => {
    const { container } = render(<Splash onListo={() => {}} />)
    const fondo = container.querySelector('img')

    expect(fondo?.className).toContain('object-contain')
    expect(fondo?.className).not.toContain('object-cover')
  })

  it('se va sola a los 2,3 s', () => {
    vi.useFakeTimers()
    const listo = vi.fn()
    render(<Splash onListo={listo} />)
    expect(listo).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(2300))
    expect(listo).toHaveBeenCalledTimes(1)
  })

  it('se salta al tocar, sin esperar', async () => {
    const usuario = userEvent.setup()
    const listo = vi.fn()
    render(<Splash onListo={listo} />)
    await usuario.click(screen.getByRole('button', { name: 'Saltar la introducción' }))
    expect(listo).toHaveBeenCalledTimes(1)
  })

  it('tocar y luego cumplirse el tiempo no lo avisa dos veces', async () => {
    const usuario = userEvent.setup()
    const listo = vi.fn()
    const { unmount } = render(<Splash onListo={listo} />)
    await usuario.click(screen.getByRole('button', { name: 'Saltar la introducción' }))
    unmount()
    expect(listo).toHaveBeenCalledTimes(1)
  })
})
