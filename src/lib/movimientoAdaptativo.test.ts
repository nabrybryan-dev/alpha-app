/**
 * EL MOVIMIENTO ADAPTATIVO DECIDE BIEN, Y SOBRE TODO NO DEGRADA POR ERROR.
 *
 * Lo que se protege aquí no es que apague cosas: es que NO las apague cuando no
 * debe. Una app que se pone en modo pobre porque una medición salió rara le
 * quita la versión buena a alguien que la tenía bien, y eso no se nota ni se
 * reporta: simplemente se ve peor para siempre.
 */

import { describe, expect, it } from 'vitest'
import { FPS_MINIMO, nivelDeMovimiento } from './movimientoAdaptativo'

describe('nivelDeMovimiento', () => {
  const base = { reducido: false, fps: 60, enSerie: false }

  it('con todo bien, movimiento pleno', () => {
    expect(nivelDeMovimiento(base)).toBe('pleno')
  })

  it('la preferencia del sistema gana a todo lo demás', () => {
    // Aunque el aparato vaya sobrado y no haya serie en curso. Y también al
    // revés: no hay contexto que pueda REACTIVAR el movimiento.
    expect(nivelDeMovimiento({ ...base, reducido: true })).toBe('minimo')
    expect(nivelDeMovimiento({ reducido: true, fps: 120, enSerie: false })).toBe('minimo')
    expect(nivelDeMovimiento({ reducido: true, fps: 10, enSerie: true })).toBe('minimo')
  })

  it('durante una serie baja a sobrio aunque el aparato vaya sobrado', () => {
    // No es rendimiento: es que a mitad de una serie el ambiente compite con el
    // número que hay que leer.
    expect(nivelDeMovimiento({ ...base, fps: 120, enSerie: true })).toBe('sobrio')
  })

  it('baja a sobrio si el aparato no llega', () => {
    expect(nivelDeMovimiento({ ...base, fps: FPS_MINIMO - 1 })).toBe('sobrio')
  })

  it('no baja justo en el umbral', () => {
    // El límite es «por debajo de», no «hasta»: un aparato que da exactamente
    // 45 los está dando, y redondear en contra suya lo degradaría sin motivo.
    expect(nivelDeMovimiento({ ...base, fps: FPS_MINIMO })).toBe('pleno')
  })

  it('NO degrada cuando la medición no se pudo hacer', () => {
    // Es la regla importante. `null` es «no lo sé» —pestaña oculta, navegador
    // sin rAF—, y no saberlo nunca puede costarle a nadie el movimiento pleno.
    expect(nivelDeMovimiento({ ...base, fps: null })).toBe('pleno')
  })

  it('sigue respetando el contexto aunque no haya medición', () => {
    expect(nivelDeMovimiento({ reducido: false, fps: null, enSerie: true })).toBe('sobrio')
    expect(nivelDeMovimiento({ reducido: true, fps: null, enSerie: false })).toBe('minimo')
  })
})
