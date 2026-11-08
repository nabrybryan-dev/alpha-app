/** Grupo 6 de «duros» (8-nov-2026): una palabra mal dictada no da 1.000 ni se calla. */
import { describe, expect, it } from 'vitest'
import { correr, parche, visible } from './duros-ayuda.ts'

describe('voz mal escrita', () => {
  it.each(['sinco mil', 'dose mil pasos'])('pasos «%s» no es 1.000', (cita) => {
    const r = correr({ pasos: cita })
    expect(parche(r).pasos).toBeUndefined()
    expect(visible(r)).toBe(true)
  })
  it.each(['a las onze', 'a las 25'])('hora «%s» no se calla', (cita) => {
    const r = correr({ hora_acostarse: cita })
    expect(parche(r).horaAcostarse).toBeUndefined()
    expect(visible(r)).toBe(true)
  })
  it('lo que ya valía', () => {
    expect(parche(correr({ pasos: 'cinco mil' })).pasos).toBe(5000)
    expect(parche(correr({ pasos: 'mil doscientos pasos' })).pasos).toBe(1200)
    expect(parche(correr({ hora_acostarse: 'a las once' })).horaAcostarse).toBe('23:00')
  })
})
