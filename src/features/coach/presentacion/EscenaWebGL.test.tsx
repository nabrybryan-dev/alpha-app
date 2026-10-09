import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanEstrategico } from '../../../data/consola/planesEstrategicos'
import type { PautadoVsHechoMicrociclo, SituacionPautado } from '../../../domain/pautadoVsHecho'

// three no pinta en jsdom: las dos escenas WebGL se sustituyen por muñecos que enseñan las
// propiedades que reciben. Lo que se prueba es lo que está ALREDEDOR: qué escena se elige, los
// mandos (Series/Volumen, ← →, Vista plana, tocar una semana) y que la 3D que falla cae al SVG.
const { modo, avisarFallo, escenaFalla } = vi.hoisted(() => ({
  modo: { actual: '3d' as '3d' | 'svg' },
  avisarFallo: vi.fn(),
  escenaFalla: { activa: false },
}))

vi.mock('./webgl', () => ({
  useModoDeEscena: () => ({ modo: modo.actual, avisarFallo }),
}))

vi.mock('./escena3d/Escena3DPautado', () => ({
  default: (p: {
    filas: { id: string }[]
    magnitud: string
    seleccionadoId?: string
    enfocado: boolean
    plana: boolean
    onSeleccionar: (id: string) => void
    alPerderContexto: () => void
  }): ReactNode => {
    if (escenaFalla.activa) throw new Error('no se pudo crear el contexto WebGL')
    return (
      <div
        data-testid="escena-webgl-falsa"
        data-magnitud={p.magnitud}
        data-seleccionado={p.seleccionadoId}
        data-enfocado={String(p.enfocado)}
        data-plana={String(p.plana)}
        data-semanas={p.filas.length}
      >
        <button type="button" onClick={() => p.onSeleccionar(p.filas[0].id)}>
          tocar primera semana
        </button>
        <button type="button" onClick={p.alPerderContexto}>
          perder contexto
        </button>
      </div>
    )
  },
}))

vi.mock('./escena3d/Escena3DPlan', () => ({
  default: (p: { casillas: { numero: number }[]; abierta: number | null; onElegir: (n: number) => void }): ReactNode => (
    <div data-testid="mapa-webgl-falso" data-abierta={String(p.abierta)} data-nodos={p.casillas.length}>
      <button type="button" onClick={() => p.onElegir(2)}>
        tocar nodo 2
      </button>
    </div>
  ),
}))

import { SeccionMapaDelPlan } from './SeccionMapaDelPlan'
import { SeccionPautadoVsHecho } from './SeccionPautadoVsHecho'

function fila(
  numero: number,
  s: [number, number],
  v: [number, number],
  situacion: SituacionPautado = 'con-datos',
  extra: Partial<PautadoVsHechoMicrociclo> = {},
): PautadoVsHechoMicrociclo {
  const pct = (h: number, p: number) => (p > 0 ? Math.round((h / p) * 100) : undefined)
  return {
    id: `m-${numero}`,
    numero,
    fechaInicio: '2026-09-01',
    estado: 'cerrado',
    situacion,
    series: { pautado: s[0], hecho: s[1], cumplimientoPct: pct(s[1], s[0]) },
    volumen: { pautado: v[0], hecho: v[1], cumplimientoPct: pct(v[1], v[0]) },
    ejerciciosSinCarga: 0,
    ...extra,
  }
}

const FILAS = [
  fila(1, [60, 58], [12000, 11500]),
  fila(2, [64, 0], [13000, 0], 'sin-registros'),
  fila(3, [64, 70], [13500, 15250], 'con-datos', { estado: 'activo' }),
]

const escena = () => screen.findByTestId('escena-webgl-falsa')

beforeEach(() => {
  modo.actual = '3d'
  escenaFalla.activa = false
  avisarFallo.mockClear()
})
afterEach(() => vi.restoreAllMocks())

describe('pautado contra hecho con la escena WebGL', () => {
  it('enseña la escena 3D (cargada a demanda) y NO la SVG, con todas las semanas', async () => {
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    const e = await escena()
    expect(e).toHaveAttribute('data-semanas', '3')
    expect(e).toHaveAttribute('data-seleccionado', 'm-3')
    expect(e).toHaveAttribute('data-plana', 'false')
    expect(screen.queryByTestId('escena-giro')).toBeNull()
    // La tabla accesible y el detalle siguen ahí.
    expect(screen.getByText('Ver los números')).toBeInTheDocument()
    expect(screen.getByText(/te pedimos 64 · hiciste 70/)).toBeInTheDocument()
  })

  it('Series / Volumen cambia la magnitud de la escena, sin mezclarlas', async () => {
    const user = userEvent.setup()
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    expect(await escena()).toHaveAttribute('data-magnitud', 'series')
    await user.click(screen.getByRole('button', { name: 'Volumen' }))
    expect(screen.getByTestId('escena-webgl-falsa')).toHaveAttribute('data-magnitud', 'volumen')
    expect(screen.getByRole('button', { name: 'Volumen' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('← → pasan de semana sin arrastrar, acercan la cámara y se detienen en los extremos', async () => {
    const user = userEvent.setup()
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    await escena()
    const anterior = screen.getByRole('button', { name: 'Semana anterior' })
    const siguiente = screen.getByRole('button', { name: 'Semana siguiente' })
    expect(siguiente).toBeDisabled() // ya está en la última
    await user.click(anterior)
    expect(screen.getByTestId('escena-webgl-falsa')).toHaveAttribute('data-seleccionado', 'm-2')
    expect(screen.getByTestId('escena-webgl-falsa')).toHaveAttribute('data-enfocado', 'true')
    await user.click(anterior)
    expect(screen.getByTestId('escena-webgl-falsa')).toHaveAttribute('data-seleccionado', 'm-1')
    expect(anterior).toBeDisabled()
    // El detalle sigue a la semana elegida.
    expect(screen.getByText('97 % de las series que te pedimos')).toBeInTheDocument()
    await user.click(siguiente)
    expect(screen.getByTestId('escena-webgl-falsa')).toHaveAttribute('data-seleccionado', 'm-2')
  })

  it('«Vista plana» y «Vista en 3D» alternan la cámara ortográfica', async () => {
    const user = userEvent.setup()
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    await escena()
    await user.click(screen.getByRole('button', { name: 'Vista plana' }))
    expect(screen.getByTestId('escena-webgl-falsa')).toHaveAttribute('data-plana', 'true')
    expect(screen.getByRole('button', { name: 'Vista en 3D' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Vista en 3D' }))
    expect(screen.getByTestId('escena-webgl-falsa')).toHaveAttribute('data-plana', 'false')
  })

  it('tocar una semana la elige y acerca la cámara; «Ver todo» la devuelve a la vista general', async () => {
    const user = userEvent.setup()
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    await escena()
    expect(screen.queryByRole('button', { name: 'Ver todo' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'tocar primera semana' }))
    const e = screen.getByTestId('escena-webgl-falsa')
    expect(e).toHaveAttribute('data-seleccionado', 'm-1')
    expect(e).toHaveAttribute('data-enfocado', 'true')
    expect(screen.getByText('97 % de las series que te pedimos')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver todo' }))
    expect(screen.getByTestId('escena-webgl-falsa')).toHaveAttribute('data-enfocado', 'false')
  })

  it('los mandos miden al menos 44 px (clase h-11)', async () => {
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    await escena()
    for (const nombre of ['Semana anterior', 'Semana siguiente', 'Vista plana', 'Series', 'Volumen']) {
      expect(screen.getByRole('button', { name: nombre }).className).toMatch(/\bh-11\b/)
    }
  })

  it('si la escena 3D lanza un error, cae a la escena SVG y avisa de que WebGL falló', async () => {
    escenaFalla.activa = true
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    expect(await screen.findByTestId('escena-giro')).toBeInTheDocument()
    expect(screen.queryByTestId('escena-webgl-falsa')).toBeNull()
    expect(avisarFallo).toHaveBeenCalledTimes(1)
    // Y el respaldo sigue funcionando: sus mandos y el conmutador.
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Volumen' }))
    expect(screen.getByTestId('escena-giro')).toHaveAccessibleName(/kg·rep/)
  })

  it('si el contexto WebGL se pierde, se avisa para caer al respaldo', async () => {
    const user = userEvent.setup()
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    await escena()
    await user.click(screen.getByRole('button', { name: 'perder contexto' }))
    expect(avisarFallo).toHaveBeenCalledTimes(1)
  })
})

describe('pautado contra hecho sin WebGL (o con menos movimiento)', () => {
  it('monta la escena SVG de respaldo, con sus controles, y no pide la 3D', async () => {
    modo.actual = 'svg'
    const user = userEvent.setup()
    render(<SeccionPautadoVsHecho filas={FILAS} />)
    expect(screen.getByTestId('escena-giro')).toBeInTheDocument()
    expect(screen.queryByTestId('escena-webgl-falsa')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Volumen' }))
    expect(screen.getByTestId('escena-giro').querySelector('[data-microciclo="3"] [data-barra="hecho"]')).toHaveTextContent('15.250')
    await user.click(screen.getByRole('button', { name: 'Vista plana' }))
    await waitFor(() => expect(screen.getByTestId('escena-giro')).toHaveAttribute('data-giro', '0'))
  })
})

// ── El mapa del plan ───────────────────────────────────────────────────────────────────

function plan(n: number): PlanEstrategico {
  const filas = Object.fromEntries(
    Array.from({ length: n }, (_, i) => [String(i + 1), { columnas: { Micro: `M${i + 1}`, Foco: `foco ${i + 1}` }, condiciones: {} }]),
  )
  return { id: 'p', usuarioId: 'u', version: 1, vigente: true, contenido: { cabecera: ['Micro', 'Foco'], filas }, hash: 'h', creadoEn: '2026-09-20T12:00:00Z' }
}

describe('el mapa del plan con la escena WebGL', () => {
  const montar = () => render(<SeccionMapaDelPlan plan={{ estado: 'listo', valor: plan(24) }} numeroActual={5} ultimoCerrado={4} />)

  it('enseña el recorrido 3D con una parada por semana y la lista de casillas plegada', async () => {
    montar()
    const mapa = await screen.findByTestId('mapa-webgl-falso')
    expect(mapa).toHaveAttribute('data-nodos', '24')
    const lista = screen.getByText('Ver las semanas como lista').closest('details')!
    expect(within(lista).getAllByRole('button')).toHaveLength(24)
  })

  it('tocar una parada abre debajo lo que dice el plan; «Ver todo el camino» lo cierra', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByTestId('mapa-webgl-falso')
    await user.click(screen.getByRole('button', { name: 'tocar nodo 2' }))
    expect(screen.getByText('foco 2')).toBeInTheDocument()
    expect(screen.getByTestId('mapa-webgl-falso')).toHaveAttribute('data-abierta', '2')
    await user.click(screen.getByRole('button', { name: 'Ver todo el camino' }))
    expect(screen.queryByText('foco 2')).toBeNull()
  })

  it('← → recorren las semanas del plan empezando por la de ahora', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByTestId('mapa-webgl-falso')
    await user.click(screen.getByRole('button', { name: 'Semana siguiente del plan' }))
    expect(screen.getByText('foco 6')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Semana anterior del plan' }))
    expect(screen.getByText('foco 5')).toBeInTheDocument()
  })

  it('sin plan sigue diciendo la frase de siempre', () => {
    render(<SeccionMapaDelPlan plan={{ estado: 'listo', valor: null }} numeroActual={2} ultimoCerrado={1} />)
    expect(screen.getByText(/no hay un plan de largo plazo/)).toBeInTheDocument()
    expect(screen.queryByTestId('mapa-webgl-falso')).toBeNull()
  })

  it('sin WebGL el mapa es la rejilla de casillas de siempre', () => {
    modo.actual = 'svg'
    montar()
    expect(screen.queryByTestId('mapa-webgl-falso')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(24)
  })
})

// ── La decisión real de qué escena se usa ──────────────────────────────────────────────

describe('useModoDeEscena (el real, sin el muñeco)', () => {
  const original = {
    gl: (window as unknown as Record<string, unknown>).WebGLRenderingContext,
    ctx: HTMLCanvasElement.prototype.getContext,
  }
  afterEach(() => {
    Reflect.deleteProperty(window, 'matchMedia')
    if (original.gl === undefined) Reflect.deleteProperty(window, 'WebGLRenderingContext')
    else (window as unknown as Record<string, unknown>).WebGLRenderingContext = original.gl
    HTMLCanvasElement.prototype.getContext = original.ctx
  })

  function movimiento(reducido: boolean) {
    window.matchMedia = ((q: string) => ({
      matches: reducido,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  }
  function conWebGL(crea: boolean) {
    ;(window as unknown as Record<string, unknown>).WebGLRenderingContext = function WebGLRenderingContext() {}
    HTMLCanvasElement.prototype.getContext = (() => (crea ? { getExtension: () => null } : null)) as unknown as typeof HTMLCanvasElement.prototype.getContext
  }
  /** El módulo real, recién importado: `hayWebGL` guarda su respuesta y cada caso necesita la suya. */
  async function hook() {
    vi.resetModules()
    vi.doUnmock('./webgl')
    const real = await import('./webgl')
    return renderHook(() => real.useModoDeEscena())
  }

  it('en jsdom (sin WebGL) elige el SVG', async () => {
    movimiento(false)
    Reflect.deleteProperty(window, 'WebGLRenderingContext')
    const { result } = await hook()
    expect(result.current.modo).toBe('svg')
  })

  it('con WebGL y sin pedir menos movimiento elige la 3D', async () => {
    movimiento(false)
    conWebGL(true)
    const { result } = await hook()
    expect(result.current.modo).toBe('3d')
  })

  it('con WebGL pero pidiendo menos movimiento elige el SVG', async () => {
    movimiento(true)
    conWebGL(true)
    const { result } = await hook()
    expect(result.current.modo).toBe('svg')
  })

  it('si el navegador anuncia WebGL pero no puede crear el contexto, elige el SVG', async () => {
    movimiento(false)
    conWebGL(false)
    const { result } = await hook()
    expect(result.current.modo).toBe('svg')
  })

  it('tras avisar de un fallo se queda en el SVG', async () => {
    movimiento(false)
    conWebGL(true)
    const { result } = await hook()
    expect(result.current.modo).toBe('3d')
    act(() => result.current.avisarFallo())
    expect(result.current.modo).toBe('svg')
  })
})
