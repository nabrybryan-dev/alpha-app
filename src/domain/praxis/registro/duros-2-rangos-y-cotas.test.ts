/** Grupo 2 de «duros» (8-nov-2026): rangos sin conector se preguntan; «menos de», «más de», «ni N» no dejan el número pelado. */
import { describe, expect, it } from 'vitest'
import { correr, opciones, parche, visible } from './duros-ayuda.ts'

describe('rangos sin «o»', () => {
  it('«cinco, seis horas» pregunta, no suma 11', () => {
    const r = correr({ sueno_horas: 'cinco, seis horas' })
    expect(parche(r).horasSueno).toBeUndefined()
    expect(opciones(r)).toEqual(['5 horas', '6 horas'])
  })
  it('«tipo 5 y 6 horas» pregunta', () => {
    const r = correr({ sueno_horas: 'tipo 5 y 6 horas' })
    expect(parche(r).horasSueno).toBeUndefined()
    expect(opciones(r)).toEqual(['5 horas', '6 horas'])
  })
  it('«8, 9 mil pasos» pregunta', () => {
    const r = correr({ pasos: '8, 9 mil pasos' })
    expect(parche(r).pasos).toBeUndefined()
    expect(opciones(r)).toEqual(['8.000 pasos', '9.000 pasos'])
  })
  it('lo que ya valía: «cinco y cuarenta», «seis horas y veinte»', () => {
    expect(parche(correr({ sueno_horas: 'seis horas y veinte' })).horasSueno).toBe(6.3)
    expect(parche(correr({ sueno_horas: 'cinco y cuarenta' })).horasSueno).toBe(5.7)
  })
})

describe('cotas: no se anota el número pelado', () => {
  it.each([
    ['sueno_horas', 'menos de 5 horas', 'horasSueno'], ['sueno_horas', 'ni 4 horas', 'horasSueno'],
    ['sueno_horas', 'ni 3 horas seguidas', 'horasSueno'], ['pasos', 'más de 10 mil pasos', 'pasos'],
    ['pasos', 'ni a 3000 pasos', 'pasos'],
  ] as const)('%s «%s»', (campo, cita, clave) => {
    const r = correr({ [campo]: cita })
    expect(parche(r)[clave]).toBeUndefined()
    expect(visible(r)).toBe(true)
  })
})
