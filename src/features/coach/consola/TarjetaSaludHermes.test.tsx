import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reiniciarDb } from '../../../data/mockDb'
import { reiniciarFiltroParaPruebas } from '../../equipo/filtroSombreros'

/** La tarjeta de salud de Hermes en «Mi día»: SIN SEÑAL en alarma, y solo para el puesto de coach. */

const AHORA = Date.parse('2026-10-30T12:00:00Z')
const hace = (min: number) => new Date(AHORA - min * 60_000).toISOString()
const fila = (pieza: string, estado: string, min: number) => ({ pieza, estado, vistoEn: hace(min) })

const estado = { rol: 'coach', filas: [] as ReturnType<typeof fila>[] | null }

vi.mock('../../../data/nube/saludHermes', () => ({
  traerSaludHermes: () => Promise.resolve(estado.filas),
}))
vi.mock('../../../app/SessionProvider', () => ({
  useSesion: () => ({
    usuario: { id: 'u', nombre: 'Staff', rol: estado.rol, avatarIniciales: 'ST' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  }),
}))
vi.mock('../../equipo/useCapacidadesVigentes', () => ({
  useCapacidadesVigentes: () => ({ cargando: false, tiene: () => false }),
}))
vi.mock('../../plan/MiPlanPage', () => ({ default: () => <p>Tareas del plan</p> }))
vi.mock('./BandejaPrimerosPlanes', () => ({ BandejaPrimerosPlanes: () => <p>Primeros planes</p> }))
vi.mock('./BandejaPlanesRenovados', () => ({ BandejaPlanesRenovados: () => <p>Planes renovados</p> }))

const { TarjetaSaludHermes } = await import('./TarjetaSaludHermes')
const { default: MiDiaCoachPage } = await import('../MiDiaCoachPage')

const bien = (min: number) => [fila('puerta', 'arriba', min), fila('hermes', 'arriba', min), fila('custodio', 'arriba', min)]
const tarjeta = () => render(<TarjetaSaludHermes ahora={() => AHORA} />)

describe('tarjeta de salud de Hermes', () => {
  beforeEach(() => {
    reiniciarDb()
    reiniciarFiltroParaPruebas()
    estado.rol = 'coach'
    estado.filas = []
  })

  it('sin filas: SIN SEÑAL en alarma', async () => {
    estado.filas = []
    tarjeta()
    const alarma = await screen.findByRole('alert')
    expect(alarma).toHaveTextContent(/sin señal del minipc/i)
  })

  it('todo «arriba» pero de hace 46 minutos: SIN SEÑAL, no «al día»', async () => {
    estado.filas = bien(46)
    tarjeta()
    expect(await screen.findByRole('alert')).toHaveTextContent(/sin señal del minipc/i)
    expect(screen.queryByText(/al día/i)).not.toBeInTheDocument()
  })

  it('todo bien y reciente: no molesta, solo una línea discreta', async () => {
    estado.filas = bien(5)
    tarjeta()
    expect(await screen.findByText(/Hermes al día · visto hace 5 min/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('pieza caída: la nombra y dice qué hacer', async () => {
    estado.filas = [fila('puerta', 'arriba', 2), fila('hermes', 'arriba', 2), fila('custodio', 'caido', 2)]
    tarjeta()
    const alarma = await screen.findByRole('alert')
    expect(alarma).toHaveTextContent(/custodio/)
    expect(alarma).toHaveTextContent(/Alpha-Custodio-Servir/)
    expect(alarma).not.toHaveTextContent(/sin señal/i)
  })

  it('modo demo (sin nube): no pinta nada', async () => {
    estado.filas = null
    const { container } = tarjeta()
    await Promise.resolve()
    expect(container).toBeEmptyDOMElement()
  })
})

describe('«Mi día»: solo el puesto de coach la ve', () => {
  beforeEach(() => {
    reiniciarDb()
    reiniciarFiltroParaPruebas()
    estado.filas = []
  })

  it('el coach ve la alarma de SIN SEÑAL', async () => {
    estado.rol = 'coach'
    render(<MemoryRouter><MiDiaCoachPage /></MemoryRouter>)
    expect(await screen.findByText(/sin señal del minipc/i)).toBeInTheDocument()
  })

  it('la nutricionista no la ve', async () => {
    estado.rol = 'nutricionista'
    render(<MemoryRouter><MiDiaCoachPage /></MemoryRouter>)
    await screen.findByText('Mi día')
    await Promise.resolve()
    expect(screen.queryByText(/sin señal del minipc/i)).not.toBeInTheDocument()
  })
})
