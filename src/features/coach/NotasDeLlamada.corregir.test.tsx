import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Corregir y borrar desde la pantalla (0114). Aparte de `NotasDeLlamada.test.tsx` porque aquí
 * hace falta saber QUIÉN mira: los botones solo salen en las notas propias.
 */
const listarMock = vi.fn()
const agregarMock = vi.fn()
const corregirMock = vi.fn()
const borrarMock = vi.fn()
const sesion = { id: 'u-manuela' as string | undefined }

vi.mock('../../data/consola/notasLlamada', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/consola/notasLlamada')>()),
  notasLlamadaDe: (...args: unknown[]) => listarMock(...args),
  agregarNotaLlamada: (...args: unknown[]) => agregarMock(...args),
  corregirNotaLlamada: (...args: unknown[]) => corregirMock(...args),
  borrarNotaLlamada: (...args: unknown[]) => borrarMock(...args),
}))

vi.mock('../../data/dbInstance', () => ({
  hoyIso: () => '2026-10-09',
  db: { usuarios: { byId: (id: string) => ({ id, nombre: id === 'u-manuela' ? 'Manuela' : 'Bryan' }) } },
}))

vi.mock('../../app/SessionProvider', () => ({
  useSesionOpcional: () => (sesion.id ? { usuario: { id: sesion.id } } : null),
}))

const { NotasDeLlamada } = await import('./NotasDeLlamada')

const MIA = {
  id: 'n-mia',
  usuarioId: 'u-1',
  coachId: 'u-manuela',
  fecha: '2026-10-08',
  hora: '18:30:00',
  conclusiones: 'Mi nota.',
  tareas: 'Tres comidas.',
  proximaReunion: 'en 2 semanas',
  creadoEn: '2026-10-08T23:30:00Z',
}
const AJENA = { ...MIA, id: 'n-ajena', coachId: 'u-bryan', conclusiones: 'Nota de Bryan.', tareas: null }

/** La tarjeta de UNA nota, para buscar sus botones sin confundirla con la de al lado. */
function tarjetaDe(texto: string): HTMLElement {
  const tarjeta = screen.getByText(texto).parentElement
  if (!tarjeta) throw new Error(`sin tarjeta para «${texto}»`)
  return tarjeta
}

beforeEach(() => {
  sesion.id = 'u-manuela'
  listarMock.mockReset().mockResolvedValue({ ok: true, notas: [MIA, AJENA] })
  agregarMock.mockReset()
  corregirMock.mockReset()
  borrarMock.mockReset()
  window.sessionStorage.clear()
})

describe('NotasDeLlamada · corregir y borrar', () => {
  it('los botones salen SOLO en las notas de quien mira', async () => {
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Mi nota.')

    expect(within(tarjetaDe('Mi nota.')).getByRole('button', { name: /^Corregir la nota/ })).toBeInTheDocument()
    expect(within(tarjetaDe('Mi nota.')).getByRole('button', { name: /^Borrar la nota/ })).toBeInTheDocument()
    expect(within(tarjetaDe('Nota de Bryan.')).queryByRole('button')).toBeNull()
  })

  it('sin sesión nadie es el autor: no sale ningún botón', async () => {
    sesion.id = undefined
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Mi nota.')
    expect(screen.queryByRole('button', { name: /^Corregir la nota/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Borrar la nota/ })).toBeNull()
  })

  it('Corregir carga la nota en el formulario (hora sin segundos) y guarda por la corrección, no como nota nueva', async () => {
    corregirMock.mockResolvedValue({ ok: true, nota: { ...MIA, conclusiones: 'Mi nota, corregida.' } })
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Mi nota.')

    await user.click(screen.getByRole('button', { name: /^Corregir la nota/ }))

    const texto = screen.getByLabelText('Qué se habló')
    expect(texto).toHaveValue('Mi nota.')
    expect(screen.getByLabelText('Tareas que quedan (opcional)')).toHaveValue('Tres comidas.')
    expect(screen.getByLabelText('Hora (opcional)')).toHaveValue('18:30')
    expect(screen.getByLabelText('Fecha')).toHaveValue('2026-10-08')

    await user.clear(texto)
    await user.type(texto, 'Mi nota, corregida.')
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }))

    expect(corregirMock).toHaveBeenCalledTimes(1)
    expect(corregirMock).toHaveBeenCalledWith('n-mia', {
      fecha: '2026-10-08',
      hora: '18:30',
      conclusiones: 'Mi nota, corregida.',
      tareas: 'Tres comidas.',
      proximaReunion: 'en 2 semanas',
    })
    expect(agregarMock).not.toHaveBeenCalled()
  })

  it('una corrección a medias no se guarda como borrador de una nota nueva', async () => {
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Mi nota.')
    await user.click(screen.getByRole('button', { name: /^Corregir la nota/ }))
    await user.type(screen.getByLabelText('Qué se habló'), ' y más')
    expect(window.sessionStorage.getItem('notas-llamada:borrador:u-1')).toBeNull()
  })

  it('Borrar pide un segundo toque; «No» lo deja como estaba', async () => {
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Mi nota.')

    await user.click(screen.getByRole('button', { name: /^Borrar la nota/ }))
    expect(screen.getByText('¿Borrar esta nota? No se puede deshacer.')).toBeInTheDocument()
    expect(borrarMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'No' }))
    expect(screen.queryByText('¿Borrar esta nota? No se puede deshacer.')).toBeNull()
    expect(screen.getByText('Mi nota.')).toBeInTheDocument()
    expect(borrarMock).not.toHaveBeenCalled()
  })

  it('«Sí, borrar» la borra en la base y la quita de la lista', async () => {
    borrarMock.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Mi nota.')

    await user.click(screen.getByRole('button', { name: /^Borrar la nota/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }))

    expect(borrarMock).toHaveBeenCalledWith('n-mia')
    expect(screen.queryByText('Mi nota.')).toBeNull()
    expect(screen.getByText('Nota de Bryan.')).toBeInTheDocument()
  })

  it('si la base no la borra, la nota sigue en pantalla y se dice por qué', async () => {
    borrarMock.mockResolvedValue({ ok: false, error: 'No se pudo borrar la nota. Vuelve a intentarlo.' })
    const user = userEvent.setup()
    render(<NotasDeLlamada usuarioId="u-1" />)
    await screen.findByText('Mi nota.')

    await user.click(screen.getByRole('button', { name: /^Borrar la nota/ }))
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo borrar la nota. Vuelve a intentarlo.')
    expect(screen.getByText('Mi nota.')).toBeInTheDocument()
  })
})
