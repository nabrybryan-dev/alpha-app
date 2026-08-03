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
