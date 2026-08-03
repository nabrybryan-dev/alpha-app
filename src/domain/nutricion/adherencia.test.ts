import { describe, expect, it } from 'vitest'
import type { AdherenciaNutricional, EstadoAdherencia } from '../types'
import { porcentajeAdherencia } from './adherencia'

function dia(estado: EstadoAdherencia, i: number): AdherenciaNutricional {
  return { id: `a${i}`, usuarioId: 'u1', fecha: `2026-07-${String(i + 1).padStart(2, '0')}`, estado }
}

describe('porcentajeAdherencia', () => {
  it('cuenta el día parcial como medio', () => {
    expect(porcentajeAdherencia([dia('si', 0), dia('parcial', 1)])).toBe(75)
  })

  it('resuelve los extremos', () => {
    expect(porcentajeAdherencia([dia('si', 0), dia('si', 1)])).toBe(100)
    expect(porcentajeAdherencia([dia('no', 0), dia('no', 1)])).toBe(0)
  })

  it('sin registros devuelve 0, no divide por cero', () => {
    expect(porcentajeAdherencia([])).toBe(0)
  })

  it('solo mide los días marcados: no registrar no es incumplir', () => {
    // Dos días perfectos siguen siendo 100% aunque la semana tenga siete.
    expect(porcentajeAdherencia([dia('si', 0), dia('si', 1)])).toBe(100)
  })
})
