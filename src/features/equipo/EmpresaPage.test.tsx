import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reiniciarFiltroParaPruebas } from './filtroSombreros'

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
  })

  it('la mesa del encoder y Praxis quedan del lado del equipo', () => {
    montar()
    expect(screen.getByRole('link', { name: /Praxis del equipo/ })).toHaveAttribute('href', '/praxis')
  })

  it('sin los permisos de administración, ese grupo no se pinta', () => {
    estado.capacidades = new Set(['leer_entrenamiento'])
    montar()
    expect(screen.queryByRole('heading', { name: 'Administración' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Estrategias/ })).not.toBeInTheDocument()
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
