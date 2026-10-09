import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { PlanEstrategico } from '../../../data/consola/planesEstrategicos'
import { SeccionMapaDelPlan } from './SeccionMapaDelPlan'

function plan(contenido: unknown): PlanEstrategico {
  return { id: 'p', usuarioId: 'u', version: 2, vigente: true, contenido, hash: 'h', creadoEn: '2026-09-20T12:00:00Z' }
}

const CON_TABLA = plan({
  objetivo_largo_plazo: 'recomposición con glúteo como métrica',
  cabecera: ['Micro', 'Series', 'Foco'],
  filas: {
    '1': { columnas: { Micro: 'M1', Series: '~60', Foco: '**técnica**' }, condiciones: {} },
    '2': { columnas: { Micro: 'M2', Series: '~64', Foco: 'sube la [carga](x)' }, condiciones: {} },
    '3': { columnas: { Micro: 'M3', Series: '~68', Foco: '' }, condiciones: {} },
  },
})

describe('SeccionMapaDelPlan', () => {
  it('sin plan vigente lo dice en una frase y no se rompe', () => {
    render(<SeccionMapaDelPlan plan={{ estado: 'listo', valor: null }} numeroActual={2} ultimoCerrado={1} />)
    expect(screen.getByText(/no hay un plan de largo plazo/)).toBeInTheDocument()
  })

  it('si el plan no se pudo leer, tampoco se rompe', () => {
    render(<SeccionMapaDelPlan plan={{ estado: 'fallo' }} numeroActual={undefined} ultimoCerrado={undefined} />)
    expect(screen.getByText(/no hay un plan de largo plazo/)).toBeInTheDocument()
  })

  it('mientras carga enseña el esqueleto, no una frase falsa', () => {
    render(<SeccionMapaDelPlan plan={{ estado: 'cargando' }} numeroActual={undefined} ultimoCerrado={undefined} />)
    expect(screen.getByLabelText('Cargando')).toBeInTheDocument()
    expect(screen.queryByText(/no hay un plan/)).toBeNull()
  })

  it('un plan sin tabla semana a semana lo dice', () => {
    render(
      <SeccionMapaDelPlan plan={{ estado: 'listo', valor: plan({ objetivo_largo_plazo: 'algo' }) }} numeroActual={1} ultimoCerrado={undefined} />,
    )
    expect(screen.getByText('algo')).toBeInTheDocument()
    expect(screen.getByText(/todavía no trae el detalle/)).toBeInTheDocument()
  })

  it('pinta una casilla por semana y marca la de ahora, las hechas y las que vienen', () => {
    render(<SeccionMapaDelPlan plan={{ estado: 'listo', valor: CON_TABLA }} numeroActual={2} ultimoCerrado={1} />)
    expect(screen.getByText('recomposición con glúteo como métrica')).toBeInTheDocument()
    const hecha = screen.getByRole('button', { name: 'Semana 1, ya pasó' })
    const actual = screen.getByRole('button', { name: 'Semana 2, es esta, la de ahora' })
    const viene = screen.getByRole('button', { name: 'Semana 3, viene' })
    expect(actual).toHaveAttribute('aria-current', 'step')
    expect(hecha).not.toHaveAttribute('aria-current')
    expect(viene).not.toHaveAttribute('aria-current')
    expect(actual).toHaveClass('bg-rojo')
    expect(viene).toHaveClass('border-dashed')
  })

  it('al tocar una casilla se abre debajo lo que el plan dice de esa semana, sin marcas de Markdown', async () => {
    const user = userEvent.setup()
    render(<SeccionMapaDelPlan plan={{ estado: 'listo', valor: CON_TABLA }} numeroActual={2} ultimoCerrado={1} />)
    expect(screen.getByText(/Toca una semana/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Semana 2, es esta, la de ahora' }))
    expect(screen.getByText('~64')).toBeInTheDocument()
    expect(screen.getByText('sube la carga')).toBeInTheDocument()
    expect(screen.queryByText(/\*\*|\]\(/)).toBeNull()
    expect(screen.getByRole('button', { name: /Semana 2/ })).toHaveAttribute('aria-pressed', 'true')

    // Otra casilla cambia el detalle; las columnas en blanco del plan no se pintan.
    await user.click(screen.getByRole('button', { name: 'Semana 3, viene' }))
    expect(screen.getByText('~68')).toBeInTheDocument()
    expect(screen.queryByText('~64')).toBeNull()
    expect(screen.queryByText('Foco')).toBeNull()

    // Tocarla otra vez la cierra.
    await user.click(screen.getByRole('button', { name: 'Semana 3, viene' }))
    expect(screen.queryByText('~68')).toBeNull()
  })

  it('con 32 microciclos pinta las 32 casillas', () => {
    const filas = Object.fromEntries(
      Array.from({ length: 32 }, (_, i) => [String(i + 1), { columnas: { Micro: `M${i + 1}` }, condiciones: {} }]),
    )
    render(
      <SeccionMapaDelPlan plan={{ estado: 'listo', valor: plan({ cabecera: ['Micro'], filas }) }} numeroActual={10} ultimoCerrado={9} />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(32)
  })
})
