import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/dbInstance'
import { reiniciarFiltroParaPruebas } from './filtroSombreros'

/**
 * La Bandeja del equipo (maqueta 7, paso 9): tareas de la agenda, mensajes que se abren y
 * firmas, en un solo sitio para los tres sombreros. Lo que se comprueba aquí es lo que no se
 * puede perder: que la seguridad salga SIEMPRE (también con un sombrero puesto), que las tres
 * pestañas estén y que cada una lleve a lo que ya existía.
 */

const estado = { rol: 'nutricionista' as string, capacidades: new Set(['leer_entrenamiento']) }

vi.mock('../../app/SessionProvider', () => ({
  useSesion: () => ({
    usuario: { id: 'u-manuela', nombre: 'Manuela', rol: estado.rol, avatarIniciales: 'MA' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  }),
}))
vi.mock('./useCapacidadesVigentes', () => ({
  useCapacidadesVigentes: () => ({
    cargando: false,
    tiene: (c: string) => estado.capacidades.has(c),
  }),
}))
vi.mock('../plan/MiPlanPage', () => ({ default: () => <p>Plan de la persona</p> }))
vi.mock('../coach/consola/BandejaPrimerosPlanes', () => ({
  BandejaPrimerosPlanes: () => <p>Primeros planes por firmar</p>,
}))
vi.mock('../coach/consola/BandejaPlanesRenovados', () => ({
  BandejaPlanesRenovados: () => <p>Planes renovados por firmar</p>,
}))
vi.mock('./MensajesEquipo', () => ({ MensajesEquipo: () => <p>Mensajes del equipo</p> }))

const { default: BandejaPage } = await import('./BandejaPage')

function Sonda() {
  const { pathname } = useLocation()
  return <p>Ruta: {pathname}</p>
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/bandeja']}>
      <Sonda />
      <BandejaPage />
    </MemoryRouter>,
  )
}

describe('la Bandeja del equipo', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarFiltroParaPruebas()
    estado.rol = 'nutricionista'
  })

  it('tiene las tres pestañas de la maqueta: Tareas, Mensajes y Firmas', () => {
    montar()
    const grupo = screen.getByRole('group', { name: 'Qué ver en la Bandeja' })
    expect(Array.from(grupo.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual([
      'Tareas',
      'Mensajes',
      'Firmas',
    ])
  })

  it('abre en Tareas y enseña la agenda que ya existía', () => {
    montar()
    expect(screen.getByText('Plan de la persona')).toBeInTheDocument()
  })

  it('Mensajes lleva a lo que ya existía: el chat y las consultas del coach', async () => {
    estado.rol = 'coach'
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: 'Mensajes' }))
    expect(screen.getByRole('link', { name: /Chat con los asesorados/ })).toHaveAttribute('href', '/coach/chat')
    expect(screen.getByRole('link', { name: /Consultas/ })).toHaveAttribute('href', '/coach/consultas')
    expect(screen.queryByText('Plan de la persona')).not.toBeInTheDocument()
  })

  it('para quien no es coach, Mensajes es el buzón del equipo que ya existe', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: 'Mensajes' }))
    expect(screen.getByText('Mensajes del equipo')).toBeInTheDocument()
  })

  it('Firmas reúne las dos bandejas de siempre, sin inventar una tercera', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: 'Firmas' }))
    expect(screen.getByText('Primeros planes por firmar')).toBeInTheDocument()
    expect(screen.getByText('Planes renovados por firmar')).toBeInTheDocument()
  })

  it('la seguridad sale siempre, también con el sombrero de Nutrición puesto', async () => {
    db.bienestar.guardar({
      id: 'ck-alarma-bandeja',
      usuarioId: 'u-mateo',
      fecha: '2099-01-01',
      dolor: 6,
      dolorDonde: 'hombro derecho',
      entreno: 'Descanso',
    })
    const usuario = userEvent.setup()
    montar()
    expect(screen.getByRole('region', { name: 'Seguridad' })).toHaveTextContent('Mateo')
    expect(screen.getByRole('region', { name: 'Seguridad' })).toHaveTextContent('hombro derecho')

    await usuario.click(screen.getByRole('button', { name: /^Nutrición/ }))
    expect(screen.getByRole('region', { name: 'Seguridad' })).toHaveTextContent('Dolor 6/10')
    // La pestaña de Tareas sí queda filtrada: no es de Nutrición.
    expect(screen.queryByText('Plan de la persona')).not.toBeInTheDocument()
  })

  it('un asesorado no entra: la Bandeja vuelve a Hoy', () => {
    estado.rol = 'asesorado'
    montar()
    expect(screen.getByText('Ruta: /')).toBeInTheDocument()
  })
})
