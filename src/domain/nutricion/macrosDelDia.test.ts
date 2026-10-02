import { describe, expect, it } from 'vitest'
import { macrosDelDia } from './macrosDelDia'

const m = { kcal: 2000, proteinaG: 100, carbosG: 200, grasaG: 60 }

describe('macrosDelDia', () => {
  it('devuelve los macros cuando el plan los trae', () => {
    expect(macrosDelDia({ macrosPorDia: { ALTO: m } }, 'ALTO')).toBe(m)
  })
  it('devuelve null si el plan no trae ese tipo de día', () => {
    expect(macrosDelDia({ macrosPorDia: { BAJO: m } }, 'ALTO')).toBeNull()
  })
  it('devuelve null si el plan no trae macrosPorDia', () => {
    expect(macrosDelDia({}, 'ALTO')).toBeNull()
    expect(macrosDelDia({ macrosPorDia: null }, 'ALTO')).toBeNull()
    expect(macrosDelDia(undefined, 'ALTO')).toBeNull()
  })
  it('devuelve null si el tipo viene sin kcal', () => {
    expect(macrosDelDia({ macrosPorDia: { ALTO: {} as never } }, 'ALTO')).toBeNull()
  })
})
