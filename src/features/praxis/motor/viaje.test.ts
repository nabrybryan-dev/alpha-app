import { describe, expect, it } from 'vitest'
import { ARRANQUE_S, FRENADO_S, REALCE_REDUCIDO, VEL_BASE, VEL_PULSO_MAX, activo, avanzar, detener, empezar, largoDelRayo, pulsar, realce, soltar, viajeNuevo } from './viaje'

/** Recorre `seg` segundos en cuadros de `dt` y devuelve la velocidad del último. */
function correr(e: ReturnType<typeof viajeNuevo>, seg: number, reducido = false, dt = 1 / 60): number {
  let v = e.v
  for (let t = 0; t < seg - 1e-9; t += dt) v = avanzar(e, Math.min(dt, seg - t), reducido)
  return v
}

describe('viaje · la velocidad en función del tiempo', () => {
  it('en reposo no hay velocidad ni nada activo', () => {
    const e = viajeNuevo()
    expect(correr(e, 1)).toBe(0)
    expect(activo(e)).toBe(false)
  })

  it('arranca suave: nada en el primer instante, la mitad a media aceleración y la base a los 400 ms', () => {
    const e = viajeNuevo()
    empezar(e)
    expect(e.v).toBe(0)
    const medio = correr(e, ARRANQUE_S / 2)
    expect(medio).toBeGreaterThan(VEL_BASE * 0.4)
    expect(medio).toBeLessThan(VEL_BASE * 0.6) // curva suave: a la mitad del tiempo, la mitad de la velocidad
    const fin = correr(e, ARRANQUE_S / 2)
    expect(fin).toBeCloseTo(VEL_BASE, 2)
    expect(activo(e)).toBe(true)
  })

  it('la aceleración no da tirones: de un cuadro al siguiente nunca salta más de 0,05', () => {
    const e = viajeNuevo()
    empezar(e)
    let ant = 0, salto = 0
    for (let i = 0; i < 90; i++) { const v = avanzar(e, 1 / 60, false); salto = Math.max(salto, Math.abs(v - ant)); ant = v }
    expect(salto).toBeLessThan(0.05)
  })

  it('cada resultado del reconocedor sube la velocidad un poco, con tope, y la suelta en un par de segundos', () => {
    const e = viajeNuevo()
    empezar(e)
    correr(e, 1)
    const base = e.v
    pulsar(e)
    const subida = correr(e, 0.3)
    expect(subida).toBeGreaterThan(base + 0.03)
    for (let i = 0; i < 10; i++) pulsar(e)
    const tope = correr(e, 1)
    expect(tope).toBeLessThanOrEqual(VEL_BASE + VEL_PULSO_MAX + 1e-6)
    expect(tope).toBeLessThanOrEqual(1)
    expect(correr(e, 3)).toBeCloseTo(VEL_BASE, 1) // sin más resultados vuelve a la base
  })

  it('un pulso sin escuchar no hace nada', () => {
    const e = viajeNuevo()
    pulsar(e)
    expect(correr(e, 1)).toBe(0)
  })

  it('al soltar frena con inercia: baja sin saltos y llega a 0 a los 600 ms', () => {
    const e = viajeNuevo()
    empezar(e)
    correr(e, 1)
    const v0 = e.v
    soltar(e)
    const mitad = correr(e, FRENADO_S / 2)
    expect(mitad).toBeCloseTo(v0 * 0.25, 2) // cae al cuadrado: a media frenada queda un cuarto
    expect(mitad).toBeGreaterThan(0)
    expect(correr(e, FRENADO_S / 2)).toBe(0)
    expect(activo(e)).toBe(false)
  })

  it('el frenado nunca sube y no hace falta más tiempo que el dicho', () => {
    const e = viajeNuevo()
    empezar(e)
    correr(e, 1); pulsar(e); correr(e, 0.2)
    soltar(e)
    let ant = e.v
    for (let t = 0; t < FRENADO_S; t += 1 / 60) { const v = avanzar(e, 1 / 60, false); expect(v).toBeLessThanOrEqual(ant + 1e-9); ant = v }
    avanzar(e, 0.02, false)
    expect(e.v).toBe(0)
  })

  it('si se vuelve a presionar mientras frena, arranca desde donde iba (sin salto)', () => {
    const e = viajeNuevo()
    empezar(e); correr(e, 1); soltar(e)
    const frenando = correr(e, 0.2)
    empezar(e)
    expect(e.v).toBe(frenando)
    const siguiente = avanzar(e, 1 / 60, false)
    expect(Math.abs(siguiente - frenando)).toBeLessThan(0.02)
  })

  it('da lo mismo a 30 que a 60 cuadros por segundo', () => {
    const a = viajeNuevo(), b = viajeNuevo()
    empezar(a); empezar(b)
    expect(correr(a, 0.4, false, 1 / 60)).toBeCloseTo(correr(b, 0.4, false, 1 / 30), 2)
  })

  it('el rayo crece con la velocidad y en reposo no existe', () => {
    expect(largoDelRayo(0)).toBe(0)
    expect(largoDelRayo(0.3)).toBeLessThan(largoDelRayo(0.6))
    expect(largoDelRayo(0.6)).toBeLessThan(largoDelRayo(1))
  })

  it('detener corta todo de golpe', () => {
    const e = viajeNuevo()
    empezar(e); correr(e, 1)
    detener(e)
    expect(e.v).toBe(0)
    expect(activo(e)).toBe(false)
  })
})

describe('viaje · movimiento reducido', () => {
  it('con movimiento reducido la velocidad es 0 aunque se escuche y se pulse', () => {
    const e = viajeNuevo()
    empezar(e)
    for (let i = 0; i < 120; i++) { if (i % 10 === 0) pulsar(e); expect(avanzar(e, 1 / 60, true)).toBe(0) }
    expect(e.v).toBe(0)
  })

  it('si el movimiento se reduce a mitad del viaje, se queda quieto al instante', () => {
    const e = viajeNuevo()
    empezar(e); correr(e, 1)
    expect(e.v).toBeGreaterThan(0.5)
    expect(avanzar(e, 1 / 60, true)).toBe(0)
  })

  it('solo queda un leve aumento de brillo, y solo mientras se escucha', () => {
    const e = viajeNuevo()
    expect(realce(e, true)).toBe(0)
    empezar(e)
    expect(realce(e, true)).toBe(REALCE_REDUCIDO)
    expect(realce(e, true)).toBeLessThan(0.2)
    expect(realce(e, false)).toBe(0) // con movimiento normal no hay realce: hay viaje
    soltar(e)
    expect(realce(e, true)).toBe(0)
  })
})
