import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultadoGuion } from '../../data/consola/guionesLlamada'
import { leerGuion } from '../../domain/consolaCoach/guionDeVenta'

const carga = { resultado: { ok: true, guion: null } as ResultadoGuion, llamadas: [] as string[] }

vi.mock('../../data/consola/guionesLlamada', () => ({
  guionDe: (usuarioId: string) => {
    carga.llamadas.push(usuarioId)
    return Promise.resolve(carga.resultado)
  },
}))

const { GuionDeVenta } = await import('./GuionDeVenta')

// Guion inventado: ninguna persona real.
function guardado(guion: Record<string, unknown>, extra: Record<string, unknown> = {}): ResultadoGuion {
  return {
    ok: true,
    guion: {
      id: 'g1',
      version: 2,
      origen: 'landing',
      creadoEn: '2026-10-30T15:00:00Z',
      diaPreferido: '2026-11-05',
      franjaPreferida: 'en la tarde',
      horaPreferida: null,
      guion: leerGuion(guion)!,
      ...extra,
    },
  }
}

const COMPLETO = {
  version: 2,
  persona: { nombre: 'Persona de prueba', edad_tramo: '30-39', objetivo: 'Ganar fuerza' },
  alerta_salud: 'Lesión de rodilla reciente',
  apertura: 'Abre con su rutina de la mañana.',
  dolores: ['Poco tiempo entre semana'],
  que_mostrar: ['El registro de series'],
  objeciones_probables: [{ objecion: 'No tengo tiempo', respuesta: 'Sesiones cortas, a su ritmo.' }],
  cierre: 'Propón empezar el lunes.',
  avisos: ['Confirma el día con la persona'],
}

beforeEach(() => {
  carga.resultado = { ok: true, guion: null }
  carga.llamadas = []
})

describe('GuionDeVenta', () => {
  it('sin guion no pinta nada', async () => {
    const { container } = render(<GuionDeVenta usuarioId="u1" />)
    await waitFor(() => expect(carga.llamadas).toEqual(['u1']))
    expect(container).toBeEmptyDOMElement()
  })

  it('un guion sin ninguna sección tampoco se pinta', async () => {
    carga.resultado = guardado({ version: 1, persona: { nombre: 'Persona de prueba' } })
    const { container } = render(<GuionDeVenta usuarioId="u1" />)
    await waitFor(() => expect(carga.llamadas).toHaveLength(1))
    expect(container).toBeEmptyDOMElement()
  })

  it('pinta preferencia (hora de Colombia), alerta y las seis secciones', async () => {
    carga.resultado = guardado(COMPLETO)
    render(<GuionDeVenta usuarioId="u1" />)
    const tarjeta = await screen.findByRole('region', { name: 'Guion de la llamada' })
    expect(tarjeta).toHaveTextContent('Persona de prueba · 30-39 · Ganar fuerza')
    expect(tarjeta).toHaveTextContent('jue 5 nov 2026 · en la tarde')
    expect(tarjeta).toHaveTextContent('hora de Colombia')
    expect(screen.getByRole('note')).toHaveTextContent('Lesión de rodilla reciente')
    expect(screen.getByRole('note')).toHaveTextContent('aval de su médico')
    for (const titulo of ['Apertura', 'Lo que le pesa', 'Qué mostrarle', 'Objeciones probables', 'Cierre', 'Avisos']) {
      expect(screen.getByRole('region', { name: titulo })).toBeInTheDocument()
    }
    expect(screen.getByText('«No tengo tiempo»')).toBeInTheDocument()
    expect(screen.getByText('Sesiones cortas, a su ritmo.')).toBeInTheDocument()
  })

  it('se pliega y despliega; la alerta y la preferencia quedan a la vista', async () => {
    carga.resultado = guardado(COMPLETO)
    render(<GuionDeVenta usuarioId="u1" />)
    const boton = await screen.findByRole('button', { name: 'Plegar el guion' })
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(boton)
    expect(screen.getByRole('button', { name: 'Ver el guion' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Apertura' })).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toBeInTheDocument()
    expect(screen.getByText('jue 5 nov 2026 · en la tarde')).toBeInTheDocument()
  })

  it('sin alerta no hay recuadro de salud, y sin preferencia lo dice', async () => {
    carga.resultado = guardado({ ...COMPLETO, alerta_salud: null }, { diaPreferido: null, franjaPreferida: null })
    render(<GuionDeVenta usuarioId="u1" />)
    await screen.findByRole('region', { name: 'Guion de la llamada' })
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(screen.getByText('no dijo cuándo')).toBeInTheDocument()
  })

  it('un fallo de carga se dice y se puede reintentar', async () => {
    carga.resultado = { ok: false, error: 'No se pudo cargar el guion de la llamada.' }
    render(<GuionDeVenta usuarioId="u1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el guion')
    carga.resultado = guardado(COMPLETO)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('region', { name: 'Guion de la llamada' })).toBeInTheDocument()
    expect(carga.llamadas).toHaveLength(2)
  })
})
