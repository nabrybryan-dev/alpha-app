import { describe, expect, it } from 'vitest'
import { Orbita } from './motor'

/**
 * LA CÁMARA SE RETIRA, NO EL LIENZO.
 *
 * `retirada` es el múltiplo de la distancia con el que la sala se aleja al subir la lectura
 * (1,136 = «al 88 %») y se acerca un pelo con el dedo dentro (0,96). Sustituye a dos
 * `scale()` de CSS que reescalaban la imagen ya pintada — el «pixelea cuando se dan
 * movimientos» de Bryan, 2026-09-05. Va aparte de `distancia` para que el pellizco de dos
 * dedos siga editando la suya.
 */
describe('Orbita.retirada', () => {
  const nueva = () => {
    const o = new Orbita(document.createElement('div'), () => {})
    o.centro = [0, 1, 0]
    o.azimut = 0
    o.elevacion = 0
    o.distancia = 2
    return o
  }
  const lejos = (o: Orbita) => {
    const p = o.ojo()
    return Math.hypot(p[0] - o.centro[0], p[1] - o.centro[1], p[2] - o.centro[2])
  }

  it('nace en 1: la cámara está donde dice `distancia`', () => {
    const o = nueva()
    expect(o.retirada).toBe(1)
    expect(lejos(o)).toBeCloseTo(2, 9)
  })

  it('multiplica la distancia sin tocarla: 1,136 aleja la sala al 88 %', () => {
    const o = nueva()
    o.retirada = 1.136
    expect(lejos(o)).toBeCloseTo(2 * 1.136, 9)
    expect(o.distancia).toBe(2)
  })

  it('se compone con el pellizco: cada uno edita lo suyo', () => {
    const o = nueva()
    o.retirada = 0.96
    o.distancia = 3
    expect(lejos(o)).toBeCloseTo(3 * 0.96, 9)
  })

  it('no mueve el centro ni el ángulo, solo cuánto de lejos', () => {
    const o = nueva()
    const antes = o.ojo()
    o.retirada = 2
    const despues = o.ojo()
    // Misma dirección desde el centro, el doble de lejos.
    for (let k = 0; k < 3; k++) {
      expect(despues[k] - o.centro[k]).toBeCloseTo((antes[k] - o.centro[k]) * 2, 9)
    }
  })
})
