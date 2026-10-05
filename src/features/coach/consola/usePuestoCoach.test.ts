import { describe, expect, it } from 'vitest'
import type { Capacidad } from '../../../data/consola/capacidadesStaff'
import { ocupaPuestoCoach } from './usePuestoCoach'

const con = (...lista: Capacidad[]) => (c: Capacidad) => lista.includes(c)

describe('ocupaPuestoCoach', () => {
  it('el coach, siempre; también mientras se consultan sus capacidades', () => {
    expect(ocupaPuestoCoach('coach', true, con())).toBe(true)
    expect(ocupaPuestoCoach('coach', false, con())).toBe(true)
  })

  it('la cuenta personal de Bryan (asesorado con puesto_de_coach) solo cuando la capacidad ya llegó', () => {
    expect(ocupaPuestoCoach('asesorado', false, con('puesto_de_coach'))).toBe(true)
    expect(ocupaPuestoCoach('asesorado', true, con('puesto_de_coach'))).toBe(false)
  })

  it('un asesorado cualquiera no; las demás capacidades de staff no le dan el puesto', () => {
    expect(ocupaPuestoCoach('asesorado', false, con())).toBe(false)
    expect(ocupaPuestoCoach('asesorado', false, con('leer_entrenamiento', 'ver_administracion', 'solo_tablero'))).toBe(false)
  })

  it('Manuela (nutricionista) no ocupa el puesto de coach, aunque alguien le pusiera la capacidad', () => {
    expect(ocupaPuestoCoach('nutricionista', false, con('puesto_de_coach'))).toBe(false)
  })
})
