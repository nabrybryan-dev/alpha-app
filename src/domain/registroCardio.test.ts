import { describe, expect, it } from 'vitest'
import { ritmoLegible, ritmoMinPorKm, velocidadKmH } from './registroCardio'

describe('ritmoMinPorKm', () => {
  it('calcula minutos por kilómetro', () => {
    // 30 min para 5 km = 6 min/km
    expect(ritmoMinPorKm({ duracionRealMin: 30, distanciaKm: 5 })).toBe(6)
  })

  it('undefined sin distancia, sin duración, o con alguna de las dos en 0', () => {
    expect(ritmoMinPorKm({ duracionRealMin: 30 })).toBeUndefined()
    expect(ritmoMinPorKm({ distanciaKm: 5 })).toBeUndefined()
    expect(ritmoMinPorKm({})).toBeUndefined()
    expect(ritmoMinPorKm({ duracionRealMin: 0, distanciaKm: 5 })).toBeUndefined()
    expect(ritmoMinPorKm({ duracionRealMin: 30, distanciaKm: 0 })).toBeUndefined()
  })

  it('undefined con valores no finitos o negativos', () => {
    expect(ritmoMinPorKm({ duracionRealMin: Number.NaN, distanciaKm: 5 })).toBeUndefined()
    expect(ritmoMinPorKm({ duracionRealMin: 30, distanciaKm: Number.POSITIVE_INFINITY })).toBeUndefined()
    expect(ritmoMinPorKm({ duracionRealMin: -10, distanciaKm: 5 })).toBeUndefined()
  })
})

describe('velocidadKmH', () => {
  it('calcula kilómetros por hora', () => {
    // 5 km en 30 min = 10 km/h
    expect(velocidadKmH({ duracionRealMin: 30, distanciaKm: 5 })).toBe(10)
  })

  it('undefined sin los dos datos', () => {
    expect(velocidadKmH({ duracionRealMin: 30 })).toBeUndefined()
    expect(velocidadKmH({ distanciaKm: 5 })).toBeUndefined()
  })

  it('ritmo y velocidad son inversos (60/ritmo = velocidad)', () => {
    const registro = { duracionRealMin: 42, distanciaKm: 7.3 }
    const ritmo = ritmoMinPorKm(registro)!
    const vel = velocidadKmH(registro)!
    expect(vel).toBeCloseTo(60 / ritmo, 1)
  })
})

describe('ritmoLegible', () => {
  it('da minutos:segundos por kilómetro', () => {
    // 33 min para 6 km = 5.5 min/km = 5:30 min/km
    expect(ritmoLegible({ duracionRealMin: 33, distanciaKm: 6 })).toBe('5:30 min/km')
  })

  it('rellena los segundos con un cero a la izquierda', () => {
    // 30.5 min para 6 km = 5,0833 min/km = 5:05 min/km
    expect(ritmoLegible({ duracionRealMin: 30.5, distanciaKm: 6 })).toBe('5:05 min/km')
  })

  it('un redondeo a 60 segundos sube el minuto', () => {
    // Construido para que el redondeo de segundos dé exactamente 60.
    expect(ritmoLegible({ duracionRealMin: 4.999 * 5, distanciaKm: 5 })).toBe('5:00 min/km')
  })

  it('undefined si no se puede calcular el ritmo', () => {
    expect(ritmoLegible({ duracionRealMin: 30 })).toBeUndefined()
  })
})
