import { describe, expect, it } from 'vitest'
import { calcularXp, XP_POR_ACCION } from './gamification'
import { checkinCompleto, soloCompletos } from './checkinCompleto'

describe('check-in completo frente a uno a medias (Bryan, 7-nov-2026)', () => {
  it('ausente = completo (todos los check-ins anteriores a la marca)', () => {
    expect(checkinCompleto({})).toBe(true)
    expect(checkinCompleto({ parcial: false })).toBe(true)
  })

  it('a medias no cuenta', () => {
    expect(checkinCompleto({ parcial: true })).toBe(false)
  })

  it('un check-in a medias no suma puntos; al completarlo, suma los 10 de siempre', () => {
    const dia = [{ fecha: '2026-11-07', parcial: true }]
    const base = { sesiones: 0, adherenciasSi: 0, adherenciasParcial: 0, respuestas: 0, preparaciones: 0 }
    expect(calcularXp({ ...base, checkins: soloCompletos(dia).length })).toBe(0)
    const completado = [{ fecha: '2026-11-07', parcial: false }]
    expect(calcularXp({ ...base, checkins: soloCompletos(completado).length })).toBe(XP_POR_ACCION.checkin)
  })
})
