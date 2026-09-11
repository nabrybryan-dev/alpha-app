import { describe, expect, it } from 'vitest'
import {
  AMPLITUD,
  objetivoDelVaiven,
  pasoDelVaiven,
  QUIETUD,
  type EstadoDelVaiven,
} from './vaivenDeLaSala'

/**
 * EL VAIVÉN, PROBADO.
 *
 * Vive dentro del bucle de WebGL, donde jsdom no llega, así que su aritmética sale aquí.
 * Lo que se vigila son las tres formas en que un movimiento ambiental estropea una
 * pantalla: que se mueva mientras la tocas, que no pare nunca, y que dé un tirón al
 * empezar o al terminar.
 */

function estado(parcial: Partial<EstadoDelVaiven> = {}): EstadoDelVaiven {
  return { vaiven: 0, ultimoDedo: 0, reducido: false, ...parcial }
}

describe('objetivoDelVaiven', () => {
  it('con el dedo encima, el objetivo es CERO', () => {
    // Si la sala respirara bajo el dedo que la está girando, el asesorado no sabría si se
    // ha movido él o se ha movido ella — que es el fallo que este salón evita en todos sus
    // gestos.
    const ahora = 100_000
    expect(objetivoDelVaiven(estado({ ultimoDedo: ahora }), ahora)).toBe(0)
    expect(objetivoDelVaiven(estado({ ultimoDedo: ahora - QUIETUD }), ahora)).toBe(0)
  })

  it('pasado el silencio, respira dentro de su amplitud', () => {
    const ahora = 100_000
    const quieto = estado({ ultimoDedo: ahora - QUIETUD - 1 })
    for (let t = ahora; t < ahora + 6000; t += 137) {
      const objetivo = objetivoDelVaiven({ ...quieto, ultimoDedo: 0 }, t)
      expect(Math.abs(objetivo), `se pasó de amplitud en ${t}`).toBeLessThanOrEqual(AMPLITUD)
    }
  })

  it('con movimiento reducido no respira, por quieta que esté la sala', () => {
    expect(objetivoDelVaiven(estado({ reducido: true, ultimoDedo: 0 }), 100_000)).toBe(0)
  })
})

describe('pasoDelVaiven', () => {
  it('devuelve el DESVÍO, no el ángulo: el azimut es del dedo', () => {
    const antes = estado({ vaiven: 0, ultimoDedo: 0 })
    const paso = pasoDelVaiven(antes, 100_000)
    expect(paso.vaiven - antes.vaiven).toBeCloseTo(paso.desvio, 10)
  })

  it('al tocar, vuelve a cero SIN saltar', () => {
    // El objetivo pasa a 0 en cuanto hay dedo. Lo que no puede es llegar de un golpe:
    // igualado al seno, soltar daría un salto de hasta dos grados y medio.
    let s = estado({ vaiven: AMPLITUD, ultimoDedo: 100_000 })
    let mayor = 0
    for (let i = 0; i < 400; i++) {
      const paso = pasoDelVaiven(s, 100_000)
      mayor = Math.max(mayor, Math.abs(paso.desvio))
      s = { ...s, vaiven: paso.vaiven }
    }
    // NO LLEGA A CERO EXACTO, y es a propósito: la persecución se corta cuando el paso
    // baja de `DESVIO_MINIMO`, que con el 4 % ocurre alrededor de 0,02°. Ese residuo es la
    // moneda con la que se paga no repintar la sala eternamente para no moverla, y dos
    // centésimas de grado no las ve nadie. Se afirma el número en vez de aflojar el
    // criterio: si algún día el residuo crece, esto lo dice.
    expect(Math.abs(s.vaiven), 'el residuo creció').toBeLessThan(0.03)
    expect(mayor, 'volvió de un tirón').toBeLessThan(0.2)
  })

  it('PARA cuando ya no se mueve: sin eso la sala se repinta eternamente', () => {
    let s = estado({ vaiven: 0.5, ultimoDedo: 100_000 })
    let pasos = 0
    for (;;) {
      const paso = pasoDelVaiven(s, 100_000)
      if (paso.desvio === 0) break
      s = { ...s, vaiven: paso.vaiven }
      pasos += 1
      expect(pasos, 'el vaivén no se detiene nunca').toBeLessThan(1000)
    }
    expect(pasos).toBeGreaterThan(0)
  })

  it('en reposo se mueve, y siempre dentro de la amplitud', () => {
    let s = estado({ vaiven: 0, ultimoDedo: 0 })
    let movio = false
    for (let t = 0; t < 20_000; t += 16) {
      const paso = pasoDelVaiven(s, t)
      if (paso.desvio !== 0) movio = true
      s = { ...s, vaiven: paso.vaiven }
      expect(Math.abs(s.vaiven), `se pasó de amplitud en ${t}`).toBeLessThanOrEqual(AMPLITUD)
    }
    expect(movio, 'la sala no llegó a respirar').toBe(true)
  })
})
