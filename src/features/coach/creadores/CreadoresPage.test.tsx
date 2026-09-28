import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Candidato } from '../../../data/consola/creadores'

const estado = { candidatos: [] as Candidato[] }

vi.mock('../../../data/consola/creadores', async (original) => {
  const real = await original<typeof import('../../../data/consola/creadores')>()
  return {
    ...real,
    candidatosDelTablero: () => Promise.resolve(estado.candidatos),
    revisionesDe: () => Promise.resolve([]),
    urlHojaCuadros: () => Promise.resolve(null),
  }
})

const { default: CreadoresPage } = await import('./CreadoresPage')

function candidato(parcial: Partial<Candidato>): Candidato {
  return {
    creadorId: 'ig:1',
    usuarioIg: 'creador',
    seguidores: 800,
    segmento: 'aliado',
    carril: 'etapa1',
    motivos: [],
    notaA: null,
    versionRubrica: null,
    metricas: {},
    senalColombia: null,
    fechaDato: '2026-09-28T00:00:00Z',
    fechaRecepcion: '2026-09-28T00:00:00Z',
    actualizadoEn: '2026-09-28T00:00:00Z',
    ...parcial,
  }
}

beforeEach(() => {
  estado.candidatos = []
})

describe('CreadoresPage', () => {
  it('sin datos lo dice, no pinta un tablero vacío mudo', async () => {
    render(<CreadoresPage />)
    expect(await screen.findByText('Todavía no hay creadores en el tablero.')).toBeInTheDocument()
  })

  it('«Tambaleando» va primero, con su motivo, y los entrenadores al final', async () => {
    estado.candidatos = [
      candidato({ creadorId: 'ig:3', usuarioIg: 'entrena', carril: 'entrenador', segmento: 'entrenador' }),
      candidato({ creadorId: 'ig:2', usuarioIg: 'numeros', carril: 'etapa1' }),
      candidato({ creadorId: 'ig:1', usuarioIg: 'enellimite', carril: 'tambaleando', motivos: ['C 1,8', 'sin audio'] }),
    ]
    render(<CreadoresPage />)
    const titulos = await screen.findAllByRole('heading', { level: 2 })
    expect(titulos.map((t) => t.textContent)).toEqual([
      'Tambaleando (1)',
      'Etapa 1 · números (1)',
      'Entrenadores (alquiler) (1)',
    ])
    const tambaleando = screen.getByRole('region', { name: 'Tambaleando (1)' })
    expect(within(tambaleando).getByText('@enellimite')).toBeInTheDocument()
    expect(within(tambaleando).getByText('C 1,8')).toBeInTheDocument()
  })

  it('no ofrece ningún botón que escriba (F1 es solo lectura)', async () => {
    estado.candidatos = [candidato({ carril: 'aprobado_contacto' })]
    render(<CreadoresPage />)
    await screen.findByText('@creador')
    const botones = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    expect(botones.some((t) => /firmar|aprobar|enviar|vetar/i.test(t))).toBe(false)
  })
})
