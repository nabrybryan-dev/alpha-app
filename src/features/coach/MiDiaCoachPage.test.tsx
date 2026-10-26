import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import { reiniciarFiltroParaPruebas } from '../equipo/filtroSombreros'

/**
 * El HOY DEL EQUIPO (maqueta 7, paso 9): la banda de trabajo de los tres sombreros, con la
 * seguridad siempre delante y su propio entreno a un toque. Lo que ya existía (firmas,
 * revisiones, consultas, creadores y el plan) sigue estando y sigue yendo a su pantalla.
 */

const estado = {
  rol: 'coach',
  capacidades: new Set(['leer_entrenamiento', 'revisar_creadores', 'organizar_plan']),
}

vi.mock('../../app/SessionProvider', () => ({
  useSesion: () => ({
    usuario: { id: estado.rol === 'coach' ? 'u-bryan' : 'u-manuela', nombre: 'Staff', rol: estado.rol, avatarIniciales: 'ST' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  }),
}))
vi.mock('../equipo/useCapacidadesVigentes', () => ({
  useCapacidadesVigentes: () => ({ cargando: false, tiene: (c: string) => estado.capacidades.has(c) }),
}))
vi.mock('../plan/MiPlanPage', () => ({ default: () => <p>Tareas del plan</p> }))
vi.mock('../coach/consola/BandejaPrimerosPlanes', () => ({
  BandejaPrimerosPlanes: () => <p>Primeros planes</p>,
}))
vi.mock('../coach/consola/BandejaPlanesRenovados', () => ({
  BandejaPlanesRenovados: () => <p>Planes renovados</p>,
}))

const { default: MiDiaCoachPage } = await import('./MiDiaCoachPage')

function montar() {
  return render(
    <MemoryRouter>
      <MiDiaCoachPage />
    </MemoryRouter>,
  )
}

describe('el Hoy del equipo', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
    reiniciarFiltroParaPruebas()
    estado.rol = 'coach'
    estado.capacidades = new Set(['leer_entrenamiento', 'revisar_creadores', 'organizar_plan'])
  })

  it('trae los tres sombreros y la seguridad, siempre', () => {
    montar()
    expect(screen.getByRole('group', { name: 'Ver por sombrero' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Seguridad' })).toHaveTextContent('Sin alertas de dolor')
  })

  // Revisión ciega del 25-oct (defecto 2): «Mi día» pasaba `conNombres` siempre y la
  // nutricionista sin `leer_entrenamiento` veía nombres y dolor de toda la cartera desde «/».
  it('la nutricionista sin leer_entrenamiento no ve nombres ni dolor en la Seguridad', () => {
    estado.rol = 'nutricionista'
    estado.capacidades = new Set(['aprobar_primer_plan'])
    db.bienestar.guardar({
      id: 'ck-alarma-sin-permiso',
      usuarioId: 'u-sara',
      fecha: '2099-01-01',
      dolor: 5,
      dolorDonde: 'rodilla',
      entreno: 'Descanso',
    })
    montar()
    const seguridad = screen.getByRole('region', { name: 'Seguridad' })
    expect(seguridad).toHaveTextContent(/permiso de leer el entrenamiento/)
    expect(seguridad).not.toHaveTextContent('Sara Duque')
    expect(seguridad).not.toHaveTextContent('Dolor 5/10')
  })

  it('el coach sí ve la alerta con nombre y dolor (la misma que antes)', () => {
    db.bienestar.guardar({
      id: 'ck-alarma-con-permiso',
      usuarioId: 'u-sara',
      fecha: '2099-01-01',
      dolor: 5,
      dolorDonde: 'rodilla',
      entreno: 'Descanso',
    })
    montar()
    const seguridad = screen.getByRole('region', { name: 'Seguridad' })
    expect(seguridad).toHaveTextContent('Sara Duque')
    expect(seguridad).toHaveTextContent('Dolor 5/10 · rodilla')
  })

  it('conserva el trabajo de siempre: firmas, revisiones, consultas, creadores y plan', () => {
    montar()
    expect(screen.getByText('Primeros planes')).toBeInTheDocument()
    expect(screen.getByText('Planes renovados')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Prescripciones y revisiones/ })).toHaveAttribute('href', '/coach/revisiones')
    expect(screen.getByRole('link', { name: /Preguntas de asesorados/ })).toHaveAttribute('href', '/coach/consultas')
    expect(screen.getByRole('link', { name: /Creadores por desempatar/ })).toHaveAttribute('href', '/coach/creadores')
    expect(screen.getByText('Tareas del plan')).toBeInTheDocument()
  })

  it('lleva a la Bandeja y a Empresa, y a su propio entreno (Yo)', () => {
    montar()
    expect(screen.getByRole('link', { name: /Abrir la Bandeja/ })).toHaveAttribute('href', '/bandeja')
    expect(screen.getByRole('link', { name: /Ir a Empresa/ })).toHaveAttribute('href', '/empresa')
    expect(screen.getByRole('link', { name: /Tu entreno/ })).toHaveAttribute('href', '/mi-entreno')
  })

  it('con el sombrero de Nutrición puesto, quedan las firmas y se va lo de entreno', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: /^Nutrición/ }))
    expect(screen.getByText('Primeros planes')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Prescripciones y revisiones/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Tareas del plan')).not.toBeInTheDocument()
    // La seguridad no se filtra.
    expect(screen.getByRole('region', { name: 'Seguridad' })).toBeInTheDocument()
  })

  it('con el de Administración puesto, quedan las tareas y las creadoras', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: /^Administración/ }))
    expect(screen.getByText('Tareas del plan')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Creadores por desempatar/ })).toBeInTheDocument()
    expect(screen.queryByText('Primeros planes')).not.toBeInTheDocument()
  })

  it('una alerta de dolor se ve aunque el filtro esté en Administración', async () => {
    db.bienestar.guardar({
      id: 'ck-alarma-hoy',
      usuarioId: 'u-sara',
      fecha: '2099-01-01',
      dolor: 5,
      dolorDonde: 'rodilla',
      entreno: 'Descanso',
    })
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: /^Administración/ }))
    expect(screen.getByRole('region', { name: 'Seguridad' })).toHaveTextContent('Sara Duque')
    expect(screen.getByRole('region', { name: 'Seguridad' })).toHaveTextContent('Dolor 5/10 · rodilla')
  })
})
