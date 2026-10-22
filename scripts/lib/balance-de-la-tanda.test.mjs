// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { balanceDeLaPublicacion, CODIGO_TANDA_INCOMPLETA } from './balance-de-la-tanda.mjs'

// El 16-oct el puente publicó 0 de 13 y el registro dijo «LISTO»: terminaba con código 0 aunque
// no hubiera publicado nada. Esto es lo que decide si una tanda se dio por buena.

describe('el balance de la publicación', () => {
  it('todo publicado: completa y sale con 0', () => {
    const b = balanceDeLaPublicacion({ esperados: 16, publicados: 16, yaAprobados: 0, rechazados: 0, sinAudio: 0 })
    expect(b).toMatchObject({ completa: true, codigoDeSalida: 0, faltan: 0 })
  })

  it('0 publicados de 13 NO es una tanda buena (el falso verde del 16-oct)', () => {
    const b = balanceDeLaPublicacion({ esperados: 13, publicados: 0, yaAprobados: 0, rechazados: 0, sinAudio: 13 })
    expect(b.completa).toBe(false)
    expect(b.codigoDeSalida).toBe(CODIGO_TANDA_INCOMPLETA)
    expect(CODIGO_TANDA_INCOMPLETA).not.toBe(0)
    expect(b.linea).toMatch(/TANDA INCOMPLETA/)
    expect(b.linea).toContain('13')
  })

  it('una sola persona sin audio ya es tanda incompleta', () => {
    const b = balanceDeLaPublicacion({ esperados: 16, publicados: 15, yaAprobados: 0, rechazados: 0, sinAudio: 1 })
    expect(b.completa).toBe(false)
    expect(b.faltan).toBe(1)
  })

  it('una repetición donde todo estaba ya firmado es un no-hacer-nada legítimo', () => {
    const b = balanceDeLaPublicacion({ esperados: 16, publicados: 0, yaAprobados: 16, rechazados: 0, sinAudio: 0 })
    expect(b).toMatchObject({ completa: true, codigoDeSalida: 0 })
  })

  it('un rechazo por otro motivo (guion vacío, archivo enorme…) NO es legítimo', () => {
    const b = balanceDeLaPublicacion({ esperados: 16, publicados: 15, yaAprobados: 0, rechazados: 1, sinAudio: 0 })
    expect(b.completa).toBe(false)
    expect(b.codigoDeSalida).toBe(CODIGO_TANDA_INCOMPLETA)
  })

  it('si las cuentas no cuadran con lo esperado, tampoco se da por buena', () => {
    const b = balanceDeLaPublicacion({ esperados: 16, publicados: 10, yaAprobados: 0, rechazados: 0, sinAudio: 0 })
    expect(b.completa).toBe(false)
    expect(b.faltan).toBe(6)
  })

  it('una tanda sin nadie esperado (todos omitidos) no es un fallo', () => {
    const b = balanceDeLaPublicacion({ esperados: 0, publicados: 0, yaAprobados: 0, rechazados: 0, sinAudio: 0 })
    expect(b.completa).toBe(true)
  })

  it('en ensayo no se exige haber publicado nada', () => {
    const b = balanceDeLaPublicacion({ esperados: 16, publicados: 0, yaAprobados: 0, rechazados: 0, sinAudio: 0, ensayo: true })
    expect(b.completa).toBe(true)
  })
})
