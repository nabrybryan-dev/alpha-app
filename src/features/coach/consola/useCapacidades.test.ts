import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const estadoSesion = {
  usuario: null as { id: string } | null,
}

vi.mock('../../../app/SessionProvider', () => ({
  useSesionOpcional: () => (estadoSesion.usuario ? { usuario: estadoSesion.usuario } : null),
}))

const capacidadesDeMock = vi.fn()

vi.mock('../../../data/consola/capacidadesStaff', () => ({
  capacidadesDe: (usuarioId: string) => capacidadesDeMock(usuarioId),
}))

const { _reiniciarCacheCapacidadesParaPruebas, useCapacidades } = await import('./useCapacidades')

beforeEach(() => {
  estadoSesion.usuario = null
  capacidadesDeMock.mockReset()
  capacidadesDeMock.mockResolvedValue([])
  _reiniciarCacheCapacidadesParaPruebas()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useCapacidades', () => {
  it('sin SessionProvider por encima, no consulta nada y "no tiene" ninguna capacidad', () => {
    const { result } = renderHook(() => useCapacidades())
    expect(result.current.cargando).toBe(false)
    expect(result.current.usuarioId).toBeNull()
    expect(result.current.tiene('detener_publicacion')).toBe(false)
    expect(capacidadesDeMock).not.toHaveBeenCalled()
  })

  it('con sesión, consulta las capacidades de ESE usuario y las expone', async () => {
    estadoSesion.usuario = { id: 'u-1' }
    capacidadesDeMock.mockResolvedValue(['detener_publicacion', 'reportar_riesgo'])
    const { result } = renderHook(() => useCapacidades())

    expect(result.current.cargando).toBe(true)
    await waitFor(() => expect(result.current.cargando).toBe(false))

    expect(capacidadesDeMock).toHaveBeenCalledWith('u-1')
    expect(result.current.usuarioId).toBe('u-1')
    expect(result.current.tiene('detener_publicacion')).toBe(true)
    expect(result.current.tiene('firmar_politica')).toBe(false)
  })

  it('cachea durante la sesión: dos hooks para el MISMO usuario piden la base una sola vez', async () => {
    estadoSesion.usuario = { id: 'u-1' }
    capacidadesDeMock.mockResolvedValue(['detener_publicacion'])

    const primero = renderHook(() => useCapacidades())
    await waitFor(() => expect(primero.result.current.cargando).toBe(false))

    const segundo = renderHook(() => useCapacidades())
    await waitFor(() => expect(segundo.result.current.cargando).toBe(false))

    expect(capacidadesDeMock).toHaveBeenCalledTimes(1)
    expect(segundo.result.current.tiene('detener_publicacion')).toBe(true)
  })
})
