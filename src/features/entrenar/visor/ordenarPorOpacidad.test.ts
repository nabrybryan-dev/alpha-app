import { describe, expect, it } from 'vitest'
import { Malla } from '../../../domain/patrones/malla'
import { ordenarPorOpacidad } from './motor'

/**
 * EL ORDEN DE DIBUJO, PROBADO SIN WEBGL.
 *
 * La mezcla alfa solo sale bien si lo opaco va delante con profundidad y lo translúcido
 * detrás sin escribirla. El motor no se puede montar en jsdom; esta función suelta es la
 * que decide el orden y dónde se parte, y se prueba con mallas de tres triángulos.
 */

function malla(alfa: number, triangulos: number): Malla {
  const m = new Malla(64)
  for (let i = 0; i < triangulos; i++) {
    const b = i * 3
    m.vertice([0, 0, 0], [0, 1, 0], [1, 1, 1], 0)
    m.vertice([1, 0, 0], [0, 1, 0], [1, 1, 1], 0)
    m.vertice([0, 0, 1], [0, 1, 0], [1, 1, 1], 0)
    m.triangulo(b, b + 1, b + 2)
  }
  m.alfa = alfa
  return m
}

describe('ordenarPorOpacidad', () => {
  it('las opacas delante, las translúcidas detrás, y el corte en índices', () => {
    const a = malla(1, 2)
    const fantasma = malla(0.38, 3)
    const b = malla(1, 1)
    const { ordenadas, indicesOpacos } = ordenarPorOpacidad([a, fantasma, b])
    expect(ordenadas).toEqual([a, b, fantasma])
    // Dos triángulos más uno: nueve índices opacos. Ahí parte `dibujar()`.
    expect(indicesOpacos).toBe(9)
  })

  it('es estable: entre iguales conserva el orden de llegada', () => {
    const x = malla(1, 1)
    const y = malla(1, 1)
    const z = malla(1, 1)
    expect(ordenarPorOpacidad([x, y, z]).ordenadas).toEqual([x, y, z])
  })

  it('sin translúcidas, todo es opaco y no cambia nada', () => {
    const x = malla(1, 4)
    const { ordenadas, indicesOpacos } = ordenarPorOpacidad([x])
    expect(ordenadas).toEqual([x])
    expect(indicesOpacos).toBe(12)
  })

  it('una malla nace opaca: el alfa por defecto es 1', () => {
    expect(new Malla(8).alfa).toBe(1)
  })

  it('lo marcado `encima` va al FINAL, aunque sea opaco, y se cuenta aparte', () => {
    const cuerpo = malla(1, 3)
    const fantasma = malla(0.4, 2)
    const fuerzas = malla(1, 4)
    fuerzas.encima = true
    const { ordenadas, indicesOpacos, indicesEncima } = ordenarPorOpacidad([fuerzas, cuerpo, fantasma])
    expect(ordenadas).toEqual([cuerpo, fantasma, fuerzas])
    expect(indicesOpacos).toBe(9)
    expect(indicesEncima).toBe(12)
  })

  it('una malla nace debajo: `encima` es false por defecto', () => {
    expect(new Malla(8).encima).toBe(false)
  })
})
