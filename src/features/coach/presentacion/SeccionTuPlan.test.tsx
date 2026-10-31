import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { PlanEstrategico } from '../../../data/consola/planesEstrategicos'
import { SeccionTuPlan } from './SeccionTuPlan'

function plan(contenido: unknown): PlanEstrategico {
  return { id: 'p', usuarioId: 'u', version: 3, vigente: true, contenido, hash: 'h', creadoEn: '2026-09-20T12:00:00Z' }
}

const COMPLETO = plan({
  objetivo_largo_plazo: 'ganar fuerza en piernas',
  metrica_principal: 'sesiones completadas',
  horizonte: '2026-11-02 → 2026-11-15 (2 microciclos)',
  cabecera: ['Micro', 'Series', 'Nota'],
  filas: {
    '2': { columnas: { Micro: 'M2', Series: '~64', Nota: 'sube carga' }, condiciones: {} },
    '1': { columnas: { Micro: 'M1', Series: '**50**', Nota: '' }, condiciones: {} },
  },
  reglas: [
    { numero: 1, nombre: 'Dolor', texto: '**Dolor —** si duele, para.' },
    { numero: 2, nombre: 'Sueño', texto: '**Sueño —** si duerme poco, no sube.' },
  ],
})

describe('SeccionTuPlan', () => {
  it('muestra de una vez el objetivo, la métrica y las fechas', () => {
    render(<SeccionTuPlan plan={{ estado: 'listo', valor: COMPLETO }} numeroActual={undefined} />)
    expect(screen.getByText('ganar fuerza en piernas')).toBeInTheDocument()
    expect(screen.getByText('sesiones completadas')).toBeInTheDocument()
    expect(screen.getByText('2026-11-02 → 2026-11-15 (2 microciclos)')).toBeInTheDocument()
  })

  it('muestra todas las semanas en orden y sin tocar nada, sin marcas de Markdown ni celdas vacías', () => {
    render(<SeccionTuPlan plan={{ estado: 'listo', valor: COMPLETO }} numeroActual={undefined} />)
    const semanas = screen.getAllByRole('listitem').filter((li) => li.textContent?.startsWith('Semana'))
    expect(semanas).toHaveLength(2)
    expect(semanas[0]).toHaveTextContent('Semana 1')
    expect(within(semanas[0]).getByText('50')).toBeInTheDocument()
    expect(within(semanas[0]).queryByText('Nota')).toBeNull()
    expect(within(semanas[1]).getByText('sube carga')).toBeInTheDocument()
  })

  it('marca la semana de ahora solo cuando de verdad ya empezó', () => {
    const { rerender } = render(<SeccionTuPlan plan={{ estado: 'listo', valor: COMPLETO }} numeroActual={undefined} />)
    expect(screen.queryByText('la de ahora')).toBeNull()
    rerender(<SeccionTuPlan plan={{ estado: 'listo', valor: COMPLETO }} numeroActual={2} />)
    expect(screen.getByText('la de ahora').closest('li')).toHaveTextContent('Semana 2')
  })

  it('las reglas van plegadas, se abren al tocar y salen sin asteriscos', async () => {
    const user = userEvent.setup()
    render(<SeccionTuPlan plan={{ estado: 'listo', valor: COMPLETO }} numeroActual={undefined} />)
    const resumen = screen.getByText('Reglas del plan (2)')
    const plegable = resumen.closest('details')
    expect(plegable).not.toHaveAttribute('open')
    await user.click(resumen)
    expect(plegable).toHaveAttribute('open')
    expect(within(plegable as HTMLElement).getByText('Dolor — si duele, para.')).toBeInTheDocument()
  })

  it('sin plan lo dice en una frase; mientras carga no dice nada falso', () => {
    const { rerender } = render(<SeccionTuPlan plan={{ estado: 'listo', valor: null }} numeroActual={undefined} />)
    expect(screen.getByText(/no hay un plan de largo plazo/)).toBeInTheDocument()
    rerender(<SeccionTuPlan plan={{ estado: 'cargando' }} numeroActual={undefined} />)
    expect(screen.getByLabelText('Cargando')).toBeInTheDocument()
    expect(screen.queryByText(/no hay un plan/)).toBeNull()
  })

  it('un plan sin semanas ni reglas enseña lo que tiene y avisa lo que falta', () => {
    render(<SeccionTuPlan plan={{ estado: 'listo', valor: plan({ objetivo_largo_plazo: 'algo' }) }} numeroActual={undefined} />)
    expect(screen.getByText('algo')).toBeInTheDocument()
    expect(screen.getByText(/todavía no trae el detalle/)).toBeInTheDocument()
    expect(screen.queryByText(/Reglas del plan/)).toBeNull()
  })
})
