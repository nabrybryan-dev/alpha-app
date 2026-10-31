import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EjercicioPrescrito, Sesion } from '../../../../domain/types'
import { GuiaDePraxis, type GuiaDePraxisProps } from './GuiaDePraxis'

const remo = {
  id: 'e', nombre: 'Remo con barra', categoria: 'Espalda', cues: 'Pecho alto.', prescripcion: '40KG A 10 REPS; 3 SERIES',
  notaCoach: 'Pausa arriba.', sets: 3, rango: '', repsDiana: 10, descansoMin: 2, rirObjetivo: 2, series: [],
} as unknown as EjercicioPrescrito
const sesion = { id: 's', nombre: 'FULL C', orden: 1, ejercicios: [remo] } as Sesion

function props(sobre: Partial<GuiaDePraxisProps> = {}): GuiaDePraxisProps {
  return {
    estado: { paso: 1, zona: 'dors' }, sesion, semana: [sesion], series: {}, doloridas: [], porTrabajar: [], capa: 'musculo', rango: 'hoy',
    alIr: vi.fn(), alIrAlEjercicio: vi.fn(), alCambiarCapa: vi.fn(), alCambiarRango: vi.fn(), alVerMovimiento: vi.fn(),
    ...sobre,
  }
}

describe('Praxis cuenta el día, paso a paso', () => {
  it('cuenta el ejercicio con lo escrito por el coach y las dudas plegadas', () => {
    render(<GuiaDePraxis {...props()} />)
    expect(screen.getByRole('heading', { name: 'Remo con barra' })).toBeInTheDocument()
    expect(screen.getByText('40KG A 10 REPS; 3 SERIES')).toBeInTheDocument()
    expect(screen.getByText('Pausa arriba.')).toBeInTheDocument()
    expect(screen.getByText('Pecho alto.')).toBeInTheDocument()
    expect(screen.getByText('¿Qué significa RIR 2?').closest('details')).not.toHaveAttribute('open')
  })

  it('el campo de dudas sale en los pasos y en las zonas, no en el índice, y solo si quien monta la guía lo pone', () => {
    const dudas = <p>campo de dudas</p>
    const { unmount } = render(<GuiaDePraxis {...props({ dudas })} />)
    expect(screen.getByText('campo de dudas')).toBeInTheDocument()
    unmount()
    const zona = render(<GuiaDePraxis {...props({ dudas, estado: 'dors' })} />)
    expect(screen.getByText('campo de dudas')).toBeInTheDocument()
    zona.unmount()
    const indice = render(<GuiaDePraxis {...props({ dudas, estado: 'indice' })} />)
    expect(screen.queryByText('campo de dudas')).toBeNull()
    indice.unmount()
    render(<GuiaDePraxis {...props()} />)
    expect(screen.queryByText('campo de dudas')).toBeNull()
  })

  it('«Seguir» pasa al siguiente paso con su zona, y «Atrás» vuelve', () => {
    const p = props()
    render(<GuiaDePraxis {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Seguir ›' }))
    expect(p.alIr).toHaveBeenCalledWith({ paso: 2, zona: null })
    fireEvent.click(screen.getByRole('button', { name: '‹ Atrás' }))
    expect(p.alIr).toHaveBeenCalledWith({ paso: 0, zona: null })
  })

  it('deslizar de lado también avanza; en vertical no', () => {
    const p = props()
    render(<GuiaDePraxis {...p} />)
    const panel = document.querySelector('[data-testigo="guia-de-praxis"]') as HTMLElement
    const dedo = (tipo: string, x: number, y: number) => fireEvent(panel, new MouseEvent(tipo, { bubbles: true, clientX: x, clientY: y }))
    dedo('pointerdown', 200, 100)
    dedo('pointerup', 200, 300)
    expect(p.alIr).not.toHaveBeenCalled()
    dedo('pointerdown', 300, 100)
    dedo('pointerup', 100, 110)
    expect(p.alIr).toHaveBeenCalledWith({ paso: 2, zona: null })
  })

  it('el último paso cierra, y «Anotar este ejercicio» lleva a él', () => {
    const p = props({ estado: { paso: 2, zona: null } })
    const { unmount } = render(<GuiaDePraxis {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(p.alIr).toHaveBeenCalledWith(null)
    unmount()
    const q = props()
    render(<GuiaDePraxis {...q} />)
    fireEvent.click(screen.getByRole('button', { name: 'Anotar este ejercicio' }))
    expect(q.alIrAlEjercicio).toHaveBeenCalledWith(0)
  })

  it('el panel es oscuro en los dos temas: es la voz de Praxis, no una hoja más', () => {
    render(<GuiaDePraxis {...props()} />)
    const panel = document.querySelector('[data-testigo="guia-de-praxis"]') as HTMLElement
    expect(panel.getAttribute('data-theme')).toBe('dark')
    // Un fondo de un token que el tema oscuro redefine: con la tinta, en claro salía letra blanca sobre blanco.
    expect(panel.getAttribute('style')).toContain('--surface-1')
  })
})
