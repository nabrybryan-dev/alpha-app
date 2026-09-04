import { describe, expect, it } from 'vitest'
import { faseDeHuella, sentidoDeHuella, type HuellaDeRepeticion } from './fantasma'

/**
 * LA HUELLA, PROBADA.
 *
 * El fantasma vive dentro del bucle de WebGL, donde jsdom no llega: lo que se puede probar
 * es la aritmética que le da su fase en cada instante, y las tres formas en que se rompe
 * —un salto entre muestras, una huella que no da para trayectoria, y el sentido al revés.
 */

const subeYBaja: HuellaDeRepeticion = { duracionSeg: 2, fase: [0, 0.5, 1, 0.5, 0] }

describe('faseDeHuella', () => {
  it('pasa por las muestras en sus instantes', () => {
    expect(faseDeHuella(subeYBaja, 0)).toBeCloseTo(0, 9)
    expect(faseDeHuella(subeYBaja, 0.5)).toBeCloseTo(0.5, 9)
    expect(faseDeHuella(subeYBaja, 1)).toBeCloseTo(1, 9)
    expect(faseDeHuella(subeYBaja, 1.5)).toBeCloseTo(0.5, 9)
  })

  it('interpola entre muestras: sin saltos a 60 Hz', () => {
    // A 10 muestras por segundo y 60 cuadros, cinco de cada seis cuadros caen entre dos
    // muestras. Con la más cercana el fantasma avanzaría a tirones.
    expect(faseDeHuella(subeYBaja, 0.25)).toBeCloseTo(0.25, 9)
    let anterior = faseDeHuella(subeYBaja, 0)!
    for (let t = 1 / 60; t <= 1; t += 1 / 60) {
      const f = faseDeHuella(subeYBaja, t)!
      expect(Math.abs(f - anterior), `salto en t=${t.toFixed(3)}`).toBeLessThan(0.02)
      anterior = f
    }
  })

  it('va en bucle y aguanta tiempos negativos', () => {
    expect(faseDeHuella(subeYBaja, 2.5)).toBeCloseTo(faseDeHuella(subeYBaja, 0.5)!, 9)
    expect(faseDeHuella(subeYBaja, -0.5)).toBeCloseTo(faseDeHuella(subeYBaja, 1.5)!, 9)
  })

  it('sin trayectoria no hay fantasma: devuelve indefinido, no cero', () => {
    // Un fantasma quieto en 0 sería un cuerpo agachado para siempre, una persona más.
    expect(faseDeHuella({ duracionSeg: 2, fase: [0.4] }, 1)).toBeUndefined()
    expect(faseDeHuella({ duracionSeg: 0, fase: [0, 1] }, 1)).toBeUndefined()
    expect(faseDeHuella(subeYBaja, Number.NaN)).toBeUndefined()
  })

  it('nunca sale de [0, 1] aunque la huella traiga ruido', () => {
    const ruidosa: HuellaDeRepeticion = { duracionSeg: 1, fase: [-0.1, 1.2, 0.3] }
    for (let t = 0; t < 1; t += 0.05) {
      const f = faseDeHuella(ruidosa, t)!
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThanOrEqual(1)
    }
  })
})

describe('sentidoDeHuella', () => {
  it('sube en la primera mitad y baja en la segunda', () => {
    expect(sentidoDeHuella(subeYBaja, 0.4)).toBe(1)
    expect(sentidoDeHuella(subeYBaja, 1.4)).toBe(-1)
  })
})
