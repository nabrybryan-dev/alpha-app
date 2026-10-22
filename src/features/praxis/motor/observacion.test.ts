import { beforeEach, describe, expect, it } from 'vitest'
import { observarRuta, olvidarRutas, rutasObservadas } from './observacion'

/**
 * El enrutador observa cada turno del equipo SIN cambiar lo que se ve ni lo que se hace.
 * Solo guarda ruta, área y nivel: nunca la frase.
 */
beforeEach(() => olvidarRutas())

describe('observarRuta', () => {
  it('sin rol no observa nada', () => {
    expect(observarRuta('cambia mi RIR a 2', 'p1', undefined)).toBeNull()
    expect(rutasObservadas()).toEqual([])
  })
  it('guarda ruta, área y nivel, y nada de la frase', () => {
    const d = observarRuta('cambia mi RIR a 2 en la sentadilla', 'p1', 'coach')
    expect(d?.ruta).toBe('proponer')
    const [uno] = rutasObservadas()
    expect(uno).toEqual({ ruta: 'proponer', area: 'entrenar', nivel: 'L2' })
    expect(JSON.stringify(rutasObservadas())).not.toMatch(/sentadilla|RIR/)
    for (const r of rutasObservadas()) expect(Object.keys(r).every((k) => ['ruta', 'area', 'nivel'].includes(k))).toBe(true)
  })
  it('un asesorado queda bloqueado mientras el interruptor esté apagado', () => {
    expect(observarRuta('hola', 'p1', 'asesorado')?.ruta).toBe('bloqueada')
  })
  it('nunca lanza: si el enrutador falla, el turno sigue', () => {
    expect(() => observarRuta(undefined as unknown as string, 'p1', 'coach')).not.toThrow()
  })
  it('guarda como mucho las últimas 50', () => {
    for (let i = 0; i < 60; i++) observarRuta('¿cuántas series me tocan?', 'p1', 'coach')
    expect(rutasObservadas()).toHaveLength(50)
  })
})
