import { describe, expect, it } from 'vitest'
import { cargaPorGrupo, formatearSeries } from './fatiga'
import type { EjercicioPrescrito, Microciclo } from './types'

let contador = 0

function ejercicio(categoria: string, sets: number, seriesHechas: number): EjercicioPrescrito {
  contador += 1
  return {
    id: `e-test-${contador}`,
    categoria,
    nombre: categoria,
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets,
    rango: '8-10',
    repsDiana: 8,
    rirObjetivo: 2,
    series: Array.from({ length: seriesHechas }, (_, i) => ({
      orden: i + 1,
      cargaKg: 40,
      reps: 8,
      rir: 2,
    })),
  }
}

function microciclo(ejercicios: EjercicioPrescrito[]): Microciclo {
  return {
    id: 'm-test',
    usuarioId: 'u-test',
    numero: 1,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio: '2026-07-10',
    sesiones: [{ id: 's1', nombre: 'UPPER A', orden: 1, ejercicios }],
  }
}

describe('cargaPorGrupo', () => {
  it('suma series hechas y pautadas por grupo a través de ejercicios', () => {
    const m = microciclo([
      ejercicio('EMPUJE HORIZONTAL', 3, 3),
      ejercicio('AISLAMIENTO PECTORAL', 3, 0),
    ])
    const pecho = cargaPorGrupo(m).find((c) => c.grupo === 'Pecho')
    expect(pecho).toMatchObject({ seriesHechas: 3, seriesPautadas: 6, pct: 50, nivel: 'en-trabajo' })
  })

  it('clasifica fresco (<25%) y cargado (>=75%)', () => {
    const m = microciclo([ejercicio('BÍCEPS', 4, 0), ejercicio('TRÍCEPS', 4, 4)])
    const carga = cargaPorGrupo(m)
    expect(carga.find((c) => c.grupo === 'Bíceps')?.nivel).toBe('fresco')
    expect(carga.find((c) => c.grupo === 'Tríceps')?.nivel).toBe('cargado')
  })

  it('el pct se limita a 100 aunque se registren series extra', () => {
    const m = microciclo([ejercicio('SENTADILLAS', 2, 4)])
    expect(cargaPorGrupo(m)[0].pct).toBe(100)
  })

  it('excluye categorías desconocidas', () => {
    const m = microciclo([ejercicio('CARDIO HIIT', 4, 2)])
    expect(cargaPorGrupo(m)).toHaveLength(0)
  })
})

/**
 * Moneda fraccionada: el trabajo directo vale 1 serie y el indirecto 0,5
 * (Pelland et al., Sports Med 2026). Hasta el 2026-08-12 se contaba en directo
 * y el PANEL medía por debajo: un press de banca daba 0 al tríceps.
 */
describe('cargaPorGrupo · series fraccionadas', () => {
  it('un mismo ejercicio alimenta al grupo directo y a los indirectos', () => {
    const carga = cargaPorGrupo(microciclo([ejercicio('EMPUJE HORIZONTAL', 4, 4)]))
    expect(carga.map((c) => [c.grupo, c.seriesPautadas])).toEqual([
      ['Pecho', 4],
      ['Hombros', 2],
      ['Tríceps', 2],
    ])
  })

  it('la bisagra paga glúteo y lumbares además de isquios', () => {
    const carga = cargaPorGrupo(microciclo([ejercicio('BISAGRA DE CADERA', 3, 3)]))
    expect(carga.find((c) => c.grupo === 'Isquios')?.seriesPautadas).toBe(3)
    expect(carga.find((c) => c.grupo === 'Glúteos')?.seriesPautadas).toBe(1.5)
    expect(carga.find((c) => c.grupo === 'Lumbares')?.seriesPautadas).toBe(1.5)
  })

  it('el porcentaje no cambia al fraccionar: es una razón', () => {
    const carga = cargaPorGrupo(microciclo([ejercicio('TRACCIÓN VERTICAL', 4, 2)]))
    expect(carga.find((c) => c.grupo === 'Espalda')?.pct).toBe(50)
    expect(carga.find((c) => c.grupo === 'Bíceps')?.pct).toBe(50)
  })

  it('redondea el ruido de la coma flotante', () => {
    const m = microciclo([
      ejercicio('EMPUJE HORIZONTAL', 1, 1),
      ejercicio('EMPUJE INCLINADO', 1, 1),
      ejercicio('EMPUJE VERTICAL', 1, 1),
    ])
    const triceps = cargaPorGrupo(m).find((c) => c.grupo === 'Tríceps')
    expect(triceps?.seriesPautadas).toBe(1.5)
  })

  it('devuelve los grupos en el orden del PANEL', () => {
    const m = microciclo([ejercicio('FLEXIÓN DE CODO', 3, 3), ejercicio('EMPUJE HORIZONTAL', 3, 3)])
    expect(cargaPorGrupo(m).map((c) => c.grupo)).toEqual(['Pecho', 'Hombros', 'Bíceps', 'Tríceps'])
  })

  it('el trabajo de prevención y el cardio no suman volumen', () => {
    const m = microciclo([ejercicio('PREV/REHAB', 3, 3), ejercicio('ACONDICIONAMIENTO', 3, 3)])
    expect(cargaPorGrupo(m)).toHaveLength(0)
  })
})

describe('formatearSeries', () => {
  it('escribe los enteros sin decimal', () => {
    expect(formatearSeries(12)).toBe('12')
    expect(formatearSeries(0)).toBe('0')
  })

  it('escribe las medias series con coma, como en español', () => {
    expect(formatearSeries(7.5)).toBe('7,5')
    expect(formatearSeries(1.5)).toBe('1,5')
  })
})
