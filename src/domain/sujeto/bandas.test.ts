import { describe, expect, it } from 'vitest'
import { bandasDeSentadilla, crearAzar, muestrear, perturbarProporciones, SIN_INCERTIDUMBRE, type Incertidumbre } from './bandas'
import { verificarCifras } from './contrato'
import { GRAVEDAD } from './convenciones'
import { geometriaSagital, momentosDeSentadilla, type EntradaDeSentadilla } from './dinamica'
import { construirSujeto } from './sujeto'

/**
 * ARNÉS DE LA FASE 3. Verdad: (1) la solución analítica del caso lineal (solo la carga incierta);
 * (2) propiedades que tienen que cumplirse (punto con incertidumbre cero, ancho que crece con cada
 * componente, masa conservada). Las desviaciones de abajo son valores de EJEMPLO para probar, no
 * una afirmación sobre la incertidumbre real de nadie.
 */

const e: EntradaDeSentadilla = {
  sexo: 'h',
  talla: 1.78,
  masa: 82,
  cargaKg: 100,
  pose: { tibia: 0.45, muslo: -1.45, tronco: 0.75, cabeza: 0.2, barraT: 0.1, pieZ: 0.05 },
}
const ancho = (c: { banda: { inf: number; sup: number } | null }) => c.banda!.sup - c.banda!.inf
const SIN = SIN_INCERTIDUMBRE
const articulaciones = ['tobillo', 'rodilla', 'cadera'] as const

describe('reproducibilidad y punto', () => {
  it('misma semilla, mismas bandas exactas; otra semilla, otras', () => {
    const u = { ...SIN, talla: 0.02, carga: 3 }
    const a = bandasDeSentadilla(e, u, { semilla: 7 })
    const b = bandasDeSentadilla(e, u, { semilla: 7 })
    const c = bandasDeSentadilla(e, u, { semilla: 8 })
    expect(a.cadera.banda).toEqual(b.cadera.banda)
    expect(a.cadera.banda).not.toEqual(c.cadera.banda)
  })
  it('con incertidumbre cero la banda es un punto igual al valor de la fase 2', () => {
    const r = bandasDeSentadilla(e, SIN, { muestras: 300 })
    const central = momentosDeSentadilla(e)
    for (const a of articulaciones) {
      expect(ancho(r[a])).toBeLessThanOrEqual(1e-9)
      expect(r[a].valor).toBe(central[a].valor)
    }
  })
})

describe('el ancho crece al subir cada componente por separado', () => {
  const niveles: [keyof Incertidumbre, number[]][] = [
    ['talla', [0.01, 0.02, 0.04]],
    ['masa', [1, 2, 4]],
    ['proporciones', [0.02, 0.04, 0.08]],
    ['angulo', [0.02, 0.04, 0.08]],
    ['carga', [2, 4, 8]],
  ]
  for (const [campo, valores] of niveles) {
    it(campo, () => {
      const anchos = valores.map((x) => bandasDeSentadilla(e, { ...SIN, [campo]: x }, { muestras: 1500 }))
      for (const a of articulaciones) {
        expect(ancho(anchos[1][a])).toBeGreaterThan(ancho(anchos[0][a]))
        expect(ancho(anchos[2][a])).toBeGreaterThan(ancho(anchos[1][a]))
      }
    })
  }
})

describe('solución conocida: solo la carga es incierta (el momento es lineal en ella)', () => {
  const sd = 5
  const n = 4000
  const s = construirSujeto(e)!
  const g = geometriaSagital(s, 100, e.pose!)
  const zBarra = g.porEncimaDeLaCadera.find((m) => m.nombre === 'barra')!.z
  const analitica = {
    tobillo: GRAVEDAD * Math.abs(zBarra - g.tobillo.z) * sd,
    rodilla: GRAVEDAD * Math.abs(g.rodilla.z - zBarra) * sd,
    cadera: GRAVEDAD * Math.abs(zBarra - g.cadera.z) * sd,
  }
  const m = muestrear(e, { ...SIN, carga: sd }, { muestras: n })
  const central = momentosDeSentadilla(e)
  for (const a of articulaciones) {
    it(`${a}: desviación muestral dentro del 4 % de la analítica y media dentro de 4 errores estándar`, () => {
      const x = m[a]
      const media = x.reduce((t, v) => t + v, 0) / x.length
      const sdm = Math.sqrt(x.reduce((t, v) => t + (v - media) ** 2, 0) / (x.length - 1))
      expect(Math.abs(sdm - analitica[a]) / analitica[a]).toBeLessThan(0.04)
      expect(Math.abs(media - (central[a].valor as number))).toBeLessThan((4 * analitica[a]) / Math.sqrt(n))
    })
    it(`${a}: la banda del 5 al 95 mide 2 x 1,645 sd analíticas (dentro del 6 %) y rodea al valor`, () => {
      const r = bandasDeSentadilla(e, { ...SIN, carga: sd }, { muestras: n })[a]
      expect(Math.abs(ancho(r) - 2 * 1.645 * analitica[a]) / (2 * 1.645 * analitica[a])).toBeLessThan(0.06)
      expect(r.banda!.inf).toBeLessThan(r.valor as number)
      expect(r.banda!.sup).toBeGreaterThan(r.valor as number)
    })
  }
})

describe('las proporciones conservan la masa', () => {
  it('en 200 muestras la suma de masas (pares dos veces) no cambia, y sí cambian las masas', () => {
    const s = construirSujeto(e)!
    const azar = crearAzar(1)
    const total = (x: ReturnType<typeof perturbarProporciones>) => {
      const t = x.sujeto.segmentos
      const pares = (['brazo', 'antebrazo', 'mano', 'muslo', 'tibia', 'pie'] as const).reduce((a, n) => a + 2 * t[n].masa, 0)
      return pares + x.cerv.cabeza.masa + x.cerv.tronco.masa
    }
    const base = total({ sujeto: s, cerv: { cabeza: { masa: 0.0694, cm: 0, largo: 0 }, tronco: { masa: 0.4346, cm: 0, largo: 0 } } })
    let cambio = false
    let razonCambia = false
    for (let i = 0; i < 200; i++) {
      const p = perturbarProporciones(s, 0.1, azar)
      expect(Math.abs(total(p) - base)).toBeLessThan(1e-9)
      if (Math.abs(p.sujeto.segmentos.muslo.masa - s.segmentos.muslo.masa) > 1e-6) cambio = true
      // La renormalización escala todo igual: que cambie la RAZÓN entre dos segmentos prueba que cada masa se perturbó.
      const r0 = s.segmentos.muslo.masa / s.segmentos.brazo.masa
      const r1 = p.sujeto.segmentos.muslo.masa / p.sujeto.segmentos.brazo.masa
      if (Math.abs(r1 - r0) / r0 > 1e-3) razonCambia = true
    }
    expect(cambio).toBe(true)
    expect(razonCambia).toBe(true)
  })
})

describe('contrato', () => {
  const u: Incertidumbre = { talla: 0.02, masa: 2, proporciones: 0.05, angulo: 0.03, carga: 2 }
  it('estimado, con banda que contiene el valor y válido para el verificador', () => {
    const r = bandasDeSentadilla(e, u)
    expect(verificarCifras([r.tobillo, r.rodilla, r.cadera])).toEqual([])
    for (const a of articulaciones) {
      expect(r[a].estado).toBe('estimado')
      expect(r[a].banda!.inf).toBeLessThanOrEqual(r[a].valor as number)
      expect(r[a].banda!.sup).toBeGreaterThanOrEqual(r[a].valor as number)
    }
  })
  it('sin un dato no hay banda: null, no cero', () => {
    const r = bandasDeSentadilla({ ...e, cargaKg: undefined }, u)
    for (const a of articulaciones) {
      expect(r[a].valor).toBeNull()
      expect(r[a].banda).toBeNull()
    }
  })
  it('una incertidumbre que rompe el modelo se abstiene en vez de dar una banda', () => {
    const r = bandasDeSentadilla(e, { ...u, talla: 5 }, { muestras: 300 })
    expect(r.cadera.valor).toBeNull()
  })
})
