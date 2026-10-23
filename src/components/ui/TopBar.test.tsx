import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rol } from '../../domain/types'

/**
 * El «‹» ÚNICO de la cabecera (paso 1 del rediseño, `04 §3.5`): en toda pantalla que no es la raíz de una
 * pestaña, mismo sitio, mismo tamaño (44 px), y a dónde vuelve lo dice la tabla `app/rutas.ts`.
 *
 * Si hay una pantalla anterior DENTRO de la app, vuelve a ella (`navigate(-1)`: de Hoy a la sesión y de
 * vuelta a Hoy). Si se entró por un enlace directo o un aviso, va al padre declarado, con `replace`.
 */
const estado = { rol: 'asesorado' as Rol, capacidades: new Set<string>() }

vi.mock('../../app/SessionProvider', () => ({
  useSesion: () => ({
    usuario: { id: 'u-valentina', nombre: 'Persona', rol: estado.rol, avatarIniciales: 'PE' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  }),
  useSesionOpcional: () => null,
}))
vi.mock('../../features/coach/consola/useCapacidades', () => ({
  useCapacidades: () => ({ cargando: false, tiene: (c: string) => estado.capacidades.has(c), usuarioId: 'u-valentina' }),
}))

const { TopBar } = await import('./TopBar')
const { ThemeProvider } = await import('../../app/ThemeProvider')

function Sonda() {
  const { pathname, key } = useLocation()
  return <output aria-label="ruta actual">{`${pathname}#${key === 'default' ? 'directa' : 'dentro'}`}</output>
}

function montar(rutaInicial: string, titulo = 'Pantalla') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[rutaInicial]}>
        <Sonda />
        <Routes>
          <Route path="*" element={<><TopBar titulo={titulo} /><Link to="/chat">ir al chat</Link><Link to="/entrenar/sesion/s-1">ir a la sesión</Link></>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

const volver = () => screen.queryByRole('button', { name: /^Volver a / })

afterEach(() => {
  estado.rol = 'asesorado'
  estado.capacidades = new Set()
})

describe('TopBar: el «‹» único', () => {
  it('en la raíz de una pestaña no hay «‹»', () => {
    for (const ruta of ['/', '/entrenar', '/progreso', '/nutricion', '/bienestar']) {
      const r = montar(ruta)
      expect(volver(), ruta).toBeNull()
      r.unmount()
    }
  })

  it('en una pantalla de detalle lo hay, con el nombre de a dónde vuelve y 44 px de toque', () => {
    montar('/chat', 'Chat')
    const boton = screen.getByRole('button', { name: 'Volver a Hoy' })
    expect(boton.className).toMatch(/min-h-\[44px\]/)
    expect(boton.className).toMatch(/min-w-\[44px\]/)
    expect(boton).toHaveTextContent('Hoy')
  })

  it('el nombre del destino sigue a quien mira: el equipo vuelve a «Mi día»', () => {
    estado.rol = 'nutricionista'
    montar('/chat', 'Chat')
    expect(screen.getByRole('button', { name: 'Volver a Mi día' })).toBeInTheDocument()
  })

  it('entrando por un enlace directo, vuelve al padre declarado y sustituye la entrada', async () => {
    const usuario = userEvent.setup()
    montar('/entrenar/sesion/s-1', 'Sesión')
    expect(screen.getByLabelText('ruta actual')).toHaveTextContent('/entrenar/sesion/s-1#directa')
    await usuario.click(screen.getByRole('button', { name: 'Volver a Entrenar' }))
    expect(screen.getByLabelText('ruta actual').textContent).toMatch(/^\/entrenar#/)
  })

  it('si vienes de otra pantalla de la app, vuelve a ESA, no al padre', async () => {
    const usuario = userEvent.setup()
    montar('/progreso')
    await usuario.click(screen.getByRole('link', { name: 'ir al chat' }))
    expect(screen.getByLabelText('ruta actual')).toHaveTextContent('/chat#dentro')
    await usuario.click(screen.getByRole('button', { name: 'Volver a Hoy' }))
    expect(screen.getByLabelText('ruta actual').textContent).toMatch(/^\/progreso#/)
  })

  it('una dirección que la app no conoce no inventa un «‹»', () => {
    montar('/no-existe')
    expect(volver()).toBeNull()
  })

  it('la cuenta Alpha (solo_tablero) no tiene a dónde volver: sin «‹» en el tablero', () => {
    estado.rol = 'coach'
    estado.capacidades = new Set(['solo_tablero'])
    montar('/tablero', 'Alpha · Tablero')
    expect(volver()).toBeNull()
  })

  it('Bryan (cuenta personal) sí vuelve desde el tablero', () => {
    estado.capacidades = new Set(['puesto_de_coach'])
    montar('/tablero', 'Alpha · Tablero')
    expect(screen.getByRole('button', { name: 'Volver a Mi día' })).toBeInTheDocument()
  })

  it('conserva el título, el tema y el menú de la cuenta', () => {
    montar('/chat', 'Chat')
    expect(screen.getByRole('heading', { level: 1, name: 'Chat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cambiar a tema/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar usuario' })).toBeInTheDocument()
  })
})
