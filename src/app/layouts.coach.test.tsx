import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rol } from '../domain/types'

/**
 * El coach en el layout de «espacios» (`AsesoradoLayout`): su teléfono lleva la barra de cinco
 * espacios, abre Mi día y Mi entreno, y lo demás de la app de asesorado lo devuelve a su panel.
 * La cuenta «Alpha» (`solo_tablero`) no tiene espacios: todo la lleva a /tablero, que es la consola a
 * pantalla completa y sin barra. El asesorado no ve nada de staff; Manuela conserva lo suyo.
 */
const estado = { rol: 'coach' as Rol, cargando: false, capacidades: new Set<string>() }

vi.mock('./SessionProvider', () => ({
  useSesion: () => ({
    usuario: { id: 'u-1', nombre: 'Persona', rol: estado.rol, avatarIniciales: 'PE' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  }),
  useSesionOpcional: () => null,
}))
vi.mock('../features/coach/consola/useCapacidades', () => ({
  useCapacidades: () => ({ cargando: estado.cargando, tiene: (c: string) => estado.capacidades.has(c), usuarioId: 'u-1' }),
}))
vi.mock('../components/ui/TopBar', () => ({ TopBar: ({ titulo }: { titulo: string }) => <h1>{titulo}</h1> }))
vi.mock('../features/plan/BannerPlanHoy', () => ({ BannerPlanHoy: () => null }))
vi.mock('../features/bienestar/recordatorio', () => ({ revisarRecordatorioBienestar: () => Promise.resolve() }))

const { AsesoradoLayout, TableroLayout } = await import('./layouts')

function en(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/tablero" element={<TableroLayout />}>
          <Route index element={<p>Contenido del tablero</p>} />
        </Route>
        <Route element={<AsesoradoLayout />}>
          <Route index element={<p>Inicio</p>} />
          <Route path="mi-entreno" element={<p>Entreno</p>} />
          <Route path="equipo" element={<p>Equipo página</p>} />
          <Route path="nutricion" element={<p>Nutrición asesorado</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function hrefs(): (string | null)[] {
  const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
  return Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'))
}

afterEach(() => {
  estado.rol = 'coach'
  estado.cargando = false
  estado.capacidades = new Set()
})

describe('AsesoradoLayout · el coach', () => {
  it('en el teléfono, «/» es su Mi día y lleva la barra de cinco espacios', () => {
    estado.capacidades = new Set(['ver_administracion', 'responder_mercadeo'])
    en('/')
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mi día' })).toBeInTheDocument()
    expect(hrefs()).toEqual(['/', '/mi-entreno', '/equipo', '/coach/estrategias', '/coach/administracion'])
  })

  it('la cuenta personal ve lo mismo en escritorio y en teléfono: «/» no depende del ancho', () => {
    // El ancho ya no decide nada: ni matchMedia hace falta.
    estado.capacidades = new Set(['ver_administracion'])
    en('/')
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(hrefs()).toEqual(['/', '/mi-entreno', '/equipo', '/coach/administracion'])
  })

  it('la cuenta «Alpha» (solo_tablero): «/» y Mi entreno la llevan al tablero, sin barra de espacios', () => {
    estado.capacidades = new Set(['solo_tablero', 'ver_administracion'])
    for (const ruta of ['/', '/mi-entreno', '/equipo', '/nutricion']) {
      const r = en(ruta)
      expect(screen.getByText('Contenido del tablero'), ruta).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      r.unmount()
    }
  })

  it('al coach no se le pinta Mi día mientras se consultan sus capacidades', () => {
    estado.cargando = true
    en('/')
    expect(screen.getByText('Comprobando tu acceso…')).toBeInTheDocument()
    expect(screen.queryByText('Inicio')).not.toBeInTheDocument()
  })

  it('Mi entreno y Equipo son suyos; el resto de la app de asesorado, no', () => {
    const a = en('/mi-entreno')
    expect(screen.getByText('Entreno')).toBeInTheDocument()
    a.unmount()
    const b = en('/equipo')
    expect(screen.getByText('Equipo página')).toBeInTheDocument()
    b.unmount()
    en('/nutricion')
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText('Nutrición asesorado')).not.toBeInTheDocument()
  })

  it('sin capacidad de administración ni de estrategia, esos espacios no se ofrecen', () => {
    en('/')
    expect(hrefs()).toEqual(['/', '/mi-entreno', '/equipo'])
  })
})

describe('AsesoradoLayout · los demás', () => {
  it('Manuela conserva sus cinco espacios, sin mirar capacidades', () => {
    estado.rol = 'nutricionista'
    en('/')
    expect(hrefs()).toEqual(['/', '/mi-entreno', '/equipo', '/coach/estrategias', '/coach/administracion'])
  })

  it('el asesorado nunca ve nada de staff', () => {
    estado.rol = 'asesorado'
    estado.capacidades = new Set(['ver_administracion', 'responder_mercadeo', 'leer_entrenamiento'])
    en('/')
    expect(hrefs()).toEqual(['/', '/entrenar', '/bienestar', '/nutricion', '/progreso'])
    expect(screen.queryByText(/Estrategias|Administración|Equipo|Mi entreno/)).not.toBeInTheDocument()
  })
})

describe('TableroLayout', () => {
  it('la cuenta personal también lo abre, con un enlace para volver a sus espacios', () => {
    estado.capacidades = new Set(['leer_entrenamiento'])
    en('/tablero')
    expect(screen.getByText('Contenido del tablero')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a mis espacios' })).toHaveAttribute('href', '/')
  })

  it('la cuenta Alpha no tiene a dónde volver: ni barra ni enlaces', () => {
    estado.capacidades = new Set(['solo_tablero'])
    en('/tablero')
    expect(screen.getByText('Contenido del tablero')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('Manuela con leer_entrenamiento lo abre; sin ella, vuelve a su inicio; un asesorado, también', () => {
    estado.rol = 'nutricionista'
    estado.capacidades = new Set(['leer_entrenamiento'])
    const a = en('/tablero')
    expect(screen.getByText('Contenido del tablero')).toBeInTheDocument()
    a.unmount()
    estado.capacidades = new Set()
    const b = en('/tablero')
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    b.unmount()
    estado.rol = 'asesorado'
    estado.capacidades = new Set()
    en('/tablero')
    expect(screen.queryByText('Contenido del tablero')).not.toBeInTheDocument()
  })
})
