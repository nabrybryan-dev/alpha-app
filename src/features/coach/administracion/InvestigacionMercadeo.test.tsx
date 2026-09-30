import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FilaDetalle, SeccionLeida } from '../../../domain/adminTablero'
import { InvestigacionMercadeo } from './InvestigacionMercadeo'
import type { EstadoTablero, TableroAdmin } from './useTableroAdmin'

const tablero = (estado: EstadoTablero): TableroAdmin => ({
  estado,
  reintentar: vi.fn(),
  abiertas: [],
  alternar: vi.fn(),
  esCoach: true,
  tiene: () => true,
})
const fila = (id: string, titulo: string, archivo = 'mercadeo/ganchos-30sep.md'): FilaDetalle => ({
  id,
  titulo,
  cifra: '',
  semaforo: 'verde',
  dueno: 'agente:mercadeo',
  detalle: 'Detalle de prueba',
  queHacer: '',
  fuente: { archivo, corte: '2026-09-30', huella: 'h' },
})
const conFilas = (filas: FilaDetalle[]): EstadoTablero => {
  const s: SeccionLeida = {
    seccion: 'mercadeo',
    estado: 'ok',
    corte: '2026-09-30',
    fuente: null,
    huella: null,
    datos: { tarjeta: { titulo: 'M', semaforo: 'gris', frase: '', cifra: '', cifraEtiqueta: '' }, filas, grafico: null },
  }
  return { tipo: 'ok', secciones: [s] }
}
const NOMBRES = ['Tendencias', 'Videos: estructura, loops y cortes', 'Ganchos usados (hooks)', 'Diseños visuales']

describe('InvestigacionMercadeo', () => {
  it('sin fuente sale gris con FALTA y dice quién lo trae, sin cero', () => {
    render(<InvestigacionMercadeo t={tablero(conFilas([]))} />)
    const g = screen.getByRole('region', { name: 'Ganchos usados (hooks)' })
    expect(g.className).toMatch(/border-dashed/)
    expect(within(g).getByText(/^FALTA:.*los carga Bryan/)).toBeInTheDocument()
    expect(within(g).queryByText('0')).toBeNull()
  })

  it('un error de lectura se ve distinto de sin datos', () => {
    const { unmount } = render(<InvestigacionMercadeo t={tablero({ tipo: 'fallo', error: 'red caída' })} />)
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/No se pudo leer/).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/FALTA/)).toHaveLength(0)
    unmount()
    render(<InvestigacionMercadeo t={tablero(conFilas([]))} />)
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(screen.queryAllByText(/No se pudo leer/)).toHaveLength(0)
    expect(screen.getAllByText(/FALTA/).length).toBeGreaterThan(0)
  })

  it('las cuatro tarjetas van de lo macro a lo concreto', () => {
    render(<InvestigacionMercadeo t={tablero(conFilas([]))} />)
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(NOMBRES)
  })

  it('una fila del tema sale plegable con frase, fuente, fecha y estado FALTA (no inventado)', async () => {
    const u = userEvent.setup()
    render(<InvestigacionMercadeo t={tablero(conFilas([fila('ganchos-1', 'Abrir con una pregunta directa')]))} />)
    const g = screen.getByRole('region', { name: 'Ganchos usados (hooks)' })
    expect(g.className).not.toMatch(/border-dashed/)
    await u.click(within(g).getByRole('button', { name: /Ganchos usados/ }))
    await u.click(within(g).getByRole('button', { name: /Abrir con una pregunta directa/ }))
    expect(within(g).getByText(/mercadeo\/ganchos-30sep\.md/)).toBeInTheDocument()
    expect(within(g).getByText(/2026-09-30/)).toBeInTheDocument()
    expect(within(g).getByText(/Estado: FALTA/)).toBeInTheDocument()
  })

  it('Manuela comenta en el buzón; comentar cada hallazgo queda Pendiente: necesita una tabla nueva', async () => {
    const u = userEvent.setup()
    render(<InvestigacionMercadeo t={tablero(conFilas([fila('ganchos-1', 'Abrir con una pregunta directa')]))} />)
    const g = screen.getByRole('region', { name: 'Ganchos usados (hooks)' })
    await u.click(within(g).getByRole('button', { name: /Ganchos usados/ }))
    expect(within(g).getByText(/Investigación del agente/)).toBeInTheDocument()
    expect(within(g).getByText(/Pendiente: necesita una tabla nueva/)).toBeInTheDocument()
  })

  it('sin permiso o sin tabla, gris «Pendiente de activar» y no FALTA', () => {
    render(<InvestigacionMercadeo t={tablero({ tipo: 'pendiente' })} />)
    expect(screen.getAllByText('Pendiente de activar (migración 0102)')).toHaveLength(4)
    expect(screen.queryAllByText(/FALTA/)).toHaveLength(0)
  })
})
