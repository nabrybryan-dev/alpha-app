import { describe, expect, it } from 'vitest'
import { huellaDeSerieMedida, MUESTRAS_DE_HUELLA } from './huella'

/**
 * LA HUELLA, PROBADA CONTRA UNA SERIE DE MENTIRA.
 *
 * Una barra que sube y baja tres veces, a 50 Hz. Lo que se vigila: que se coja la ÚLTIMA
 * repetición y no la primera, que entre la bajada previa cuando el análisis la trae, que
 * la fase esté entre 0 y 1 con sus extremos tocados, y que una serie que no da para huella
 * devuelva `undefined` y no una huella falsa.
 */

function serieDeMentira() {
  // Tres repeticiones: bajar 1 s, subir 1 s. Posición en metros, con el suelo en 0.
  const t: number[] = []
  const s: number[] = []
  for (let i = 0; i <= 300; i++) {
    const tt = i / 50
    t.push(tt)
    const rep = tt % 2
    s.push(rep < 1 ? 0.5 - 0.5 * rep : 0.5 * (rep - 1))
  }
  // Las concéntricas empiezan a 1, 3 y 5 s (índices 50, 150, 250) y acaban a 2, 4 y 6.
  const reps = [
    { iInicio: 50, iFin: 100 },
    { iInicio: 150, iFin: 200, excSeg: 1 },
    { iInicio: 250, iFin: 300, excSeg: 1 },
  ]
  return { t, s, reps }
}

describe('huellaDeSerieMedida', () => {
  it('coge la ÚLTIMA repetición, con su bajada previa', () => {
    const { t, s, reps } = serieDeMentira()
    const h = huellaDeSerieMedida({ t, s }, reps)!
    expect(h).toBeDefined()
    // Un segundo de bajada más uno de subida.
    expect(h.duracionSeg).toBeCloseTo(2, 6)
    expect(h.fase).toHaveLength(MUESTRAS_DE_HUELLA)
    // Arranca arriba (viene de la bajada), pasa por abajo en medio y termina arriba.
    expect(h.fase[0]).toBeCloseTo(1, 2)
    expect(h.fase[Math.floor(MUESTRAS_DE_HUELLA / 2)]).toBeLessThan(0.1)
    expect(h.fase[MUESTRAS_DE_HUELLA - 1]).toBeCloseTo(1, 2)
  })

  it('sin excéntrica previa se queda con la concéntrica sola', () => {
    const { t, s } = serieDeMentira()
    const h = huellaDeSerieMedida({ t, s }, [{ iInicio: 50, iFin: 100 }])!
    expect(h.duracionSeg).toBeCloseTo(1, 6)
    expect(h.fase[0]).toBeCloseTo(0, 2)
    expect(h.fase[h.fase.length - 1]).toBeCloseTo(1, 2)
  })

  it('la fase vive en [0, 1] y toca los dos extremos', () => {
    const { t, s, reps } = serieDeMentira()
    const h = huellaDeSerieMedida({ t, s }, reps)!
    expect(Math.min(...h.fase)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...h.fase)).toBeLessThanOrEqual(1)
    expect(Math.min(...h.fase)).toBeLessThan(0.05)
    expect(Math.max(...h.fase)).toBeGreaterThan(0.95)
  })

  it('sin repeticiones, o con una trayectoria que no se mueve, no hay huella', () => {
    const { t, s } = serieDeMentira()
    expect(huellaDeSerieMedida({ t, s }, [])).toBeUndefined()
    const quieta = { t, s: t.map(() => 0.3) }
    expect(huellaDeSerieMedida(quieta, [{ iInicio: 50, iFin: 100 }])).toBeUndefined()
    expect(huellaDeSerieMedida({ t: [0, 1], s: [0] }, [{ iInicio: 0, iFin: 1 }])).toBeUndefined()
  })

  it('aguanta índices fuera de rango sin reventar', () => {
    const { t, s } = serieDeMentira()
    const h = huellaDeSerieMedida({ t, s }, [{ iInicio: 250, iFin: 9999, excSeg: 1 }])
    expect(h).toBeDefined()
    expect(h!.fase.every((f) => Number.isFinite(f))).toBe(true)
  })
})
