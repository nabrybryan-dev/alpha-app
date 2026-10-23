// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { clasificarCorrida } from './mutar-clasificar.mjs'

describe('como se juzga una corrida con una mutacion puesta', () => {
  it('exit 0 = sobrevive', () => {
    expect(clasificarCorrida({ status: 0, salida: ' Tests  12 passed (12)' })).toBe('sobrevive')
  })
  it('exit 1 con una prueba fallida = muerta (tambien con color y con tests mezclados)', () => {
    expect(clasificarCorrida({ status: 1, salida: ' Tests  1 failed | 11 passed (12)' })).toBe('muerta')
    expect(clasificarCorrida({ status: 1, salida: '\x1b[2m      Tests \x1b[22m \x1b[1m\x1b[31m2 failed\x1b[39m\x1b[22m | 10 passed' })).toBe('muerta')
  })
  it('exit 1 SIN ninguna prueba fallida (error de carga o de sintaxis) NO es un kill', () => {
    expect(clasificarCorrida({ status: 1, salida: ' FAIL src/x.test.ts\nSyntaxError: Unexpected token\n Test Files  1 failed (1)\n      Tests  no tests' })).toBe('no_carga')
    expect(clasificarCorrida({ status: 1, salida: '' })).toBe('no_carga')
  })
  it('un timeout (status null / senal / error) es indeterminada, no muerta', () => {
    expect(clasificarCorrida({ status: null, signal: 'SIGTERM', salida: '' })).toBe('indeterminada')
    expect(clasificarCorrida({ status: null, error: new Error('ETIMEDOUT') })).toBe('indeterminada')
    expect(clasificarCorrida({ status: undefined })).toBe('indeterminada')
  })
})
