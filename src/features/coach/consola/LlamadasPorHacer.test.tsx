import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LlamadaPorHacer, ResultadoLlamadas } from '../../../data/consola/guionesLlamada'
import EJEMPLO from '../../../domain/consolaCoach/guion-llamada-v1.fixture.json'
import { leerGuion } from '../../../domain/consolaCoach/guionDeVenta'

const carga = { resultado: { ok: true, llamadas: [] } as ResultadoLlamadas, pedidos: 0 }

vi.mock('../../../data/consola/guionesLlamada', () => ({
  llamadasPorHacer: () => {
    carga.pedidos += 1
    return Promise.resolve(carga.resultado)
  },
}))

const { LlamadasPorHacer } = await import('./LlamadasPorHacer')

// Datos inventados (el repo es público): el fixture de guion-llamada-v1 con otros nombres.
function llamada(personId: string, nombre: string, extra: Partial<LlamadaPorHacer> = {}, guion: Record<string, unknown> = {}): LlamadaPorHacer {
  const l = leerGuion({ ...EJEMPLO, persona: { ...EJEMPLO.persona, nombre }, ...guion })
  if (!l.ok) throw new Error('fixture ilegible')
  return {
    personId,
    usuarioId: null,
    dia: '2026-11-05',
    guardado: {
      id: `g-${personId}`,
      personId,
      usuarioId: null,
      creadoEn: '2026-10-30T15:00:00Z',
      diaPreferido: '2026-11-05',
      franjaPreferida: 'en la tarde',
      horaPreferida: '15:00',
      guion: l.guion,
    },
    ...extra,
  }
}

beforeEach(() => {
  carga.resultado = { ok: true, llamadas: [] }
  carga.pedidos = 0
})

describe('LlamadasPorHacer', () => {
  it('sin llamadas (o sin la puerta de la tabla, que da cero filas) no pinta nada', async () => {
    const { container } = render(<LlamadasPorHacer />)
    await waitFor(() => expect(carga.pedidos).toBe(1))
    expect(container).toBeEmptyDOMElement()
  })

  it('lista en el orden recibido, con el día, la hora y si ya tiene cuenta', async () => {
    carga.resultado = {
      ok: true,
      llamadas: [llamada('p1', 'Prospecto Uno'), llamada('p2', 'Prospecto Dos', { usuarioId: 'u2', dia: '2026-11-06' })],
    }
    render(<LlamadasPorHacer />)
    const filas = await screen.findAllByRole('button', { expanded: false })
    expect(filas.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Prospecto Uno'),
      expect.stringContaining('Prospecto Dos'),
    ])
    expect(screen.getByText('Sin cuenta')).toBeInTheDocument()
    expect(screen.getByText('Ya tiene cuenta')).toBeInTheDocument()
    expect(screen.getByText(/5 nov 2026 · 15:00/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Llamadas por hacer' })).toHaveTextContent('2')
  })

  it('abre la MISMA tarjeta del guion, una a la vez, y se vuelve a plegar', async () => {
    carga.resultado = { ok: true, llamadas: [llamada('p1', 'Prospecto Uno'), llamada('p2', 'Prospecto Dos')] }
    render(<LlamadasPorHacer />)
    fireEvent.click(await screen.findByRole('button', { name: /Prospecto Uno/ }))
    expect(screen.getAllByRole('region', { name: 'Guion de la llamada' })).toHaveLength(1)
    expect(screen.getByText('persona.ficticia@ejemplo.test')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Prospecto Dos/ }))
    expect(screen.getAllByRole('region', { name: 'Guion de la llamada' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Prospecto Uno/ })).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(screen.getByRole('button', { name: /Prospecto Dos/ }))
    expect(screen.queryByRole('region', { name: 'Guion de la llamada' })).not.toBeInTheDocument()
  })

  it('la alerta de salud se ve en la fila, solo con las marcas del esquema', async () => {
    carga.resultado = {
      ok: true,
      llamadas: [llamada('p1', 'Prospecto Uno', {}, { alerta_salud: { hay: true, requiere_aval: true, menor_de_edad: false } })],
    }
    render(<LlamadasPorHacer />)
    expect(await screen.findByText('Requiere aval médico')).toBeInTheDocument()
  })

  it('un fallo se dice y se puede reintentar', async () => {
    carga.resultado = { ok: false, error: 'No se pudieron cargar las llamadas por hacer.' }
    render(<LlamadasPorHacer />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las llamadas por hacer.')
    carga.resultado = { ok: true, llamadas: [llamada('p1', 'Prospecto Uno')] }
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(await screen.findByRole('button', { name: /Prospecto Uno/ })).toBeInTheDocument()
    expect(carga.pedidos).toBe(2)
  })
})
