/** Grupo 4 de «duros» (8-nov-2026): una cifra con unidad que no es de ese campo NO se anota. */
import { describe, expect, it } from 'vitest'
import { aguaMl, correr, parche, visible } from './duros-ayuda.ts'

describe('pasos', () => {
  it.each(['5 km', '8 kilómetros', 'una hora', '30 minutos', '25 años', '5 mil pesos', '3 series de 8', '20 pisos', '1234 pedidos'])(
    '«%s» no son pasos', (cita) => {
      const r = correr({ pasos: cita })
      expect(parche(r).pasos).toBeUndefined()
      expect(visible(r)).toBe(true)
    })
  it('lo que ya valía', () => {
    expect(parche(correr({ pasos: '6000 pasos y 20 minutos de trote' })).pasos).toBe(6000)
    expect(parche(correr({ pasos: '10k' })).pasos).toBe(10000)
    expect(parche(correr({ pasos: 'ocho mil' })).pasos).toBe(8000)
  })
})
describe('sueño', () => {
  it.each(['40 años', '3 series de 8', '8 horas de trabajo', '12 horas de turno', '3 veces'])('«%s» no son horas de sueño', (cita) => {
    const r = correr({ sueno_horas: cita })
    expect(parche(r).horasSueno).toBeUndefined()
    expect(r.pregunta).toBeUndefined()
    expect(visible(r)).toBe(true)
  })
})
describe('hora y agua', () => {
  it('«8 repeticiones» no es una hora', () => {
    const r = correr({ hora_acostarse: '8 repeticiones' })
    expect(parche(r).horaAcostarse).toBeUndefined()
    expect(visible(r)).toBe(true)
  })
  it('«70 kilos» no es agua y no se pregunta cuánta agua fue', () => {
    const r = correr({ agua: { cantidad: '70 kilos', medida: null } })
    expect(aguaMl(r)).toBe(0)
    expect(r.seguimiento).toBeUndefined()
    expect(r.descartado.length).toBe(1)
  })
})
