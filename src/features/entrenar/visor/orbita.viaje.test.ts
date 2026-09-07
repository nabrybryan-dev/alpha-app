// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Orbita } from './motor'

/**
 * LA CÁMARA VIAJA, NO SALTA. Al cambiar de ejercicio el visor pone el ángulo de estudio
 * del patrón nuevo; hasta el 2026-09-06 lo ponía de golpe y, con el dedo en la sala, eso
 * era «se pierde el diseño y se va para otro lado» (Bryan). El viaje es matemática pura
 * dentro de `Orbita`, así que se prueba sin puntero: jsdom solo pone el elemento.
 */
function orbita() {
  return new Orbita(document.createElement('div'), () => {})
}

describe('el viaje de la cámara', () => {
  it('va del sitio actual al objetivo en el tiempo dado, suavizado, y termina exacto', () => {
    const o = orbita()
    o.azimut = 20
    o.elevacion = 6
    o.distancia = 4
    const t0 = 1000
    o.viajarA({ azimut: 80, elevacion: 10, distancia: 6 }, 500)
    expect(o.viajando()).toBe(true)
    // El viaje arranca donde estaba, no en el objetivo.
    o.avanzarViaje(t0 - 1000 + 0)
    expect(o.azimut).toBeCloseTo(20, 6)
    // A mitad de tiempo va más de la mitad del camino: sale rápido y llega despacio.
    o.viajarA({ azimut: 80, elevacion: 10, distancia: 6 }, 500)
    const arranque = performance.now()
    o.avanzarViaje(arranque + 250)
    expect(o.azimut).toBeGreaterThan(50)
    expect(o.azimut).toBeLessThan(80)
    // Y al final está exacto y el viaje ha terminado.
    expect(o.avanzarViaje(arranque + 600)).toBe(true)
    expect(o.azimut).toBeCloseTo(80, 9)
    expect(o.elevacion).toBeCloseTo(10, 9)
    expect(o.distancia).toBeCloseTo(6, 9)
    expect(o.viajando()).toBe(false)
    expect(o.avanzarViaje(arranque + 700)).toBe(false)
  })

  it('el azimut va por el camino corto: de 350° a 10° son 20°, no 340', () => {
    const o = orbita()
    o.azimut = 350
    o.viajarA({ azimut: 10, elevacion: o.elevacion, distancia: o.distancia }, 400)
    const arranque = performance.now()
    o.avanzarViaje(arranque + 200)
    // Pasa por 360 (= 0), no retrocede por 180.
    expect(o.azimut).toBeGreaterThan(350)
    expect(o.azimut).toBeLessThan(370)
    o.avanzarViaje(arranque + 500)
    expect(((o.azimut % 360) + 360) % 360).toBeCloseTo(10, 9)
  })

  it('un dedo encima corta el viaje: la cámara es de quien la toca', () => {
    const el = document.createElement('div')
    el.setPointerCapture = () => {}
    const o = new Orbita(el, () => {})
    o.viajarA({ azimut: 90, elevacion: 5, distancia: 3 }, 400)
    expect(o.viajando()).toBe(true)
    el.dispatchEvent(new Event('pointerdown'))
    expect(o.viajando()).toBe(false)
  })
})
