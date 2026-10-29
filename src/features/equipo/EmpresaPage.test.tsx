import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ponerFiltro, reiniciarFiltroParaPruebas } from './filtroSombreros'

/**
 * EMPRESA (maqueta 7, paso 11): las herramientas de cada sombrero, según los permisos. No se
 * pierde ninguna pantalla que ya existía: cada fila abre la ruta de siempre. Lo que cambia es
 * que estén juntas y que el sombrero las filtre.
 */

const estado = {
  rol: 'nutricionista' as string,
  capacidades: new Set([
    'leer_entrenamiento',
    'aprobar_primer_plan',
    'aprobar_plan_estrategico',
    'organizar_plan',
    'decisiones_compartidas',
    'ver_administracion',
    'responder_mercadeo',
    'revisar_creadores',
  ]),
}

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

const { default: EmpresaPage } = await import('./EmpresaPage')

function Sonda() {
  const { pathname } = useLocation()
  return <p>Ruta: {pathname}</p>
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/empresa']}>
      <Sonda />
      <EmpresaPage />
    </MemoryRouter>,
  )
}

describe('la pantalla Empresa', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarFiltroParaPruebas()
    estado.rol = 'nutricionista'
    estado.capacidades = new Set([
      'leer_entrenamiento',
      'aprobar_primer_plan',
      'aprobar_plan_estrategico',
      'organizar_plan',
      'decisiones_compartidas',
      'ver_administracion',
      'responder_mercadeo',
      'revisar_creadores',
    ])
  })

  it('reúne los tres grupos con sus nombres', () => {
    montar()
    expect(screen.getByRole('heading', { name: 'Empresa' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entrenador' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nutrición' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Administración' })).toBeInTheDocument()
  })

  it('cada herramienta abre la ruta que ya existía, no una copia', () => {
    montar()
    expect(screen.getByRole('link', { name: /Consola del coach/ })).toHaveAttribute('href', '/coach/consola')
    expect(screen.getByRole('link', { name: /Mesa del encoder/ })).toHaveAttribute('href', '/entrenar/encoder')
    expect(screen.getByRole('link', { name: /Nutrición del equipo/ })).toHaveAttribute('href', '/equipo-nutricion')
    expect(screen.getByRole('link', { name: /Estrategias/ })).toHaveAttribute('href', '/coach/estrategias')
    expect(screen.getByRole('link', { name: /Administración/ })).toHaveAttribute('href', '/coach/administracion')
    // `/marca` ya no queda huérfano: es interno y se abre desde Empresa.
    expect(screen.getByRole('link', { name: /Manual de marca/ })).toHaveAttribute('href', '/marca')
  })

  it('la mesa del encoder y Praxis quedan del lado del equipo', () => {
    montar()
    expect(screen.getByRole('link', { name: /Praxis del equipo/ })).toHaveAttribute('href', '/praxis')
  })

  it('H-10: las dos pantallas de Praxis que no tenían entrada se abren desde aquí', () => {
    montar()
    expect(screen.getByRole('link', { name: /Praxis de ejemplo/ })).toHaveAttribute('href', '/praxis/ejemplo')
    expect(screen.getByRole('link', { name: /Prueba de ingreso/ })).toHaveAttribute('href', '/praxis/ingreso-prueba')
  })

  it('29-oct: la nutricionista ve Praxis también con el filtro «Nutrición», sin filas repetidas', () => {
    ponerFiltro('nutricion')
    montar()
    expect(screen.getByRole('link', { name: /Praxis del equipo/ })).toHaveAttribute('href', '/praxis')
    expect(screen.getAllByRole('link', { name: /Praxis del equipo/ })).toHaveLength(1)
  })

  it('29-oct: un asesorado no ve Praxis en Empresa (vuelve a la portada)', () => {
    estado.rol = 'asesorado'
    estado.capacidades = new Set()
    montar()
    expect(screen.queryByRole('link', { name: /Praxis/ })).not.toBeInTheDocument()
    expect(screen.getByText('Ruta: /')).toBeInTheDocument()
  })

  it('sin los permisos de administración, no ofrece esas herramientas (el manual de marca no lo pide)', () => {
    estado.capacidades = new Set(['leer_entrenamiento'])
    montar()
    expect(screen.queryByRole('link', { name: /Estrategias/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Administración/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Creadores/ })).not.toBeInTheDocument()
    // `/marca` solo exige ser del equipo (`SoloEquipo`), y Empresa ya lo exige: el enlace no miente.
    expect(screen.getByRole('link', { name: /Manual de marca/ })).toHaveAttribute('href', '/marca')
  })

  // Revisión ciega del 25-oct (defecto 3): cada enlace de Empresa pide EXACTAMENTE lo que pide
  // la puerta de su pantalla. `decisiones_compartidas` abre Administración, no Estrategias.
  it('no ofrece Estrategias cuando la puerta de /coach/estrategias devolvería esa ruta', () => {
    estado.capacidades = new Set(['decisiones_compartidas', 'ver_administracion'])
    montar()
    expect(screen.getByRole('link', { name: /Administración/ })).toHaveAttribute('href', '/coach/administracion')
    expect(screen.queryByRole('link', { name: /Estrategias/ })).not.toBeInTheDocument()
  })

  it('ofrece Estrategias con responder_mercadeo o con revisar_creadores, cada una por su lado', () => {
    estado.capacidades = new Set(['responder_mercadeo'])
    const a = montar()
    expect(screen.getByRole('link', { name: /Estrategias/ })).toHaveAttribute('href', '/coach/estrategias')
    a.unmount()
    estado.capacidades = new Set(['revisar_creadores'])
    montar()
    expect(screen.getByRole('link', { name: /Estrategias/ })).toHaveAttribute('href', '/coach/estrategias')
  })

  it('al coach le ofrece Estrategias y Creadores sin esas capacidades; Administración solo con ver_administracion', () => {
    estado.rol = 'coach'
    estado.capacidades = new Set()
    const a = montar()
    expect(screen.getByRole('link', { name: /Estrategias/ })).toHaveAttribute('href', '/coach/estrategias')
    expect(screen.getByRole('link', { name: /Creadores/ })).toHaveAttribute('href', '/coach/creadores')
    expect(screen.queryByRole('link', { name: /Administración/ })).not.toBeInTheDocument()
    a.unmount()
    estado.capacidades = new Set(['ver_administracion'])
    montar()
    expect(screen.getByRole('link', { name: /Administración/ })).toHaveAttribute('href', '/coach/administracion')
  })

  it('el filtro de sombrero esconde los otros dos grupos', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: /^Nutrición/ }))
    expect(screen.queryByRole('heading', { name: 'Entrenador' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nutrición' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Administración' })).not.toBeInTheDocument()
  })

  it('«Tus tres sombreros» abre la hoja con lo que firma cada uno y el permiso', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: /Tus tres sombreros/ }))
    const hoja = screen.getByRole('dialog', { name: 'Tus tres sombreros' })
    expect(hoja).toHaveTextContent('Entreno')
    expect(hoja).toHaveTextContent('Nutrición')
    expect(hoja).toHaveTextContent('Administración')
    expect(hoja).toHaveTextContent('riesgo alto')
    expect(hoja).toHaveTextContent('autorizar_excepcion')
  })

  it('un asesorado no entra: Empresa vuelve a Hoy', () => {
    estado.rol = 'asesorado'
    estado.capacidades = new Set()
    montar()
    expect(screen.getByText('Ruta: /')).toBeInTheDocument()
  })
})
