import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useVozPermitida } from './useVozPermitida'

const estado = vi.hoisted(() => ({ rol: undefined as string | undefined, esCoach: false }))
vi.mock('../../../../app/SessionProvider', () => ({
  useSesionOpcional: () => (estado.rol ? { usuario: { rol: estado.rol } } : null),
}))
vi.mock('../../../coach/consola/usePuestoCoach', () => ({ usePuestoCoach: () => ({ esCoach: estado.esCoach }) }))

describe('quién tiene el micrófono', () => {
  beforeEach(() => {
    estado.rol = undefined
    estado.esCoach = false
  })

  it.each([
    ['coach', false, true],
    ['nutricionista', false, true],
    ['asesorado', true, true],
    ['asesorado', false, false],
  ])('%s con puesto=%s: %s', (rol, esCoach, esperado) => {
    estado.rol = rol
    estado.esCoach = esCoach
    expect(renderHook(() => useVozPermitida()).result.current).toBe(esperado)
  })

  it('sin sesión no hay micrófono', () => {
    expect(renderHook(() => useVozPermitida()).result.current).toBe(false)
  })
})
