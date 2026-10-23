import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rol } from '../../domain/types'

/**
 * El «‹» ÚNICO de la cabecera (paso 1 del rediseño, `04 §3.5`): en toda pantalla que no es la raíz de una
 * pestaña, mismo sitio, mismo tamaño (44 px), y a dónde vuelve lo dice la tabla `app/rutas.ts`.
 *
 * Si la pantalla anterior es de la app (la cuenta la lleva `HistoriaInterna`, no `location.key`), vuelve a ELLA
 * con `navigate(-1)` y la etiqueta dice cuál es. Si se entró por un enlace o un aviso, o ya se volvió una vez
 * con `replace`, va al padre declarado: nunca saca a la persona de la app.
 */
const estado = { rol: 'asesorado' as Rol, capacidades: new Set<string>(), cargando: false }

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
  useCapacidades: () => ({ cargando: estado.cargando, tiene: (c: string) => estado.capacidades.has(c), usuarioId: 'u-valentina' }),
}))

const { TopBar } = await import('./TopBar')
const { ThemeProvider } = await import('../../app/ThemeProvider')
const { HistoriaInterna } = await import('../../app/HistoriaInterna')

function Sonda() {
  const { pathname } = useLocation()
  return <output aria-label="ruta actual">{pathname}</output>
}

/** Los botones del «sistema»: atrás y adelante del navegador. */
function Sistema() {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>sistema atrás</button>
      <button type="button" onClick={() => navigate(1)}>sistema adelante</button>
      <button type="button" onClick={() => navigate(location.pathname)}>al mismo sitio</button>
    </>
  )
}

function montar(entradas: string | string[], opciones: { titulo?: string; sinHistoria?: boolean } = {}) {
  const lista = Array.isArray(entradas) ? entradas : [entradas]
  const cuerpo = (
    <Routes>
      <Route
        path="*"
        element={
          <>
            <TopBar titulo={opciones.titulo ?? 'Pantalla'} />
            <Link to="/chat">ir al chat</Link>
            <Link to="/entrenar/sesion/s-1">ir a la sesión</Link>
          </>
        }
      />
    </Routes>
  )
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={lista} initialIndex={lista.length - 1}>
        <Sonda />
        <Sistema />
        {opciones.sinHistoria ? cuerpo : <HistoriaInterna>{cuerpo}</HistoriaInterna>}
      </MemoryRouter>
    </ThemeProvider>,
  )
}

const volver = () => screen.queryByRole('button', { name: /^Volver a / })
const ruta = () => screen.getByLabelText('ruta actual').textContent

afterEach(() => {
  estado.rol = 'asesorado'
  estado.capacidades = new Set()
  estado.cargando = false
})

describe('TopBar: el «‹» único', () => {
  it('en la raíz de una pestaña no hay «‹»', () => {
    for (const r of ['/', '/entrenar', '/progreso', '/nutricion', '/bienestar']) {
      const m = montar(r)
      expect(volver(), r).toBeNull()
      m.unmount()
    }
  })

  it('en una pantalla de detalle lo hay, con el nombre de a dónde vuelve y 44 px de toque', () => {
    montar('/chat', { titulo: 'Chat' })
    const boton = screen.getByRole('button', { name: 'Volver a Hoy' })
    expect(boton.className).toMatch(/min-h-\[44px\]/)
    expect(boton.className).toMatch(/min-w-\[44px\]/)
    expect(boton).toHaveTextContent('Hoy')
  })

  it('el nombre del destino sigue a quien mira: el equipo vuelve a «Mi día»', () => {
    estado.rol = 'nutricionista'
    montar('/chat', { titulo: 'Chat' })
    expect(screen.getByRole('button', { name: 'Volver a Mi día' })).toBeInTheDocument()
  })

  it('entrando por un enlace directo, vuelve al padre declarado', async () => {
    const usuario = userEvent.setup()
    montar('/entrenar/sesion/s-1')
    await usuario.click(screen.getByRole('button', { name: 'Volver a Entrenar' }))
    expect(ruta()).toBe('/entrenar')
  })

  it('si vienes de otra pantalla de la app, vuelve a ESA y la etiqueta dice cuál es', async () => {
    const usuario = userEvent.setup()
    montar('/progreso')
    await usuario.click(screen.getByRole('link', { name: 'ir al chat' }))
    expect(ruta()).toBe('/chat')
    // El padre de /chat es Hoy, pero el «‹» te lleva a donde venías: Progreso. La etiqueta no miente.
    expect(volver()).toHaveAccessibleName('Volver a Progreso')
    expect(volver()).toHaveTextContent('Progreso')
    await usuario.click(volver()!)
    expect(ruta()).toBe('/progreso')
  })

  it('la sesión: entrando desde Hoy el «‹» vuelve a Hoy; entrando desde la Ruta, a la Ruta (decisión de Bryan, 23-oct)', async () => {
    const usuario = userEvent.setup()
    const desdeHoy = montar('/')
    await usuario.click(screen.getByRole('link', { name: 'ir a la sesión' }))
    expect(ruta()).toBe('/entrenar/sesion/s-1')
    expect(volver()).toHaveAccessibleName('Volver a Hoy')
    await usuario.click(volver()!)
    expect(ruta()).toBe('/')
    desdeHoy.unmount()

    montar('/entrenar')
    await usuario.click(screen.getByRole('link', { name: 'ir a la sesión' }))
    expect(volver()).toHaveAccessibleName('Volver a Entrenar')
    await usuario.click(volver()!)
    expect(ruta()).toBe('/entrenar')
  })

  it('«replace» de verdad sustituye la entrada: el atrás del sistema no vuelve a la pantalla de la que se salió', async () => {
    const usuario = userEvent.setup()
    montar(['/progreso', '/entrenar/sesion/s-1'])
    await usuario.click(screen.getByRole('button', { name: 'Volver a Entrenar' }))
    expect(ruta()).toBe('/entrenar')
    await usuario.click(screen.getByRole('button', { name: 'sistema atrás' }))
    expect(ruta()).toBe('/progreso')
    await usuario.click(screen.getByRole('button', { name: 'sistema adelante' }))
    expect(ruta()).toBe('/entrenar') // y no /entrenar/sesion/s-1
  })

  it('una cadena de DOS niveles por enlace directo sube nivel a nivel y nunca sale de la app', async () => {
    const usuario = userEvent.setup()
    estado.rol = 'nutricionista'
    // La entrada de antes (/progreso) está FUERA de lo que la app recorrió: el «‹» no puede ir a ella.
    montar(['/progreso', '/equipo-nutricion/cifras'])
    expect(volver()).toHaveAccessibleName('Volver a Nutrición del equipo')
    await usuario.click(volver()!)
    expect(ruta()).toBe('/equipo-nutricion')
    expect(volver()).toHaveAccessibleName('Volver a Equipo')
    await usuario.click(volver()!)
    expect(ruta()).toBe('/equipo')
    expect(volver()).toBeNull()
  })

  it('lo mismo con una ficha: /coach/asesorado/:id → cartera → Hoy', async () => {
    const usuario = userEvent.setup()
    estado.rol = 'coach'
    montar(['/progreso', '/coach/asesorado/u-valentina'])
    await usuario.click(volver()!)
    expect(ruta()).toBe('/coach/asesorados')
    await usuario.click(volver()!)
    expect(ruta()).toBe('/')
  })

  it('tras volver por el atrás del sistema, el «‹» sigue contando bien la historia', async () => {
    const usuario = userEvent.setup()
    montar('/progreso')
    await usuario.click(screen.getByRole('link', { name: 'ir al chat' }))
    await usuario.click(screen.getByRole('button', { name: 'sistema atrás' }))
    expect(ruta()).toBe('/progreso')
    await usuario.click(screen.getByRole('button', { name: 'sistema adelante' }))
    expect(volver()).toHaveAccessibleName('Volver a Progreso')
  })

  it('sin la cuenta de historia (TopBar suelto) cae siempre al padre declarado', async () => {
    const usuario = userEvent.setup()
    montar('/progreso', { sinHistoria: true })
    await act(async () => void (await usuario.click(screen.getByRole('link', { name: 'ir al chat' }))))
    expect(volver()).toHaveAccessibleName('Volver a Hoy')
  })

  it('si la pantalla anterior es LA MISMA dirección (entrada repetida), no se «vuelve» a ella: va al padre', async () => {
    const usuario = userEvent.setup()
    montar('/chat')
    await usuario.click(screen.getByRole('button', { name: 'al mismo sitio' }))
    expect(ruta()).toBe('/chat')
    expect(volver()).toHaveAccessibleName('Volver a Hoy')
    await usuario.click(volver()!)
    expect(ruta()).toBe('/')
  })

  it('una dirección que la app no conoce no inventa un «‹»', () => {
    montar('/no-existe')
    expect(volver()).toBeNull()
  })

  it('la cuenta Alpha (solo_tablero) no tiene a dónde volver: sin «‹» en el tablero', () => {
    estado.rol = 'coach'
    estado.capacidades = new Set(['solo_tablero'])
    montar('/tablero', { titulo: 'Alpha · Tablero' })
    expect(volver()).toBeNull()
  })

  it('Bryan (cuenta personal) sí vuelve desde el tablero', () => {
    estado.capacidades = new Set(['puesto_de_coach'])
    montar('/tablero', { titulo: 'Alpha · Tablero' })
    expect(screen.getByRole('button', { name: 'Volver a Mi día' })).toBeInTheDocument()
  })

  it('mientras se consultan los permisos no se pinta (no se sabe a quién se le dice «Hoy» o «Mi día»)', () => {
    estado.cargando = true
    estado.capacidades = new Set(['solo_tablero'])
    montar('/tablero', { titulo: 'Alpha · Tablero' })
    expect(volver()).toBeNull()
  })

  it('conserva el título, el tema y el menú de la cuenta', () => {
    montar('/chat', { titulo: 'Chat' })
    expect(screen.getByRole('heading', { level: 1, name: 'Chat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cambiar a tema/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar usuario' })).toBeInTheDocument()
  })
})
