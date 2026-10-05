import { describe, expect, it } from 'vitest'
import { masaMagraEstimada } from './composicionEstimada'
import { masaMagraKg as masaMagraNavy } from '../nutricion/composicion'
import type { MedidaCorporal } from '../types'

const BASE: MedidaCorporal = {
  fecha: '2026-09-27',
  pesoKg: 70,
  alturaCm: 175,
  perimetros: {},
}

describe('masaMagraEstimada', () => {
  it('gana la masa magra ya medida (bioimpedancia) sobre cualquier estimación', () => {
    const medida: MedidaCorporal = { ...BASE, masaMagraKg: 55, cuerpo: { cinturaCm: 82, cuelloCm: 38 } }
    expect(masaMagraEstimada(medida, 'hombre')).toBe(55)
  })

  it('sin sexo no hay fórmula: undefined aunque estén cintura y cuello', () => {
    const medida: MedidaCorporal = { ...BASE, cuerpo: { cinturaCm: 82, cuelloCm: 38 } }
    expect(masaMagraEstimada(medida, undefined)).toBeUndefined()
  })

  it('sin peso no hay de qué calcular la masa magra', () => {
    const medida: MedidaCorporal = { ...BASE, pesoKg: undefined, cuerpo: { cinturaCm: 82, cuelloCm: 38 } }
    expect(masaMagraEstimada(medida, 'hombre')).toBeUndefined()
  })

  it('en hombre, sin cuello no se estima aunque haya cintura', () => {
    const medida: MedidaCorporal = { ...BASE, cuerpo: { cinturaCm: 82 } }
    expect(masaMagraEstimada(medida, 'hombre')).toBeUndefined()
  })

  it('en hombre, con cintura y cuello (y sin caderas, que no le hace falta) sí estima', () => {
    const medida: MedidaCorporal = { ...BASE, cuerpo: { cinturaCm: 82, cuelloCm: 38 } }
    const esperado = masaMagraNavy({ pesoKg: 70, alturaCm: 175, cuelloCm: 38, cinturaCm: 82, genero: 'H' })
    expect(esperado).not.toBeNull()
    expect(masaMagraEstimada(medida, 'hombre')).toBe(esperado)
  })

  it('en mujer, sin caderas no se estima aunque haya cintura y cuello', () => {
    const medida: MedidaCorporal = { ...BASE, cuerpo: { cinturaCm: 70, cuelloCm: 32 } }
    expect(masaMagraEstimada(medida, 'mujer')).toBeUndefined()
  })

  it('en mujer, con las tres (cintura, cuello y caderas) sí estima', () => {
    const medida: MedidaCorporal = { ...BASE, cuerpo: { cinturaCm: 70, cuelloCm: 32, caderasCm: 98 } }
    const esperado = masaMagraNavy({
      pesoKg: 70,
      alturaCm: 175,
      cuelloCm: 32,
      cinturaCm: 70,
      genero: 'M',
      caderaCm: 98,
    })
    expect(esperado).not.toBeNull()
    expect(masaMagraEstimada(medida, 'mujer')).toBe(esperado)
  })

  it('una medida imposible (cintura menor que cuello) devuelve undefined, nunca un número inventado', () => {
    const medida: MedidaCorporal = { ...BASE, cuerpo: { cinturaCm: 30, cuelloCm: 38 } }
    expect(masaMagraEstimada(medida, 'hombre')).toBeUndefined()
  })
})
