import { describe, expect, it } from 'vitest'
import { pRatio, UMBRAL_DELTA_PESO_KG } from './pRatio'

describe('pRatio', () => {
  it('da "no interpretable" (undefined) por debajo del umbral de Δpeso', () => {
    const antes = { pesoKg: 70, masaMagraKg: 55 }
    const despues = { pesoKg: 70 + UMBRAL_DELTA_PESO_KG / 2, masaMagraKg: 55.3 }
    expect(pRatio(antes, despues)).toBeUndefined()
  })

  it('da el valor correcto por encima del umbral', () => {
    // Δpeso = 2 kg, Δmasa magra = 1.6 kg → p-ratio = 0.8
    const antes = { pesoKg: 70, masaMagraKg: 55 }
    const despues = { pesoKg: 72, masaMagraKg: 56.6 }
    expect(pRatio(antes, despues)).toBe(0.8)
  })

  it('no interpretable si falta masa magra en cualquiera de las dos medidas', () => {
    expect(pRatio({ pesoKg: 70 }, { pesoKg: 72, masaMagraKg: 56 })).toBeUndefined()
    expect(pRatio({ pesoKg: 70, masaMagraKg: 55 }, { pesoKg: 72 })).toBeUndefined()
  })

  it('no interpretable si falta el peso en cualquiera de las dos medidas', () => {
    expect(pRatio({ masaMagraKg: 55 }, { pesoKg: 72, masaMagraKg: 56.6 })).toBeUndefined()
  })

  it('exactamente en el umbral sigue sin ser interpretable (< estricto)', () => {
    const antes = { pesoKg: 70, masaMagraKg: 55 }
    const despues = { pesoKg: 70 + UMBRAL_DELTA_PESO_KG, masaMagraKg: 55.08 }
    expect(pRatio(antes, despues)).toBeUndefined()
  })

  it('acepta pérdida de peso con p-ratio bajo (deseable)', () => {
    // Δpeso = -3 kg, Δmasa magra = -0.3 kg → p-ratio = 0.1 (mayoría grasa)
    const antes = { pesoKg: 80, masaMagraKg: 60 }
    const despues = { pesoKg: 77, masaMagraKg: 59.7 }
    expect(pRatio(antes, despues)).toBe(0.1)
  })
})
