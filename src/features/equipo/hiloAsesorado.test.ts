import { describe, expect, it } from 'vitest'
import { puedeAbrirHilo } from './hiloAsesorado'

const yo = { id: 'n1', rol: 'nutricionista' as const }
const asesorado = { id: 'a1', rol: 'asesorado' as const }

describe('puedeAbrirHilo', () => {
  it('permitido: nutricionista con responder_por_asesorado y un asesorado', () => {
    expect(puedeAbrirHilo(yo, true, asesorado)).toBe(true)
  })
  it('denegado sin la capacidad', () => {
    expect(puedeAbrirHilo(yo, false, asesorado)).toBe(false)
  })
  it('denegado si quien mira no es nutricionista (asesorado o coach)', () => {
    expect(puedeAbrirHilo({ id: 'a2', rol: 'asesorado' }, true, asesorado)).toBe(false)
    expect(puedeAbrirHilo({ id: 'c1', rol: 'coach' }, true, asesorado)).toBe(false)
  })
  it('denegado si el otro no es un asesorado (coach, otro staff, ella misma) o no existe', () => {
    expect(puedeAbrirHilo(yo, true, { id: 'c1', rol: 'coach' })).toBe(false)
    expect(puedeAbrirHilo(yo, true, { id: 'n2', rol: 'nutricionista' })).toBe(false)
    expect(puedeAbrirHilo(yo, true, { id: 'n1', rol: 'asesorado' })).toBe(false)
    expect(puedeAbrirHilo(yo, true, undefined)).toBe(false)
  })
})
