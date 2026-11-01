import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PortadaDelCuerpo, type PortadaDelCuerpoProps } from './PortadaDelCuerpo'

function props(sobre: Partial<PortadaDelCuerpoProps> = {}): PortadaDelCuerpoProps {
  return {
    vista: 'cuerpo', capa: 'musculo', rango: 'hoy', series: {}, doloridas: [], guia: 'indice',
    alCambiarCapa: vi.fn(), alCambiarRango: vi.fn(), alCambiarVista: vi.fn(),
    ...sobre,
  }
}

describe('«Dar la vuelta» en la vista de la guía', () => {
  it('de frente: el nombre dice qué se ve y, al tocar, pide la espalda', () => {
    const alDarLaVuelta = vi.fn()
    render(<PortadaDelCuerpo {...props({ azimutDelCuerpo: 0, alDarLaVuelta })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dar la vuelta: ahora se ve el frente, pasa a la espalda' }))
    expect(alDarLaVuelta).toHaveBeenCalledWith(180)
  })
  it('de espalda: el nombre cambia y pide el frente', () => {
    const alDarLaVuelta = vi.fn()
    render(<PortadaDelCuerpo {...props({ azimutDelCuerpo: 170, alDarLaVuelta })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dar la vuelta: ahora se ve la espalda, pasa al frente' }))
    expect(alDarLaVuelta).toHaveBeenCalledWith(0)
  })
  it('sin el movimiento (vista de movimiento) o sin mando no hay botón', () => {
    render(<PortadaDelCuerpo {...props({ vista: 'movimiento', azimutDelCuerpo: 0, alDarLaVuelta: vi.fn() })} />)
    expect(screen.queryByRole('button', { name: /Dar la vuelta/ })).toBeNull()
  })
})
