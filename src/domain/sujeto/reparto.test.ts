import { describe, expect, it } from 'vitest'
import { verificarCifras } from './contrato'
import { bandasDeReparto, indiceDeLongitud, momentoPasivo, repartirMomento, type Musculo } from './reparto'

/**
 * ARNÉS DE LA FASE 4. Las áreas y brazos de abajo son NÚMEROS DE JUEGO elegidos para que la
 * solución se resuelva a mano; no son anatomía de nadie. El control del índice de longitud
 * comprueba que el orden de las posturas sigue lo que Maeo 2021 (PMC7969179, texto abierto)
 * reporta para tres clases de músculo: se alarga sentado, no cambia, se alarga tumbado. Es una
 * comprobación de signos y de orden, no una validación de magnitudes.
 */

const dos: Musculo[] = [
  { nombre: 'a', area: 2, brazo: 0.05 },
  { nombre: 'b', area: 1, brazo: 0.05 },
]

describe('dos músculos con solución a mano (r = 2)', () => {
  it('mismo brazo, áreas 2 y 1: F ∝ A², o sea 4 a 1; el par se cumple', () => {
    const M = 100
    const r = repartirMomento(M, dos, 2)!
    // F_i = M·A²·d / Σ A²d²  ->  F_a = 100·4·0.05 / (16·0.0025 + 1·0.0025) · ... se hace a mano:
    const den = 4 * 0.05 ** 2 + 1 * 0.05 ** 2
    expect(r[0].fuerza).toBeCloseTo((M * 4 * 0.05) / den, 9)
    expect(r[1].fuerza).toBeCloseTo((M * 1 * 0.05) / den, 9)
    expect(r[0].fuerza / r[1].fuerza).toBeCloseTo(4, 9)
    expect(r[0].fuerza * 0.05 + r[1].fuerza * 0.05).toBeCloseTo(M, 9)
    expect(r[0].fraccion + r[1].fraccion).toBeCloseTo(1, 12)
  })
  it('un solo músculo lleva todo el momento', () => {
    const r = repartirMomento(80, [{ nombre: 'x', area: 3, brazo: 0.04 }], 3)!
    expect(r[0].fuerza).toBeCloseTo(80 / 0.04, 9)
    expect(r[0].fraccion).toBeCloseTo(1, 12)
  })
  it('brazos distintos con r = 2: F_i = M·A²·d / Σ A²d²', () => {
    const m: Musculo[] = [
      { nombre: 'a', area: 1, brazo: 0.02 },
      { nombre: 'b', area: 1, brazo: 0.06 },
    ]
    const r = repartirMomento(60, m, 2)!
    const den = 0.02 ** 2 + 0.06 ** 2
    expect(r[0].fuerza).toBeCloseTo((60 * 0.02) / den, 9)
    expect(r[1].fuerza).toBeCloseTo((60 * 0.06) / den, 9)
  })
  it('es el MÍNIMO: cualquier otro reparto que cumpla el par cuesta más', () => {
    const M = 100
    const coste = (fa: number, fb: number, r: number) => (fa / 2) ** r + (fb / 1) ** r
    const r = 3
    const opt = repartirMomento(M, dos, r)!
    const base = coste(opt[0].fuerza, opt[1].fuerza, r)
    for (const d of [-300, -100, -10, 10, 100, 300]) {
      const fa = opt[0].fuerza + d
      const fb = (M - fa * 0.05) / 0.05
      if (fa >= 0 && fb >= 0) expect(coste(fa, fb, r)).toBeGreaterThan(base)
    }
  })
  it('un músculo con brazo ≤ 0 recibe fuerza 0 (antagonista)', () => {
    const r = repartirMomento(50, [...dos, { nombre: 'anta', area: 5, brazo: -0.03 }], 2)!
    expect(r[2].fuerza).toBe(0)
    expect(r[2].fraccion).toBe(0)
  })
  it('el reparto depende del criterio r (la literatura no lo cierra)', () => {
    const a = repartirMomento(100, dos, 2)!
    const b = repartirMomento(100, dos, 6)!
    expect(Math.abs(a[0].fraccion - b[0].fraccion)).toBeGreaterThan(0.01)
  })
})

describe('abstención: null, nunca un reparto inventado', () => {
  it.each([
    ['momento cero', 0, dos, 2],
    ['momento negativo', -5, dos, 2],
    ['momento NaN', NaN, dos, 2],
    ['r = 1 (no tiene solución cerrada)', 10, dos, 1],
    ['área cero', 10, [{ nombre: 'x', area: 0, brazo: 0.05 }], 2],
    ['nadie con brazo positivo', 10, [{ nombre: 'x', area: 1, brazo: -0.05 }], 2],
    ['sin músculos', 10, [], 2],
  ])('%s', (_, M, m, r) => {
    expect(repartirMomento(M as number, m as Musculo[], r as number)).toBeNull()
  })
  it('el momento pasivo es no_afirmable con motivo, no un número', () => {
    const c = momentoPasivo('sentadilla.pasivo.rodilla')
    expect(c.valor).toBeNull()
    expect(verificarCifras([c])).toEqual([])
  })
})

describe('banda del reparto', () => {
  it('con área exacta la banda es un punto; con área incierta se ensancha, y suma ≈ 1 en el centro', () => {
    const sin = bandasDeReparto(100, dos, 2, 0, { muestras: 300 })!
    const poco = bandasDeReparto(100, dos, 2, 0.05, { muestras: 1000 })!
    const mucho = bandasDeReparto(100, dos, 2, 0.2, { muestras: 1000 })!
    const w = (x: typeof sin) => x[0].fraccion.banda!.sup - x[0].fraccion.banda!.inf
    expect(w(sin)).toBeLessThan(1e-9)
    expect(w(mucho)).toBeGreaterThan(w(poco))
    expect(w(poco)).toBeGreaterThan(0)
    expect(sin[0].fraccion.valor! + sin[1].fraccion.valor!).toBeCloseTo(1, 12)
  })
  it('las cifras son válidas para el contrato', () => {
    const b = bandasDeReparto(100, dos, 2, 0.1)!
    expect(verificarCifras(b.map((x) => x.fraccion))).toEqual([])
  })
})

describe('índice de longitud regional: el orden de Maeo 2021 (sentado ~90° de cadera, tumbado ~30°)', () => {
  const rad = (g: number) => (g * Math.PI) / 180
  const sentado = { cadera: rad(90), rodilla: rad(60) }
  const tumbado = { cadera: rad(30), rodilla: rad(60) }
  // Brazos de JUEGO: solo importan sus signos. Larga del bíceps / semitendinoso / semimembranoso:
  // extienden la cadera y flexionan la rodilla. Cabeza corta: monoarticular de rodilla. Sartorio: flexiona la cadera.
  const largaDelBiceps = { brazoCadera: 0.05, brazoRodilla: 0.03, largoDeReferencia: 0.4 }
  const cabezaCorta = { brazoCadera: 0, brazoRodilla: 0.03, largoDeReferencia: 0.25 }
  const sartorio = { brazoCadera: -0.03, brazoRodilla: 0.02, largoDeReferencia: 0.5 }
  it('músculo que extiende la cadera y flexiona la rodilla: más alargado sentado', () => {
    expect(indiceDeLongitud(largaDelBiceps, sentado)!).toBeGreaterThan(indiceDeLongitud(largaDelBiceps, tumbado)!)
  })
  it('monoarticular de rodilla: igual en las dos posturas', () => {
    expect(indiceDeLongitud(cabezaCorta, sentado)).toBeCloseTo(indiceDeLongitud(cabezaCorta, tumbado)!, 12)
  })
  it('flexor de cadera (sartorio): más alargado tumbado', () => {
    expect(indiceDeLongitud(sartorio, tumbado)!).toBeGreaterThan(indiceDeLongitud(sartorio, sentado)!)
  })
  it('a igual cadera, flexionar la rodilla ACORTA al flexor de rodilla (no es una comparación de Maeo, es el signo)', () => {
    const recta = indiceDeLongitud(largaDelBiceps, { cadera: rad(90), rodilla: 0 })!
    const flexionada = indiceDeLongitud(largaDelBiceps, { cadera: rad(90), rodilla: rad(90) })!
    expect(flexionada).toBeLessThan(recta)
  })
  it('sin dato, null', () => {
    expect(indiceDeLongitud({ ...largaDelBiceps, largoDeReferencia: 0 }, sentado)).toBeNull()
    expect(indiceDeLongitud(largaDelBiceps, { cadera: NaN, rodilla: 0 })).toBeNull()
  })
})
