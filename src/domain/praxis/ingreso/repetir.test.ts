import { describe, expect, it } from 'vitest'
import { pedirDeNuevo, repetirEnCorto } from './repetir'
import { TURNOS_VOZ } from './guion'

describe('el ingreso por voz nunca dice «no te entendí»', () => {
  it.each(['preciso', 'contexto', 'si_no'] as const)('bloque %s: repite la pregunta y pide el dato concreto, en tú y en usted', (b) => {
    for (const usted of [false, true]) {
      const t = pedirDeNuevo(b, '¿Cuántos años tienes?', usted)
      expect(t).toContain('¿Cuántos años tienes?')
      expect(t).not.toMatch(/no (te |le )?entend|no supe|no comprend/i)
    }
  })
  it('preciso pide el dato; contexto pide una o dos frases; sí/no pide sí o no', () => {
    expect(pedirDeNuevo('preciso', 'x', false)).toMatch(/solo el dato/)
    expect(pedirDeNuevo('contexto', 'x', false)).toMatch(/una o dos frases/)
    expect(pedirDeNuevo('si_no', 'x', false)).toMatch(/¿Sí o no\?/)
  })
  it('el trato no se mezcla', () => {
    expect(pedirDeNuevo('preciso', 'x', true)).toMatch(/Dígame/)
    expect(pedirDeNuevo('preciso', 'x', false)).toMatch(/Dime/)
    expect(repetirEnCorto('¿Algo te duele hoy?', true)).toMatch(/^Se lo repito/)
    expect(repetirEnCorto('¿Algo te duele hoy?', false)).toMatch(/^Te lo repito/)
  })
  it('sirve para todos los turnos reales del guion', () => {
    for (const t of TURNOS_VOZ) expect(pedirDeNuevo(t.bloque, 'pregunta', false)).toContain('pregunta')
  })
})
