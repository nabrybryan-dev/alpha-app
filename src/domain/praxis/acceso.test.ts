import { describe, expect, it } from 'vitest'
import { PRAXIS_ABIERTA_A_ASESORADOS, esStaff, puedeVerPraxis } from './acceso'

/**
 * Praxis se publicó el 29-sep-2026 como excepción firmada por Bryan, con DATOS DE
 * EJEMPLO y sin su cerebro desplegado (ni el registrador ni la voz). Un asesorado que la
 * viera leería un check-in inventado como si fuera suyo. Por eso la pantalla solo la ve el
 * staff, y el interruptor para asesorados nace apagado.
 */
describe('quién puede ver Praxis', () => {
  it('el staff es el coach y la nutricionista, igual que `es_staff()` en la base', () => {
    expect(esStaff('coach')).toBe(true)
    expect(esStaff('nutricionista')).toBe(true)
    expect(esStaff('asesorado')).toBe(false)
  })

  it('el interruptor para asesorados está apagado', () => {
    expect(PRAXIS_ABIERTA_A_ASESORADOS).toBe(false)
  })

  it('con el interruptor apagado, un asesorado no la ve y el staff sí', () => {
    expect(puedeVerPraxis('asesorado')).toBe(false)
    expect(puedeVerPraxis('coach')).toBe(true)
    expect(puedeVerPraxis('nutricionista')).toBe(true)
  })

  it('el interruptor es lo único que le abre la puerta a un asesorado', () => {
    expect(puedeVerPraxis('asesorado', true)).toBe(true)
    expect(puedeVerPraxis('asesorado', false)).toBe(false)
  })

  it('apagar el interruptor nunca deja fuera al staff', () => {
    expect(puedeVerPraxis('coach', false)).toBe(true)
    expect(puedeVerPraxis('nutricionista', false)).toBe(true)
  })
})
