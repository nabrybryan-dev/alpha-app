import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { movimientoReducido, useMovimientoReducido } from './movimientoReducido'

type Oyente = () => void
let oyentes: Oyente[] = []
let reducido = false

/** `matchMedia` no existe en jsdom: se declara con el valor que pida el test. */
function declarar() {
  oyentes = []
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    // Getter y no valor: el hook guarda el objeto y lo relee al llegar el
    // `change`. Con un valor fijo leeria siempre el de antes.
    get matches() {
      return reducido && consulta.includes('prefers-reduced-motion')
    },
    addEventListener: (_: string, fn: Oyente) => oyentes.push(fn),
    removeEventListener: (_: string, fn: Oyente) => {
      oyentes = oyentes.filter((o) => o !== fn)
    },
  }))
}

function cambiarPreferencia(nuevo: boolean) {
  reducido = nuevo
  act(() => oyentes.forEach((avisar) => avisar()))
}

function Sonda() {
  return <span data-testid="v">{String(useMovimientoReducido())}</span>
}

beforeEach(() => {
  reducido = false
  declarar()
})

afterEach(() => vi.unstubAllGlobals())

describe('movimientoReducido', () => {
  it('dice que no cuando el sistema no lo pide', () => {
    expect(movimientoReducido()).toBe(false)
  })

  it('dice que si cuando el sistema lo pide', () => {
    reducido = true
    declarar()
    expect(movimientoReducido()).toBe(true)
  })

  it('sin matchMedia no revienta: asume que no se pidio', () => {
    // Es el fallo real que tenia AguilaInteractiva, que llamaba
    // window.matchMedia(...) a pelo dentro del manejador del toque.
    vi.stubGlobal('matchMedia', undefined)
    expect(() => movimientoReducido()).not.toThrow()
    expect(movimientoReducido()).toBe(false)
  })
})

describe('useMovimientoReducido', () => {
  it('el primer render ya trae el valor correcto, sin fotograma de mas', () => {
    reducido = true
    declarar()
    const { getByTestId } = render(<Sonda />)
    expect(getByTestId('v').textContent).toBe('true')
  })

  it('se entera si la preferencia cambia con la app abierta', () => {
    const { getByTestId } = render(<Sonda />)
    expect(getByTestId('v').textContent).toBe('false')
    cambiarPreferencia(true)
    expect(getByTestId('v').textContent).toBe('true')
  })

  it('deja de escuchar al desmontarse', () => {
    const { unmount } = render(<Sonda />)
    expect(oyentes.length).toBe(1)
    unmount()
    expect(oyentes.length).toBe(0)
  })

  it('sin matchMedia no revienta', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { getByTestId } = render(<Sonda />)
    expect(getByTestId('v').textContent).toBe('false')
  })
})

describe('Safari viejo: solo existe addListener', () => {
  /**
   * Antes de unificar, la suscripción se hacía con `addEventListener?.()`. En un
   * navegador que solo trae la API anterior eso no lanza nada: simplemente no
   * escucha. El fallo es invisible —ni error, ni aviso— y el efecto es que quien
   * activa la preferencia con la app abierta se queda con el movimiento puesto.
   */
  function declararSoloApiVieja() {
    oyentes = []
    vi.stubGlobal('matchMedia', (consulta: string) => ({
      get matches() {
        return reducido && consulta.includes('prefers-reduced-motion')
      },
      addListener: (fn: Oyente) => oyentes.push(fn),
      removeListener: (fn: Oyente) => {
        oyentes = oyentes.filter((o) => o !== fn)
      },
    }))
  }

  beforeEach(() => {
    reducido = false
    declararSoloApiVieja()
  })

  it('se suscribe por la API vieja en vez de quedarse sordo', () => {
    render(<Sonda />)
    expect(oyentes).toHaveLength(1)
  })

  it('y se entera del cambio igual que con la API nueva', () => {
    const { getByTestId } = render(<Sonda />)
    expect(getByTestId('v').textContent).toBe('false')
    cambiarPreferencia(true)
    expect(getByTestId('v').textContent).toBe('true')
  })

  it('se da de baja al desmontar, tambien por la API vieja', () => {
    const { unmount } = render(<Sonda />)
    expect(oyentes).toHaveLength(1)
    unmount()
    expect(oyentes).toHaveLength(0)
  })
})
