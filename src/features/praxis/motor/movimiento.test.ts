import { describe, expect, it } from 'vitest'
import { DUR, M_ECO, M_GEOMETRIA, bezier, curvaDesliz, muelle } from './movimiento'
import { ritmoLectura, yArco } from './texto'

/** Lo que jsdom sí puede probar del movimiento: las funciones puras (spec §6, «Pruebas»). */
function simular(respuesta: number, amort: number, segundos: number) {
  const s = { x: 0, v: 0 }
  let pico = 0
  for (let t = 0; t < segundos; t += 1 / 60) {
    muelle(s, 1, 1 / 60, respuesta, amort)
    pico = Math.max(pico, s.x)
  }
  return { x: s.x, pico }
}

describe('muelle', () => {
  it('GEOMETRIA asienta en ≤ 450 ms y sin sobrepaso', () => {
    const { x, pico } = simular(M_GEOMETRIA[0], M_GEOMETRIA[1], 0.45)
    expect(x).toBeGreaterThan(0.97)
    expect(pico).toBeLessThanOrEqual(1.0005)
  })

  it('ANILLO_ECO es el único rebote: un sobrepaso pequeño, de menos del 4 %', () => {
    const { x, pico } = simular(M_ECO[0], M_ECO[1], 2)
    expect(pico).toBeGreaterThan(1.01)
    expect(pico).toBeLessThan(1.04)
    expect(x).toBeCloseTo(1, 2)
  })

  it('es estable a 30, 60 y 120 Hz: llega al mismo sitio', () => {
    const fin = [30, 60, 120].map((hz) => {
      const s = { x: 0, v: 0 }
      for (let i = 0; i < Math.round(0.3 * hz); i++) muelle(s, 1, 1 / hz)
      return s.x
    })
    expect(Math.abs(fin[0] - fin[2])).toBeLessThan(0.03)
    expect(Math.abs(fin[1] - fin[2])).toBeLessThan(0.03)
  })
})

describe('curvas', () => {
  it('una bezier empieza en 0, acaba en 1 y es monótona', () => {
    const c = bezier(0.23, 1, 0.32, 1)
    expect(c(0)).toBe(0)
    expect(c(1)).toBe(1)
    let antes = 0
    for (let x = 0.05; x < 1; x += 0.05) {
      const y = c(x)
      expect(y).toBeGreaterThanOrEqual(antes - 1e-6)
      antes = y
    }
  })

  it('el deslizamiento es un seno simétrico: a mitad de camino va por la mitad', () => {
    expect(curvaDesliz(0.5)).toBeCloseTo(0.5, 2)
  })

  it('nada que se repita en una sesión pasa de 360 ms', () => {
    expect(DUR.toque).toBeLessThanOrEqual(360)
    expect(DUR.base).toBeLessThanOrEqual(360)
    expect(DUR.panel).toBeLessThanOrEqual(360)
  })
})

describe('órbitas', () => {
  it('la nota cae sobre su arco: extremos en y0 y centro a medio camino del control', () => {
    expect(yArco(0, 22, 6)).toBe(22)
    expect(yArco(1, 22, 6)).toBe(22)
    expect(yArco(0.5, 22, 6)).toBe(14)
  })
})

describe('ritmo de lectura', () => {
  it('el saludo de la primera vez se lee en unos 5 s', () => {
    const frase =
      'Buenos días. Soy Praxis, una voz sintética, no una persona. Bryan y Manuela leen tu resumen después. ¿Cómo dormiste y cómo amaneciste?'
    const r = ritmoLectura(frase.split(/\s+/))
    expect(r.inicios).toHaveLength(22)
    expect(r.dur).toBeGreaterThan(4)
    expect(r.dur).toBeLessThan(6)
  })

  it('los inicios crecen: ninguna palabra se enciende antes que la anterior', () => {
    const r = ritmoLectura('uno, dos. tres cuatro'.split(' '))
    for (let i = 1; i < r.inicios.length; i++) expect(r.inicios[i]).toBeGreaterThan(r.inicios[i - 1])
  })
})
