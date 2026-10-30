import { describe, expect, it } from 'vitest'
import { PASOS_DE_TRANSICION, TRANSICION_MS } from './pintura'
import { horaParaPintar, instantesDeLaTransicion } from './transicion'

/**
 * La transición del rojo a «trabajado» solo avanza si alguien pide cuadros: estos son los
 * instantes en que el salón los pide (revisión ciega del 26-oct, N1).
 */
describe('instantes de la transición', () => {
  it('pide un cuadro en cada paso, desde el arranque hasta el final', () => {
    const t = instantesDeLaTransicion({ pecho: 1000 }, 0, false)
    expect(t).toHaveLength(PASOS_DE_TRANSICION + 1)
    expect(t[0]).toBe(1000)
    expect(t.at(-1)).toBe(1000 + TRANSICION_MS)
  })

  it('a mitad de camino solo pide los pasos que faltan', () => {
    const t = instantesDeLaTransicion({ pecho: 1000 }, 1000 + TRANSICION_MS / 2, false)
    expect(t.every((x) => x > 1000 + TRANSICION_MS / 2)).toBe(true)
    expect(t.at(-1)).toBe(1000 + TRANSICION_MS)
  })

  it('una transición terminada no pide nada', () => {
    expect(instantesDeLaTransicion({ pecho: 1000 }, 1000 + TRANSICION_MS, false)).toEqual([])
  })

  it('con movimiento reducido pide un solo cuadro, en el arranque', () => {
    expect(instantesDeLaTransicion({ pecho: 1000, delt: 1000 }, 0, true)).toEqual([1000])
  })

  it('con movimiento reducido se pinta adelantado una transición entera: de rojo a final de golpe', () => {
    expect(horaParaPintar(500, true)).toBe(500 + TRANSICION_MS)
    expect(horaParaPintar(500, false)).toBe(500)
  })
})
