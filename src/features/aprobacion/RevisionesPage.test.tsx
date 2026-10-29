import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RevisionesPage from './RevisionesPage'
import { decidirRevision, historialDeFirma, reproducirRevision, revisionesPendientes } from '../../data/nube/revisiones'

vi.mock('../../data/nube/revisiones', () => ({ decidirRevision: vi.fn(), reproducirRevision: vi.fn(), revisionesPendientes: vi.fn(), historialDeFirma: vi.fn() }))
vi.mock('../../data/dbInstance', () => ({ useDbVersion: () => 0, db: { usuarios: { byId: () => ({ nombre: 'Persona de prueba' }) } } }))
const revision = { usuario_id: 'prueba', semana: '2026-09-14', path: 'archivo', guion: 'Guion de prueba', tipo: 'video' as const, version: 4, correccion_solicitada: null }
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(revisionesPendientes).mockResolvedValue([revision])
  vi.mocked(reproducirRevision).mockResolvedValue('https://ejemplo.test/video.mp4')
  vi.mocked(decidirRevision).mockResolvedValue()
  vi.mocked(historialDeFirma).mockResolvedValue({ semanas: [], enCurso: null })
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

describe('revisiones: la salida', () => {
  it('no repite un «Volver al panel»: el «‹» de la cabecera (Mi día) ya lo es', async () => {
    render(<MemoryRouter><RevisionesPage /></MemoryRouter>)
    await screen.findByRole('button', { name: 'Aprobar esta versión' })
    expect(screen.queryByRole('link', { name: /Volver/ })).toBeNull()
  })
})

describe('revisiones: la puerta de la salida automática', () => {
  const limpia = (fecha: string) => ({ fecha, borradores: 6, aprobadosSinTocar: 6, corregidos: 0 })

  it('enseña cuántas semanas lleva limpia la firma y por qué sigue cerrada', async () => {
    vi.mocked(historialDeFirma).mockResolvedValue({ semanas: [limpia('2026-10-05'), limpia('2026-10-12')], enCurso: null })
    render(<MemoryRouter><RevisionesPage /></MemoryRouter>)
    expect(await screen.findByText(/Llevas 2 de 4 semanas/)).toBeTruthy()
    expect(document.querySelector('[data-puerta="cerrada"]')).not.toBeNull()
  })

  it('aunque esté abierta, dice que el envío automático no está encendido y la firma sigue a mano', async () => {
    vi.mocked(historialDeFirma).mockResolvedValue({
      semanas: ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'].map(limpia), enCurso: null })
    render(<MemoryRouter><RevisionesPage /></MemoryRouter>)
    expect(await screen.findByText(/Abierta desde la semana del 2026-10-12/)).toBeTruthy()
    expect(screen.getByText(/firma sigue siendo a mano/i)).toBeTruthy()
    expect(screen.queryByText(/sin que los mires/)).toBeNull()
    // H9: con la puerta abierta NO se envía nada sin clic: ni al cargar, ni al reproducir y
    // marcar la casilla; solo el clic en «Aprobar» llama a decidirRevision.
    const aprobar = await screen.findByRole('button', { name: 'Aprobar esta versión' })
    expect(aprobar).toBeDisabled()
    expect(decidirRevision).not.toHaveBeenCalled()
    const usuario = userEvent.setup()
    await usuario.click(screen.getByRole('button', { name: 'Abrir video' }))
    fireEvent.play(document.querySelector('video')!)
    await usuario.click(screen.getByRole('checkbox'))
    expect(aprobar).toBeEnabled()
    expect(decidirRevision).not.toHaveBeenCalled()
    await usuario.click(aprobar)
    expect(decidirRevision).toHaveBeenCalledTimes(1)
    expect(decidirRevision).toHaveBeenCalledWith(revision, true, '')
  })

  it('H5: la semana en curso se enseña como «en curso» y no como «sin mirar»', async () => {
    vi.mocked(historialDeFirma).mockResolvedValue({
      semanas: ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'].map(limpia),
      enCurso: { fecha: '2026-10-26', borradores: 23, aprobadosSinTocar: 10, corregidos: 4, firmados: 14 },
    })
    render(<MemoryRouter><RevisionesPage /></MemoryRouter>)
    expect(await screen.findByText(/Semana en curso.*14 de 23/)).toBeTruthy()
    expect(screen.queryByText(/sin abrir/)).toBeNull()
    expect(document.querySelector('[data-puerta="abierta"]')).not.toBeNull()
  })

  it('dice en pantalla los límites de los datos: correcciones contra todos, versión rehecha, firmas antiguas', async () => {
    render(<MemoryRouter><RevisionesPage /></MemoryRouter>)
    const aviso = await screen.findByText(/anteriores a la identificación del firmante/)
    expect(aviso.textContent).toMatch(/corrección.*todos los firmantes/)
    expect(aviso.textContent).toMatch(/versión rehecha cuenta como corregida/)
  })

  it('abierta: dice que una corrección de esta semana cierra la puerta cuando la semana termine', async () => {
    vi.mocked(historialDeFirma).mockResolvedValue({
      semanas: ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'].map(limpia), enCurso: null })
    render(<MemoryRouter><RevisionesPage /></MemoryRouter>)
    expect(await screen.findByText(/cuando la semana termine/)).toBeTruthy()
    expect(screen.queryByText(/vuelve a cerrarla/)).toBeNull()
  })

  it('si el historial no carga, lo dice y la firma sigue disponible', async () => {
    vi.mocked(historialDeFirma).mockRejectedValue(new Error('Sin historial'))
    render(<MemoryRouter><RevisionesPage /></MemoryRouter>)
    expect(await screen.findByText(/No se pudo calcular la puerta/)).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Aprobar esta versión' })).toBeTruthy()
  })
})
