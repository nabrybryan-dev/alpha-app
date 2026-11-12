/** Grupo 5 de «duros» (8-nov-2026): «un/una» artículo no es la cifra 1. */
import { describe, expect, it } from 'vitest'
import { correr, parche, visible } from './duros-ayuda.ts'

describe('«un/una» no es 1', () => {
  it.each(['un camello', 'como un tronco', 'una noche entera'])('sueño «%s»', (cita) => {
    const r = correr({ sueno_horas: cita })
    expect(parche(r).horasSueno).toBeUndefined()
    expect(visible(r)).toBe(true)
  })
  it('pasos «un resto»', () => {
    const r = correr({ pasos: 'un resto' })
    expect(parche(r).pasos).toBeUndefined()
    expect(visible(r)).toBe(true)
  })
  it('lo que sí es 1 sigue siéndolo', () => {
    expect(parche(correr({ sueno_horas: 'una hora' })).horasSueno).toBe(1)
    expect(parche(correr({ sueno_horas: 'hora y media' })).horasSueno).toBe(1.5)
  })
})
