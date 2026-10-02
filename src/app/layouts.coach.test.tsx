import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rol } from '../domain/types'

/**
 * El coach en el layout de «espacios» (`AsesoradoLayout`): su teléfono lleva la barra de cinco
 * espacios, abre Mi día y Mi entreno, y lo demás de la app de asesorado lo devuelve a su panel.
 * El asesorado no ve nada de staff; Manuela conserva lo suyo.
 */
const estado = { rol: 'coach' as Rol, escritorio: false, capacidades: new Set<string>() }

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
  useCapacidades: () => ({ cargando: false, tiene: (c: string) => estado.capacidades.has(c), usuarioId: 'u-1' }),
}))
vi.mock('../components/ui/TopBar', () => ({ TopBar: ({ titulo }: { titulo: string }) => <h1>{titulo}</h1> }))
vi.mock('../features/plan/BannerPlanHoy', () => ({ BannerPlanHoy: () => null }))
vi.mock('../features/bienestar/recordatorio', () => ({ revisarRecordatorioBienestar: () => Promise.resolve() }))

const { AsesoradoLayout } = await import('./layouts')

function en(ruta: string) {
  window.matchMedia = ((q: string) => ({
    matches: estado.escritorio && q.includes('1024'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as never
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/coach" element={<p>Panel del coach</p>} />
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
  estado.escritorio = false
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

  it('en escritorio, «/» lo manda al marco Alpha (/coach)', () => {
    estado.escritorio = true
    en('/')
    expect(screen.getByText('Panel del coach')).toBeInTheDocument()
  })

  it('Mi entreno y Equipo son suyos; el resto de la app de asesorado, no', () => {
    const a = en('/mi-entreno')
    expect(screen.getByText('Entreno')).toBeInTheDocument()
    a.unmount()
    const b = en('/equipo')
    expect(screen.getByText('Equipo página')).toBeInTheDocument()
    b.unmount()
    en('/nutricion')
    expect(screen.getByText('Panel del coach')).toBeInTheDocument()
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
