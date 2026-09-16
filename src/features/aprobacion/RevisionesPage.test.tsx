import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RevisionesPage from './RevisionesPage'
import { decidirRevision, reproducirRevision, revisionesPendientes } from '../../data/nube/revisiones'

vi.mock('../../data/nube/revisiones', () => ({ decidirRevision: vi.fn(), reproducirRevision: vi.fn(), revisionesPendientes: vi.fn() }))
vi.mock('../../data/dbInstance', () => ({ useDbVersion: () => 0, db: { usuarios: { byId: () => ({ nombre: 'Persona de prueba' }) } } }))
const revision = { usuario_id: 'prueba', semana: '2026-09-14', path: 'archivo', guion: 'Guion de prueba', tipo: 'video' as const, version: 4, correccion_solicitada: null }
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(revisionesPendientes).mockResolvedValue([revision])
  vi.mocked(reproducirRevision).mockResolvedValue('https://ejemplo.test/video.mp4')
  vi.mocked(decidirRevision).mockResolvedValue()
})
afterEach(cleanup)

describe('revisiones conectadas', () => {
  it('exige abrir y confirmar; firma la versión mostrada', async () => {
    const usuario = userEvent.setup()
    render(<MemoryRouter><RevisionesPage /></MemoryRouter>)
    const aprobar = await screen.findByRole('button', { name: 'Aprobar esta versión' })
    expect(aprobar).toBeDisabled()
    await usuario.click(screen.getByRole('button', { name: 'Abrir video' }))
    fireEvent.play(document.querySelector('video')!)
    await usuario.click(screen.getByRole('checkbox'))
    await usuario.click(aprobar)
    expect(decidirRevision).toHaveBeenCalledWith(revision, true, '')
  })

  it('muestra el conflicto del servidor sin fingir una aprobación', async () => {
    vi.mocked(decidirRevision).mockRejectedValue(new Error('La revisión cambió'))
    const usuario = userEvent.setup()
    render(<MemoryRouter><RevisionesPage /></MemoryRouter>)
    await usuario.click(await screen.findByRole('button', { name: 'Abrir video' }))
    fireEvent.play(document.querySelector('video')!)
    await usuario.click(screen.getByRole('checkbox'))
    await usuario.click(screen.getByRole('button', { name: 'Aprobar esta versión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La revisión cambió')
    expect(revisionesPendientes).toHaveBeenCalledTimes(1)
  })

  it('un error de carga no se presenta como bandeja vacía', async () => {
    vi.mocked(revisionesPendientes).mockRejectedValue(new Error('Sin conexión'))
    render(<MemoryRouter><RevisionesPage /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.queryByText('No hay revisiones pendientes.')).toBeNull()
  })

  it('solicita corrección sin cambiar el guion ni aprobarlo', async () => {
    const usuario = userEvent.setup()
    render(<MemoryRouter><RevisionesPage /></MemoryRouter>)
    await usuario.type(await screen.findByRole('textbox'), 'Revisar la pronunciación')
    await usuario.click(screen.getByRole('button', { name: 'Solicitar corrección' }))
    await waitFor(() => expect(decidirRevision).toHaveBeenCalledWith(revision, false, 'Revisar la pronunciación'))
  })
})
