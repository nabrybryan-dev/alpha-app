import { describe, expect, it } from 'vitest'
import {
  capaTrasHundir,
  ESCALON_MS,
  ESPERA,
  MAS_ADENTRO,
  siguePresionando,
  TOLERANCIA,
} from './hundirEnElCuerpo'

/**
 * HUNDIR EL DEDO EN EL CUERPO, PROBADO.
 *
 * El gesto sustituye a los cinco botones que había pegados al borde, así que si esta
 * aritmética falla no hay otro camino a las capas: no es un atajo, es la puerta.
 */

describe('capaTrasHundir', () => {
  it('un toque corto NO entra: es el roce de quien empieza a orbitar', () => {
    // El sujeto es también la superficie por la que se gira la cámara. Sin espera, el
    // salón cambiaría de capa cada vez que alguien apoya el dedo para orbitar.
    expect(capaTrasHundir(0, 0)).toBe(0)
    expect(capaTrasHundir(ESPERA - 1, 0)).toBe(0)
  })

  it('cruzada la espera, entra una capa', () => {
    expect(capaTrasHundir(ESPERA, 0)).toBe(1)
  })

  it('aguantando se sigue entrando, capa a capa', () => {
    expect(capaTrasHundir(ESPERA + ESCALON_MS, 0)).toBe(2)
    expect(capaTrasHundir(ESPERA + ESCALON_MS * 2, 0)).toBe(3)
    expect(capaTrasHundir(ESPERA + ESCALON_MS * 3, 0)).toBe(4)
  })

  it('se para en el hueso y NO da la vuelta a la piel', () => {
    // Un ciclo convertiría «me he metido demasiado» en «he perdido el sitio». Para salir
    // se arrastra hacia arriba, que es el gesto contrario y ya existe.
    expect(capaTrasHundir(ESPERA + ESCALON_MS * 9, 0)).toBe(MAS_ADENTRO)
    expect(capaTrasHundir(60_000, 0)).toBe(MAS_ADENTRO)
  })

  it('sigue desde donde estaba, no desde la piel', () => {
    // Quien ya está en el músculo y vuelve a apretar sigue hacia dentro.
    expect(capaTrasHundir(ESPERA, 2)).toBe(3)
    expect(capaTrasHundir(ESPERA + ESCALON_MS, 2)).toBe(4)
    expect(capaTrasHundir(ESPERA, 4)).toBe(4)
  })

  it('nunca devuelve una capa fuera del eje', () => {
    for (const ms of [0, 100, 500, 1200, 5000, 90_000]) {
      for (const desde of [0, 1, 2, 3, 4] as const) {
        const capa = capaTrasHundir(ms, desde)
        expect(capa, `${ms}ms desde ${desde}`).toBeGreaterThanOrEqual(0)
        expect(capa).toBeLessThanOrEqual(MAS_ADENTRO)
        // Y nunca sale hacia fuera: hundir solo entra.
        expect(capa).toBeGreaterThanOrEqual(desde)
      }
    }
  })
})

describe('siguePresionando', () => {
  it('un dedo apoyado tiembla, y eso no cancela nada', () => {
    expect(siguePresionando(0, 0)).toBe(true)
    expect(siguePresionando(4, 4)).toBe(true)
  })

  it('pasada la tolerancia ya es un arrastre, no una presión', () => {
    expect(siguePresionando(TOLERANCIA + 1, 0)).toBe(false)
    expect(siguePresionando(0, -20)).toBe(false)
  })

  it('mide la distancia REAL, no cada eje por su cuenta', () => {
    // En diagonal, 7 y 7 son casi diez píxeles de recorrido: por ejes pasaría como
    // presión, y el dedo ya se habría ido del sitio.
    expect(siguePresionando(7, 7)).toBe(false)
  })
})
