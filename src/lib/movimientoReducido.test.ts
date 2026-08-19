import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMovimientoReducido } from './movimientoReducido'

type Escucha = (evento: MediaQueryListEvent) => void

/** Doble de `matchMedia` con el que se puede cambiar la respuesta en caliente. */
function fingirMatchMedia(coincideAlInicio: boolean) {
  let coincide = coincideAlInicio
  const escuchas = new Set<Escucha>()

  const medio = {
    get matches() {
      return coincide
    },
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, cb: Escucha) => escuchas.add(cb),
    removeEventListener: (_: string, cb: Escucha) => escuchas.delete(cb),
  }

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => medio),
  )

  return {
    cambiarA(valor: boolean) {
      coincide = valor
      escuchas.forEach((cb) => cb({ matches: valor } as MediaQueryListEvent))
    },
    get suscritas() {
      return escuchas.size
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('useMovimientoReducido', () => {
  it('responde false cuando el navegador no sabe de matchMedia', () => {
    // jsdom no lo implementa: es el caso por defecto de toda la suite.
    const { result } = renderHook(() => useMovimientoReducido())
    expect(result.current).toBe(false)
  })

  it('responde true si el sistema pide menos movimiento', () => {
    fingirMatchMedia(true)
    const { result } = renderHook(() => useMovimientoReducido())
    expect(result.current).toBe(true)
  })

  it('se entera del cambio sin recargar', () => {
    const medio = fingirMatchMedia(false)
    const { result } = renderHook(() => useMovimientoReducido())
    expect(result.current).toBe(false)

    act(() => medio.cambiarA(true))
    expect(result.current).toBe(true)
  })

  it('se da de baja al desmontar, para no dejar escuchas colgando', () => {
    const medio = fingirMatchMedia(false)
    const { unmount } = renderHook(() => useMovimientoReducido())
    expect(medio.suscritas).toBe(1)

    unmount()
    expect(medio.suscritas).toBe(0)
  })
})
