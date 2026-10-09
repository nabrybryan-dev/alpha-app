import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listarMock = vi.fn()
const agregarMock = vi.fn()

vi.mock('../../data/consola/notasLlamada', () => ({
  notasLlamadaDe: (...args: unknown[]) => listarMock(...args),
  agregarNotaLlamada: (...args: unknown[]) => agregarMock(...args),
}))

vi.mock('../../data/dbInstance', () => ({
  hoyIso: () => '2026-10-08',
}))

const { NotasDeLlamada } = await import('./NotasDeLlamada')

function nota(extra: Record<string, unknown> = {}) {
  return {
    id: 'nota-1',
    usuarioId: 'u-1',
    coachId: 'u-manuela',
    fecha: '2026-10-01',
    hora: '17:00',
    conclusiones: 'Le cuesta el desayuno antes de entrenar.',
    proximaReunion: 'en 2 semanas',
    creadoEn: '2026-10-01T22:00:00Z',
    ...extra,
  }
}

beforeEach(() => {
  listarMock.mockReset().mockResolvedValue([])
  agregarMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NotasDeLlamada', () => {
  it('pinta las notas que ya existen, más reciente primero (como las manda el servicio)', async () => {
    listarMock.mockResolvedValue([nota()])
    render(<NotasDeLlamada usuarioId="u-1" />)

    expect(await screen.findByText('Le cuesta el desayuno antes de entrenar.')).toBeInTheDocument()
    expect(screen.getByText(/2026-10-01 · 17:00/)).toBeInTheDocument()
    expect(screen.getByText('Próxima reunión: en 2 semanas')).toBeInTheDocument()
  })

  it('sin ninguna todavía, lo dice en vez de dejar la tarjeta vacía', async () => {
    render(<NotasDeLlamada usuarioId="u-1" />)
    expect(await screen.findByText('Todavía no hay llamadas anotadas.')).toBeInTheDocument()
  })

  it('el botón «Guardar nota» empieza deshabilitado sin conclusiones', async () => {
    render(<NotasDeLlamada usuarioId="u-1" />)
    // Deja asentar la carga inicial antes de interactuar: sin esto, su `setNotas` cae
    // fuera de `act()` en mitad del siguiente test, no de este.
    await screen.findByText('Todavía no hay llamadas anotadas.')
    fireEvent.click(screen.getByRole('button', { name: '+ Anotar llamada' }))
    expect(screen.getByRole('button', { name: 'Guardar nota' })).toBeDisabled()
  })

  it('guarda y la nueva nota aparece arriba, sin recargar la lista', async () => {
    agregarMock.mockResolvedValue({ ok: true, nota: nota({ id: 'nota-2', conclusiones: 'Va a subir la carga.' }) })
    const usuario = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Todavía no hay llamadas anotadas.')

    await usuario.click(screen.getByRole('button', { name: '+ Anotar llamada' }))
    await usuario.type(screen.getByLabelText('Qué se habló'), 'Va a subir la carga.')
    await usuario.click(screen.getByRole('button', { name: 'Guardar nota' }))

    expect(await screen.findByText('Va a subir la carga.')).toBeInTheDocument()
    expect(agregarMock).toHaveBeenCalledWith('u-1', {
      fecha: '2026-10-08',
      hora: undefined,
      conclusiones: 'Va a subir la carga.',
      proximaReunion: undefined,
    })
    // El formulario se cierra y se limpia tras guardar.
    expect(screen.queryByRole('button', { name: 'Guardar nota' })).not.toBeInTheDocument()
  })

  it('si la base rechaza, enseña el error y no limpia lo que ya había escrito', async () => {
    agregarMock.mockResolvedValue({ ok: false, error: 'No tienes permiso para anotar llamadas de este asesorado.' })
    const usuario = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Todavía no hay llamadas anotadas.')

    await usuario.click(screen.getByRole('button', { name: '+ Anotar llamada' }))
    await usuario.type(screen.getByLabelText('Qué se habló'), 'Algo que se pierde si recarga')
    await usuario.click(screen.getByRole('button', { name: 'Guardar nota' }))

    expect(await screen.findByText('No tienes permiso para anotar llamadas de este asesorado.')).toBeInTheDocument()
    expect(screen.getByLabelText('Qué se habló')).toHaveValue('Algo que se pierde si recarga')
  })
})
