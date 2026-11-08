/** Grupo 1 de «duros» (8-nov-2026): con dos cifras en conflicto (corrección o ruido) se PREGUNTA, no gana la primera. */
import { describe, expect, it } from 'vitest'
import { aguaMl, correr, opciones, parche, visible } from './duros-ayuda.ts'

describe('dos cifras en conflicto: se pregunta con las dos', () => {
  it('sueño «8 horas, bueno, 6»', () => {
    const r = correr({ sueno_horas: '8 horas, bueno, 6' })
    expect(parche(r).horasSueno).toBeUndefined()
    expect(opciones(r)).toEqual(['8 horas', '6 horas'])
  })
  it('sueño «cero horas, dormí 2»', () => {
    const r = correr({ sueno_horas: 'cero horas, dormí 2' })
    expect(parche(r).horasSueno).toBeUndefined()
    expect(visible(r)).toBe(true)
  })
  it('sueño «a las 2 me desperté y dormí otras 4 horas»', () => {
    const r = correr({ sueno_horas: 'a las 2 me desperté y dormí otras 4 horas' })
    expect(parche(r).horasSueno).toBeUndefined()
    expect(visible(r)).toBe(true)
  })
  it('pasos «8 mil, no, 6 mil»', () => {
    const r = correr({ pasos: '8 mil, no, 6 mil' })
    expect(parche(r).pasos).toBeUndefined()
    expect(opciones(r)).toEqual(['8.000 pasos', '6.000 pasos'])
  })
  it('hora «no me acosté a las 10 sino a las 11»', () => {
    const r = correr({ hora_acostarse: 'no me acosté a las 10 sino a las 11' })
    expect(parche(r).horaAcostarse).toBeUndefined()
    expect(opciones(r)).toEqual(['22:00', '23:00'])
  })
  it('agua «dos vasos, no, tres»', () => {
    const r = correr({ agua: { cantidad: 'dos vasos, no, tres', medida: null } })
    expect(aguaMl(r)).toBe(0)
    expect(visible(r)).toBe(true)
  })
  it('lo que ya valía sigue valiendo', () => {
    expect(parche(correr({ sueno_horas: 'como seis horas aunque me desperté tres veces' })).horasSueno).toBe(6)
    expect(parche(correr({ sueno_horas: '6 horas y 30 minutos' })).horasSueno).toBe(6.5)
    expect(parche(correr({ sueno_horas: 'siete horas y media aunque con 2 despertadas' })).horasSueno).toBe(7.5)
    expect(parche(correr({ pasos: 'ocho mil pasos, y subí 20 pisos' })).pasos).toBe(8000)
  })
})
