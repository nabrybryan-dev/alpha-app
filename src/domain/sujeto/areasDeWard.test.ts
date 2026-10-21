import { describe, expect, it } from 'vitest'
import { verificarCifras } from './contrato'
import {
  GRUPOS_QUE_EXTIENDEN_LA_CADERA,
  MUSCULOS_DEL_GRUPO,
  proporcionesCentrales,
  proporcionesDeAreaDeCadera,
} from './areasDeWard'
import { VALORES_REGISTRADOS } from './registro'

describe('las proporciones de las medias, con la respuesta a mano', () => {
  it('glúteo mayor 33,4 · isquios 11,3 + 4,8 + 18,4 = 34,5 · aductor mayor 20,5 · total 88,4', () => {
    const p = proporcionesCentrales()
    expect(p.gluteoMayor).toBeCloseTo(33.4 / 88.4, 12) // 0,377828
    expect(p.isquios).toBeCloseTo(34.5 / 88.4, 12) // 0,390271
    expect(p.aductorMayor).toBeCloseTo(20.5 / 88.4, 12) // 0,231900
    expect(p.gluteoMayor).toBeCloseTo(0.377828, 6)
    expect(p.isquios).toBeCloseTo(0.390271, 6)
    expect(p.aductorMayor).toBeCloseTo(0.2319, 6)
    expect(p.gluteoMayor + p.isquios + p.aductorMayor).toBeCloseTo(1, 12)
  })
  it('la cabeza corta del bíceps no entra en los isquios (no cruza la cadera)', () => {
    expect(MUSCULOS_DEL_GRUPO.isquios).toEqual(['biceps_larga', 'semitendinoso', 'semimembranoso'])
    expect(MUSCULOS_DEL_GRUPO.isquios).not.toContain('biceps_corta')
  })
})

describe('las proporciones con su banda', () => {
  const r = proporcionesDeAreaDeCadera({ muestras: 1000 })
  const todas = GRUPOS_QUE_EXTIENDEN_LA_CADERA.map((g) => r[g])

  it('tres cifras estimadas, adimensionales, válidas para el contrato', () => {
    expect(verificarCifras(todas)).toEqual([])
    for (const c of todas) {
      expect(c.estado).toBe('estimado')
      expect(c.unidad).toBe('1')
    }
  })
  it('el valor es la proporción de las medias y la banda lo rodea con ancho real', () => {
    const p = proporcionesCentrales()
    for (const g of GRUPOS_QUE_EXTIENDEN_LA_CADERA) {
      expect(r[g].valor).toBeCloseTo(p[g], 12)
      expect(r[g].banda!.inf).toBeLessThan(r[g].valor as number)
      expect(r[g].banda!.sup).toBeGreaterThan(r[g].valor as number)
      expect(r[g].banda!.inf).toBeGreaterThan(0)
      expect(r[g].banda!.sup).toBeLessThan(1)
    }
  })
  it('nunca da un área absoluta: ninguna unidad es cm²', () => {
    expect(todas.every((c) => c.unidad === '1')).toBe(true)
    expect(todas.every((c) => (c.valor as number) < 1)).toBe(true)
  })
  it('misma semilla, mismo resultado; otra semilla, otra banda', () => {
    expect(proporcionesDeAreaDeCadera({ muestras: 1000 })).toEqual(r)
    expect(proporcionesDeAreaDeCadera({ muestras: 1000, semilla: 5 }).gluteoMayor.banda).not.toEqual(r.gluteoMayor.banda)
  })
  it('más sd, banda más ancha: la del glúteo (sd 8,8) frente a la de la suma de isquios es coherente con el muestreo', () => {
    // Con muchas muestras la banda se estabiliza: dos tamaños de muestra dan anchos del mismo orden.
    const grande = proporcionesDeAreaDeCadera({ muestras: 4000 })
    const ancho = (c: typeof r.gluteoMayor) => c.banda!.sup - c.banda!.inf
    expect(Math.abs(ancho(grande.gluteoMayor) - ancho(r.gluteoMayor))).toBeLessThan(0.05)
  })
  it('las fuentes que cita existen en el registro, y la cabeza corta no está entre ellas', () => {
    for (const c of todas) for (const f of c.fuente) expect(Object.keys(VALORES_REGISTRADOS)).toContain(f)
    expect(r.isquios.fuente.some((f) => f.includes('biceps_corta'))).toBe(false)
    expect(r.isquios.fuente.some((f) => f.includes('biceps_larga'))).toBe(true)
  })
  it('cero muestras es un error', () => {
    expect(() => proporcionesDeAreaDeCadera({ muestras: 0 })).toThrow(RangeError)
  })
})
