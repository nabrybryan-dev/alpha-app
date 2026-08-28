import { describe, expect, it } from 'vitest'
import { radioDePorcion } from './musculos'

describe('el grosor a lo largo del músculo', () => {
  const RADIO = 0.02

  it('es fino en los extremos y grueso en el vientre', () => {
    // Un músculo no es un tubo: son dos tendones y un vientre.
    const centro = radioDePorcion(0.5, RADIO, 1, 1)
    for (const t of [0, 1]) {
      expect(centro, `t=${t}`).toBeGreaterThan(radioDePorcion(t, RADIO, 1, 1) * 3)
    }
  })

  it('engorda el vientre al acortarse', () => {
    // Volumen constante: lo que pierde de largo lo gana de ancho, que es lo que
    // hay que ver de un patrón.
    const reposo = radioDePorcion(0.5, RADIO, 1, 1)
    const contraido = radioDePorcion(0.5, RADIO, 1.4, 1)
    expect(contraido).toBeGreaterThan(reposo * 1.3)
  })

  it('deja el tendón igual por mucho que se contraiga', () => {
    // Un tendón es colágeno: transmite fuerza y no cambia de grosor. Antes el
    // ensanche se aplicaba al tubo entero y el músculo se movía como una goma.
    for (const t of [0, 0.01, 0.99, 1]) {
      const reposo = radioDePorcion(t, RADIO, 1, 1)
      const contraido = radioDePorcion(t, RADIO, 1.55, 1)
      expect(contraido / reposo, `en t=${t} el tendón engorda`).toBeLessThan(1.06)
    }
  })

  it('reparte el engorde según lo carnoso que sea cada punto', () => {
    // No es un interruptor: entre el tendón y el vientre hay transición, o se
    // vería un escalón donde el músculo cambia de grosor de golpe.
    const razon = (t: number) => radioDePorcion(t, RADIO, 1.5, 1) / radioDePorcion(t, RADIO, 1, 1)
    expect(razon(0.5)).toBeGreaterThan(razon(0.25))
    expect(razon(0.25)).toBeGreaterThan(razon(0.05))
  })
})
