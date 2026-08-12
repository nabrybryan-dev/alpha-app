import { describe, expect, it } from 'vitest'
import {
  clasificarSemana,
  clasificarSesion,
  refDeEjercicio,
  refDeSerie,
  refDeSeries,
  refDesdePorcentaje,
} from './ref'
import type { EjercicioPrescrito } from './types'

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'DOMINANTE DE CADERA',
    nombre: 'Hip thrust con barra',
    cues: '',
    prescripcion: '',
    descansoMin: 3,
    sets: 3,
    rango: '(8-12)',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

describe('refDesdePorcentaje', () => {
  /**
   * Ancla contra el libro del coach: `Excel. Ratio estímulo - fatiga por ejercicio`,
   * hoja «Mes 1», semana 1, celda **P5** — jalón al pecho con 85 kg sobre un 1RM
   * de 113 y 10 repeticiones. Si este test se rompe, la fórmula dejó de ser la
   * del Excel.
   */
  it('reproduce la celda del Excel del coach', () => {
    const porcentaje = (85 / 113) * 100
    expect(refDesdePorcentaje(10, porcentaje)).toBeCloseTo(0.40357142857142847, 12)
  })

  it('crece con la intensidad a igualdad de repeticiones', () => {
    const suave = refDesdePorcentaje(5, 60)
    const duro = refDesdePorcentaje(5, 85)
    expect(suave).toBeDefined()
    expect(duro).toBeDefined()
    expect(duro!).toBeGreaterThan(suave!)
  })

  it('crece con las repeticiones a igualdad de intensidad', () => {
    expect(refDesdePorcentaje(10, 70)!).toBeGreaterThan(refDesdePorcentaje(5, 70)!)
  })

  /** Al 100 % del 1RM el denominador es cero: el REF no está definido ahí. */
  it('no devuelve nada al 100 % del 1RM ni por encima', () => {
    expect(refDesdePorcentaje(1, 100)).toBeUndefined()
    expect(refDesdePorcentaje(1, 105)).toBeUndefined()
  })

  it('no devuelve nada con entradas sin sentido', () => {
    expect(refDesdePorcentaje(0, 70)).toBeUndefined()
    expect(refDesdePorcentaje(-3, 70)).toBeUndefined()
    expect(refDesdePorcentaje(10, 0)).toBeUndefined()
    expect(refDesdePorcentaje(10, -10)).toBeUndefined()
    expect(refDesdePorcentaje(Number.NaN, 70)).toBeUndefined()
  })
})

describe('refDeSerie', () => {
  /**
   * La app no necesita el 1RM: la matriz CARGAS ya da la fracción del 1RM que
   * representa una serie de `reps` a `rir`, y esa fracción es el %1RM del Excel.
   * 10 reps a RIR 2 → coeficiente 0,615 → 10 / (100 − 61,5).
   */
  it('sale de la matriz CARGAS, sin pedir el 1RM', () => {
    expect(refDeSerie(10, 2)).toBeCloseTo(10 / 38.5, 12)
  })

  it('una serie más cerca del fallo pesa más', () => {
    expect(refDeSerie(10, 0)!).toBeGreaterThan(refDeSerie(10, 4)!)
  })

  /** 1 rep a RIR 0 es el 100 % del 1RM: el mismo caso indefinido de arriba. */
  it('no devuelve nada para una serie al 100 % del 1RM', () => {
    expect(refDeSerie(1, 0)).toBeUndefined()
  })

  /** Misma regla que `coeficienteCarga`: fuera de tabla no se extrapola. */
  it('no extrapola fuera de la matriz', () => {
    expect(refDeSerie(30, 2)).toBeUndefined()
    expect(refDeSerie(10, 9)).toBeUndefined()
    expect(refDeSerie(10.5, 2)).toBeUndefined()
  })
})

describe('refDeSeries', () => {
  it('suma el REF de cada serie', () => {
    const series = [
      { reps: 10, rir: 2 },
      { reps: 9, rir: 1 },
    ]
    expect(refDeSeries(series)).toBeCloseTo(refDeSerie(10, 2)! + refDeSerie(9, 1)!, 12)
  })

  it('no devuelve nada si una serie queda fuera de tabla', () => {
    expect(
      refDeSeries([
        { reps: 10, rir: 2 },
        { reps: 40, rir: 2 },
      ]),
    ).toBeUndefined()
  })

  it('no devuelve nada sin series', () => {
    expect(refDeSeries([])).toBeUndefined()
  })
})

describe('refDeEjercicio', () => {
  it('suma las series prescritas cuando el ejercicio está ondulado', () => {
    const ondulado = ejercicio({
      sets: 3,
      seriesPrescritas: [
        { orden: 1, reps: 10, rir: 2, cargaKg: 45 },
        { orden: 2, reps: 9, rir: 1, cargaKg: 47.5 },
        { orden: 3, reps: 8, rir: 0, cargaKg: 50 },
      ],
    })
    const esperado = refDeSerie(10, 2)! + refDeSerie(9, 1)! + refDeSerie(8, 0)!
    expect(refDeEjercicio(ondulado)).toBeCloseTo(esperado, 12)
  })

  /** Sin ondulación todas las series comparten `repsDiana` y `rirObjetivo`. */
  it('multiplica por sets cuando no hay ondulación', () => {
    const plano = ejercicio({ sets: 4, repsDiana: 10, rirObjetivo: 2 })
    expect(refDeEjercicio(plano)).toBeCloseTo(refDeSerie(10, 2)! * 4, 12)
  })

  /**
   * Si una sola serie cae fuera de la matriz, el total no se puede afirmar. Se
   * devuelve undefined en vez de una suma parcial, que parecería un ejercicio
   * más blando de lo que es.
   */
  it('no devuelve una suma parcial si una serie queda fuera de tabla', () => {
    const conUnaFuera = ejercicio({
      sets: 2,
      seriesPrescritas: [
        { orden: 1, reps: 10, rir: 2, cargaKg: 45 },
        { orden: 2, reps: 40, rir: 2, cargaKg: 20 },
      ],
    })
    expect(refDeEjercicio(conUnaFuera)).toBeUndefined()
  })

  it('no devuelve nada sin series', () => {
    expect(refDeEjercicio(ejercicio({ sets: 0, seriesPrescritas: [] }))).toBeUndefined()
  })
})

describe('clasificarSesion', () => {
  it('usa los cuatro tramos del Excel', () => {
    expect(clasificarSesion(0.2)).toBe('poco-estimulo')
    expect(clasificarSesion(0.9)).toBe('recuperable')
    expect(clasificarSesion(1.8)).toBe('acumulacion')
    expect(clasificarSesion(3)).toBe('muy-dificil')
  })

  /** El Excel escribe «< 0,4» y «0,4 a 1,3»: el corte pertenece al tramo de arriba. */
  it('el valor del corte cae en el tramo superior', () => {
    expect(clasificarSesion(0.4)).toBe('recuperable')
    expect(clasificarSesion(1.3)).toBe('acumulacion')
    expect(clasificarSesion(2.3)).toBe('muy-dificil')
  })
})

describe('clasificarSemana', () => {
  it('usa los cuatro tramos del Excel', () => {
    expect(clasificarSemana(1.5)).toBe('descarga')
    expect(clasificarSemana(2.8)).toBe('carga')
    expect(clasificarSemana(4)).toBe('demandante')
    expect(clasificarSemana(5)).toBe('insostenible')
  })

  it('el valor del corte cae en el tramo superior', () => {
    expect(clasificarSemana(2)).toBe('carga')
    expect(clasificarSemana(3.4)).toBe('demandante')
    expect(clasificarSemana(4.6)).toBe('insostenible')
  })
})
