import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PortadaDelCuerpo, type PortadaDelCuerpoProps } from './PortadaDelCuerpo'

function props(sobre: Partial<PortadaDelCuerpoProps> = {}): PortadaDelCuerpoProps {
  return {
    vista: 'cuerpo',
    capa: 'musculo',
    rango: 'hoy',
    series: { dors: 2, bic: 1, trap: 1 },
    doloridas: [],
    alCambiarCapa: vi.fn(),
    alCambiarRango: vi.fn(),
    alCambiarVista: vi.fn(),
    ...sobre,
  }
}

describe('la portada del cuerpo: capas, lectura y dolor', () => {
  it('las tres capas, con la elegida marcada, y tocar una la cambia', () => {
    const p = props()
    render(<PortadaDelCuerpo {...p} />)
    const grupo = screen.getByRole('radiogroup', { name: 'Capas del cuerpo' })
    const botones = within(grupo).getAllByRole('radio')
    expect(botones.map((b) => b.textContent)).toEqual(['Piel', 'Músculo', 'Hueso'])
    expect(within(grupo).getByRole('radio', { name: 'Músculo' })).toBeChecked()
    fireEvent.click(within(grupo).getByRole('radio', { name: 'Hueso' }))
    expect(p.alCambiarCapa).toHaveBeenCalledWith('hueso')
  })

  it('la lectura nombra las series anotadas y avisa de que no cuenta el estimulo', () => {
    render(<PortadaDelCuerpo {...props()} />)
    expect(screen.getByText('Dorsal 2 · Bíceps 1 · Trapecio 1')).toBeInTheDocument()
    expect(screen.getByText(/series hoy · cuenta series anotadas, no el estímulo/)).toBeInTheDocument()
  })

  it('con rango semana lo dice, y Hoy/Semana se cambia con un toque', () => {
    const p = props({ rango: 'semana' })
    render(<PortadaDelCuerpo {...p} />)
    expect(screen.getByText(/series de la semana · cuenta series anotadas/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Hoy' }))
    expect(p.alCambiarRango).toHaveBeenCalledWith('hoy')
  })

  it('sin series dice que no hay nada anotado, sin inventar', () => {
    render(<PortadaDelCuerpo {...props({ series: {} })} />)
    expect(screen.getByText('Aún no hay series anotadas')).toBeInTheDocument()
  })

  it('el dolor sale en su propia linea y en rojo, con el nombre de la region', () => {
    render(<PortadaDelCuerpo {...props({ doloridas: ['delt'] })} />)
    const linea = screen.getByText(/Te duele: Deltoides/)
    expect(linea.getAttribute('style') ?? '').toContain('var(--rojo)')
  })

  it('sin dolor no hay linea de dolor', () => {
    render(<PortadaDelCuerpo {...props()} />)
    expect(screen.queryByText(/Te duele/)).toBeNull()
  })

  it('el boton cambia entre el cuerpo y el movimiento (la escena vieja sigue ahi)', () => {
    const p = props()
    render(<PortadaDelCuerpo {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver el movimiento' }))
    expect(p.alCambiarVista).toHaveBeenCalledWith('movimiento')
  })

  it('en la vista de movimiento solo queda el boton de volver al cuerpo: ni capas ni lectura', () => {
    const p = props({ vista: 'movimiento' })
    render(<PortadaDelCuerpo {...p} />)
    expect(screen.queryByRole('radiogroup', { name: 'Capas del cuerpo' })).toBeNull()
    expect(screen.queryByText(/cuenta series anotadas/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver el cuerpo' }))
    expect(p.alCambiarVista).toHaveBeenCalledWith('cuerpo')
  })

  it('la hoja de detalle lista las 15 regiones con sus series y marca la que duele', () => {
    render(<PortadaDelCuerpo {...props({ doloridas: ['delt'] })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver series por región' }))
    const hoja = screen.getByRole('dialog', { name: 'Series por región' })
    expect(within(hoja).getAllByRole('listitem')).toHaveLength(15)
    expect(within(hoja).getByText('Dorsal').closest('li')).toHaveTextContent('2')
    expect(within(hoja).getByText('Deltoides').closest('li')).toHaveTextContent('Te duele')
  })

  it('pertenece al hueco «cuerpo» del contrato del salon', () => {
    const { container } = render(<PortadaDelCuerpo {...props()} />)
    expect(container.querySelector('[data-hueco="cuerpo"]')).not.toBeNull()
  })
})
