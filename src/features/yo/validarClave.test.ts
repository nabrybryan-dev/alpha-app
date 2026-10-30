import { describe, expect, it } from 'vitest'
import { CLAVE_MINIMA, motivoDeClaveInvalida } from './validarClave'

describe('la clave nueva', () => {
  it('pide el mismo largo mínimo que la pantalla de recuperación', () => {
    expect(CLAVE_MINIMA).toBe(6)
    expect(motivoDeClaveInvalida('12345', '12345')).toMatch(/al menos 6/)
  })
  it('pide que las dos coincidan', () => {
    expect(motivoDeClaveInvalida('abcdef', 'abcdeg')).toMatch(/no coinciden/)
  })
  it('una buena no tiene motivo', () => {
    expect(motivoDeClaveInvalida('abcdef', 'abcdef')).toBeNull()
  })
})
