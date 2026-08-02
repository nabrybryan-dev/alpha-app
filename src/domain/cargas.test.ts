import { describe, expect, it } from 'vitest'
import { coeficienteCarga, estimarUnRm, REPS_MAX, RIR_MAX } from './cargas'

describe('coeficienteCarga', () => {
  it('coincide con la tabla documentada en el motor de decisión', () => {
    // wiki/motor-decision/02-intensidad-rir-rpe-cargas.md
    expect(coeficienteCarga(5, 0)).toBe(0.855)
    expect(coeficienteCarga(5, 1)).toBe(0.82)
    expect(coeficienteCarga(5, 2)).toBe(0.79)
    expect(coeficienteCarga(8, 0)).toBe(0.75)
    expect(coeficienteCarga(8, 1)).toBe(0.715)
    expect(coeficienteCarga(8, 2)).toBe(0.685)
    expect(coeficienteCarga(10, 0)).toBe(0.68)
    expect(coeficienteCarga(10, 1)).toBe(0.645)
    expect(coeficienteCarga(10, 2)).toBe(0.615)
    expect(coeficienteCarga(12, 0)).toBe(0.61)
    expect(coeficienteCarga(12, 1)).toBe(0.575)
    expect(coeficienteCarga(12, 2)).toBe(0.545)
  })

  it('cubre las esquinas de la tabla', () => {
    expect(coeficienteCarga(1, 0)).toBe(1)
    expect(coeficienteCarga(15, 6)).toBe(0.3)
    expect(coeficienteCarga(1, RIR_MAX)).toBe(0.795)
    expect(coeficienteCarga(REPS_MAX, 0)).toBe(0.505)
  })

  it('la tabla NO es lineal: por eso se transcribe y no se calcula', () => {
    // En 1 rep, el primer salto de RIR es 0,035 y el segundo 0,030. Una fórmula
    // lineal daría 0,930 en vez de 0,935 y desviaría el 1RM estimado.
    const a = coeficienteCarga(1, 0) as number
    const b = coeficienteCarga(1, 1) as number
    const c = coeficienteCarga(1, 2) as number
    expect(Math.round((a - b) * 1000)).toBe(35)
    expect(Math.round((b - c) * 1000)).toBe(30)
  })

  it('fuera de tabla no extrapola', () => {
    expect(coeficienteCarga(0, 0)).toBeUndefined()
    expect(coeficienteCarga(16, 0)).toBeUndefined()
    expect(coeficienteCarga(10, 7)).toBeUndefined()
    expect(coeficienteCarga(10, -1)).toBeUndefined()
    expect(coeficienteCarga(10.5, 2)).toBeUndefined()
  })
})

describe('estimarUnRm', () => {
  it('estima el 1RM del día con la carga movida', () => {
    // 50 kg × 10 reps a RIR 2 → 50 / 0,615
    expect(estimarUnRm(50, 10, 2)).toBe(81.3)
    // Una serie a RIR 0 y 1 rep ES el 1RM.
    expect(estimarUnRm(100, 1, 0)).toBe(100)
  })

  it('a igual carga, más reps o más RIR significan más 1RM', () => {
    const base = estimarUnRm(60, 8, 2) as number
    expect(estimarUnRm(60, 10, 2) as number).toBeGreaterThan(base)
    expect(estimarUnRm(60, 8, 4) as number).toBeGreaterThan(base)
  })

  it('sin carga real no inventa un máximo', () => {
    expect(estimarUnRm(0, 10, 2)).toBeUndefined()
    expect(estimarUnRm(-5, 10, 2)).toBeUndefined()
    expect(estimarUnRm(Number.NaN, 10, 2)).toBeUndefined()
    expect(estimarUnRm(50, 30, 2)).toBeUndefined()
  })
})
