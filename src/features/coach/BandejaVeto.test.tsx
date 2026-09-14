import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BandejaVeto } from './BandejaVeto'

type FilaBandeja = {
  pendiente: {
    id: string
    usuarioId: string
    microcicloId: string
    idAnterior: string | null
    datos: Record<string, unknown>
    avisos: unknown[]
    traeParada: boolean
    creadoEn: string
    publicarEn: string
    estado: string
    motivo: string | null
  }
  nombre: string
  microcicloNumero: number | undefined
}

const nube = {
  filas: [] as FilaBandeja[],
  ultimoParar: undefined as { id: string; motivo: string } | undefined,
  errorLeer: null as string | null,
  errorParar: null as string | null,
}

vi.mock('./bandejaVetoNube', async () => {
  const real = await vi.importActual<typeof import('./bandejaVetoNube')>('./bandejaVetoNube')
  return {
    ...real,
    leerBandeja: async () => {
      if (nube.errorLeer) throw new Error(nube.errorLeer)
      return nube.filas
    },
    pararPublicacion: async (id: string, motivo: string) => {
      nube.ultimoParar = { id, motivo }
      if (nube.errorParar) throw new Error(nube.errorParar)
    },
  }
})

vi.mock('../../data/supabase', () => ({
  get modoNube() {
    return true
  },
  supabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
        in: () => Promise.resolve({ data: [], error: null }),
      }),
      rpc: () => Promise.resolve({ error: null }),
    }),
  }),
}))

function pendienteBase(overrides: Partial<FilaBandeja['pendiente']> = {}): FilaBandeja['pendiente'] {
  const ahora = new Date()
  const publicarEn = new Date(ahora.getTime() + 12 * 60 * 60 * 1000).toISOString()
  return {
    id: 'pend-1',
    usuarioId: 'u-valentina',
    microcicloId: 'm-12',
    idAnterior: 'm-11',
    datos: { numero: 12, sesiones: [] },
    avisos: [],
    traeParada: false,
    creadoEn: ahora.toISOString(),
    publicarEn,
    estado: 'pendiente',
    motivo: null,
    ...overrides,
  }
}

function fila(persona: string, avisos: unknown[] = [], traeParada = false, horasRestantes = 12): FilaBandeja {
  const ahora = new Date()
  return {
    pendiente: pendienteBase({
      id: `pend-${persona}`,
      usuarioId: `u-${persona}`,
      avisos,
      traeParada,
      publicarEn: new Date(ahora.getTime() + horasRestantes * 60 * 60 * 1000).toISOString(),
    }),
    nombre: persona,
    microcicloNumero: 12,
  }
}

describe('BandejaVeto', () => {
  beforeEach(() => {
    nube.filas = []
    nube.ultimoParar = undefined
    nube.errorLeer = null
    nube.errorParar = null
  })

  it('si la lectura falla, lo dice y ofrece reintentar', async () => {
    nube.errorLeer = 'conexión perdida'
    render(
      <MemoryRouter>
        <BandejaVeto />
      </MemoryRouter>,
    )
    expect(await screen.findByText('No se pudo cargar la bandeja')).toBeInTheDocument()
    expect(screen.getByText(/conexión perdida/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('lista persona, microciclo, avisos arriba, cuenta atrás, Ver plan y Parar', async () => {
    nube.filas = [fila('Valentina Cruz', ['Falta el test de bienestar de ayer', { mensaje: 'Riesgo I-23' }])]
    render(
      <MemoryRouter>
        <BandejaVeto />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Valentina Cruz')).toBeInTheDocument()
    expect(screen.getByText('M12')).toBeInTheDocument()
    expect(screen.getByText(/Falta el test de bienestar/)).toBeInTheDocument()
    expect(screen.getByText(/Riesgo I-23/)).toBeInTheDocument()
    expect(screen.getByText('12 h')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver plan' })).toHaveAttribute('href', '/coach/asesorado/u-Valentina Cruz')
    expect(screen.getByRole('button', { name: 'Parar' })).toBeInTheDocument()
  })

  it('la cuenta atrás dice vencida cuando ya pasó la hora', async () => {
    nube.filas = [fila('Valentina Cruz', [], false, -1)]
    render(
      <MemoryRouter>
        <BandejaVeto />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/vencida/)).toBeInTheDocument()
  })

  it('trae_parada muestra el badge y no oculta la fila', async () => {
    nube.filas = [fila('Mateo Ruiz', [], true)]
    render(
      <MemoryRouter>
        <BandejaVeto />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Mateo Ruiz')).toBeInTheDocument()
    expect(screen.getByText('trae parada')).toBeInTheDocument()
  })

  it('Parar pide motivo y al confirmar llama parar_publicacion y saca la fila', async () => {
    nube.filas = [fila('Valentina Cruz'), fila('Mateo Ruiz')]
    render(
      <MemoryRouter>
        <BandejaVeto />
      </MemoryRouter>,
    )
    await screen.findByText('Valentina Cruz')
    const nombre = screen.getAllByText('Valentina Cruz')[0]
    // La fila es el contenedor con los dos botones: lo agarramos por el link Ver plan cercano
    const link = screen.getAllByRole('link', { name: 'Ver plan' }).find((a) => a.getAttribute('href')?.includes('Valentina'))!
    const filaEl = link.closest('div[class*="rounded-xl"]') as HTMLElement
    void nombre
    await userEvent.click(within(filaEl).getByRole('button', { name: 'Parar' }))
    await userEvent.type(within(filaEl).getByPlaceholderText('Motivo (opcional)'), 'revisar cribado')
    await userEvent.click(within(filaEl).getByRole('button', { name: 'Confirmar' }))

    expect(nube.ultimoParar).toEqual({ id: 'pend-Valentina Cruz', motivo: 'revisar cribado' })
    expect(await screen.findByText('Parado. No se publicará solo.')).toBeInTheDocument()
    expect(screen.queryByText('Valentina Cruz')).not.toBeInTheDocument()
    expect(screen.getByText('Mateo Ruiz')).toBeInTheDocument()
  })

  it('si parar falla, no saca la fila y enseña el error', async () => {
    nube.filas = [fila('Valentina Cruz')]
    nube.errorParar = 'permiso denegado'
    render(
      <MemoryRouter>
        <BandejaVeto />
      </MemoryRouter>,
    )
    await screen.findByText('Valentina Cruz')
    const filaEl = screen.getByRole('link', { name: 'Ver plan' }).closest('div[class*="rounded-xl"]') as HTMLElement
    await userEvent.click(within(filaEl).getByRole('button', { name: 'Parar' }))
    await userEvent.click(within(filaEl).getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText(/No se pudo parar/)).toBeInTheDocument()
    expect(screen.getByText('Valentina Cruz')).toBeInTheDocument()
  })

  it('sin pendientes no renderiza nada (no enseña "0 planes")', async () => {
    nube.filas = []
    const { container } = render(
      <MemoryRouter>
        <BandejaVeto />
      </MemoryRouter>,
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(container.innerHTML).not.toContain('Planes que salen solos')
  })
})
