import { describe, expect, it } from 'vitest'
import { pesoEstimado, type PesajeEntrada, type PesoEstimado } from './pesoEstimado'

/** Serie A: pesajes reales, anonimizados (2026). El 83,35 del 28-sep es un dato raro. */
const SERIE_A: PesajeEntrada[] = [
  ['09-07', 90.3],
  ['09-08', 90.3],
  ['09-09', 90.3],
  ['09-10', 90.3],
  ['09-11', 89.5],
  ['09-13', 89.5],
  ['09-14', 89.5],
  ['09-16', 89.5],
  ['09-17', 89.3],
  ['09-19', 89.3],
  ['09-21', 89.3],
  ['09-22', 89.3],
  ['09-23', 88.8],
  ['09-25', 88.8],
  ['09-26', 88.35],
  ['09-28', 83.35],
  ['10-01', 87.75],
  ['10-02', 87.75],
].map(([f, kg]) => ({ fecha: `2026-${f}`, pesoKg: kg as number }))

const HOY = '2026-10-02'
const PESO_REAL = 87.75

function contiene(e: PesoEstimado, kg: number): boolean {
  return e.bajoKg <= kg && kg <= e.altoKg
}

function comoVa(e: PesoEstimado | undefined): PesoEstimado {
  if (!e) throw new Error('se esperaba una estimación')
  return e
}

function sinNaN(e: PesoEstimado): void {
  for (const v of [e.centroKg, e.bajoKg, e.altoKg, e.anchoKg, e.kgPorSemana ?? 0, e.diasDesdeElUltimo]) {
    expect(Number.isFinite(v)).toBe(true)
  }
}

describe('pesoEstimado · con datos reales (serie A)', () => {
  it('con TODA la serie aparta el 83,35 y da un rango estrecho que contiene el peso real', () => {
    const e = comoVa(pesoEstimado(SERIE_A, HOY))
    expect(e.apartados).toEqual([{ fecha: '2026-09-28', pesoKg: 83.35 }])
    expect(e.n).toBe(17)
    expect(e.metodo).toBe('tendencia')
    expect(contiene(e, PESO_REAL)).toBe(true)
    expect(e.anchoKg).toBeLessThanOrEqual(2)
    expect(e.confianza).toBe('alta')
    expect(e.kgPorSemana).toBeLessThan(0)
    expect(e.ultimoPesaje).toEqual({ fecha: '2026-10-02', pesoKg: 87.75 })
    expect(e.diasDesdeElUltimo).toBe(0)
    sinNaN(e)
  })

  it('con solo los 8 primeros (hasta el 16-sep) y hoy 2-oct: rango de 3 a 5 kg que contiene 87,75', () => {
    const e = comoVa(pesoEstimado(SERIE_A.slice(0, 8), HOY))
    expect(e.n).toBe(8)
    expect(e.metodo).toBe('tendencia')
    expect(e.centroKg).toBeGreaterThanOrEqual(87.0)
    expect(e.centroKg).toBeLessThanOrEqual(87.8)
    expect(contiene(e, PESO_REAL)).toBe(true)
    expect(e.anchoKg).toBeGreaterThanOrEqual(3)
    expect(e.anchoKg).toBeLessThanOrEqual(5)
    sinNaN(e)
  })

  it('con solo el primer pesaje (7-sep) y hoy 2-oct: último dato, rango de 5 a 7 kg que contiene 87,75', () => {
    const e = comoVa(pesoEstimado(SERIE_A.slice(0, 1), HOY))
    expect(e.metodo).toBe('ultimo_dato')
    expect(e.kgPorSemana).toBeUndefined()
    expect(e.n).toBe(1)
    expect(e.diasDesdeElUltimo).toBe(25)
    expect(contiene(e, PESO_REAL)).toBe(true)
    expect(e.anchoKg).toBeGreaterThanOrEqual(5)
    expect(e.anchoKg).toBeLessThanOrEqual(7)
    expect(e.confianza).toBe('baja')
    sinNaN(e)
  })
})

describe('pesoEstimado · casos límite', () => {
  it('lista vacía → undefined', () => {
    expect(pesoEstimado([], HOY)).toBeUndefined()
  })

  it('si "hoy" no es una fecha válida → undefined (no inventa un día)', () => {
    expect(pesoEstimado(SERIE_A, 'ayer')).toBeUndefined()
  })

  it('dos pesajes el mismo día cuentan uno, y se queda el último', () => {
    const e = comoVa(
      pesoEstimado(
        [
          { fecha: '2026-10-02', pesoKg: 90 },
          { fecha: '2026-10-02', pesoKg: 80 },
        ],
        HOY,
      ),
    )
    expect(e.n).toBe(1)
    expect(e.ultimoPesaje.pesoKg).toBe(80)
  })

  it('hoy igual al último pesaje con un solo dato → ancho = 2 × ruido', () => {
    const e = comoVa(pesoEstimado([{ fecha: HOY, pesoKg: 70 }], HOY))
    expect(e.anchoKg).toBe(1.2)
    expect(e.centroKg).toBe(70)
    expect(e.bajoKg).toBe(69.4)
    expect(e.altoKg).toBe(70.6)
    expect(e.confianza).toBe('alta')
  })

  it('un pesaje "de mañana" (hoy anterior al último) no abre el rango con días negativos', () => {
    const e = comoVa(pesoEstimado([{ fecha: '2026-10-05', pesoKg: 70 }], HOY))
    expect(e.diasDesdeElUltimo).toBe(0)
    expect(e.anchoKg).toBe(1.2)
  })

  it('pesos idénticos (serie plana de 10) → ancho pequeño, tendencia 0 y sin NaN', () => {
    const plana = Array.from({ length: 10 }, (_, i) => ({ fecha: `2026-09-${String(i + 20).padStart(2, '0')}`, pesoKg: 75 }))
    const e = comoVa(pesoEstimado(plana, '2026-09-30'))
    expect(e.metodo).toBe('tendencia')
    expect(e.kgPorSemana).toBe(0)
    expect(e.centroKg).toBe(75)
    expect(e.anchoKg).toBeLessThanOrEqual(2)
    expect(e.anchoKg).toBeGreaterThan(0)
    sinNaN(e)
  })

  it('ignora la basura: NaN, 0, negativos, Infinity, fecha 31 de febrero y fecha vacía', () => {
    const basura: PesajeEntrada[] = [
      { fecha: '2026-09-01', pesoKg: Number.NaN },
      { fecha: '2026-09-02', pesoKg: 0 },
      { fecha: '2026-09-03', pesoKg: -5 },
      { fecha: '2026-09-04', pesoKg: Number.POSITIVE_INFINITY },
      { fecha: '2026-02-31', pesoKg: 60 },
      { fecha: '', pesoKg: 61 },
    ]
    expect(pesoEstimado(basura, HOY)).toBeUndefined()
    const e = comoVa(pesoEstimado([...basura, { fecha: '2026-10-01', pesoKg: 70 }], HOY))
    expect(e.n).toBe(1)
    expect(e.apartados).toEqual([])
    sinNaN(e)
  })

  it('el orden de entrada no cambia el resultado', () => {
    const al_reves = [...SERIE_A].reverse()
    const barajada = [...SERIE_A.filter((_, i) => i % 2 === 0), ...SERIE_A.filter((_, i) => i % 2 === 1)]
    const base = pesoEstimado(SERIE_A, HOY)
    expect(pesoEstimado(al_reves, HOY)).toEqual(base)
    expect(pesoEstimado(barajada, HOY)).toEqual(base)
  })

  it('con menos de 3 pesajes no aparta ninguno aunque difieran mucho', () => {
    const e = comoVa(
      pesoEstimado(
        [
          { fecha: '2026-09-20', pesoKg: 90 },
          { fecha: '2026-10-01', pesoKg: 80 },
        ],
        HOY,
      ),
    )
    expect(e.apartados).toEqual([])
    expect(e.n).toBe(2)
    expect(e.metodo).toBe('ultimo_dato')
  })

  it('menos de 7 días entre el primero y el último → sin tendencia aunque haya muchos pesajes', () => {
    const corta = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ fecha: `2026-09-${String(d + 20).padStart(2, '0')}`, pesoKg: 80 }))
    expect(comoVa(pesoEstimado(corta, '2026-09-28')).metodo).toBe('ultimo_dato')
  })

  it('el ejemplo 88,35 · 83,35 · 87,75 aparta solo el del medio (no los tres)', () => {
    const e = comoVa(
      pesoEstimado(
        [
          { fecha: '2026-09-26', pesoKg: 88.35 },
          { fecha: '2026-09-28', pesoKg: 83.35 },
          { fecha: '2026-10-01', pesoKg: 87.75 },
        ],
        HOY,
      ),
    )
    expect(e.apartados).toEqual([{ fecha: '2026-09-28', pesoKg: 83.35 }])
    expect(e.n).toBe(2)
  })

  it('la fecha con hora (ISO completa) se lee por su día', () => {
    const e = comoVa(pesoEstimado([{ fecha: '2026-10-02T23:30:00-05:00', pesoKg: 70 }], HOY))
    expect(e.diasDesdeElUltimo).toBe(0)
    expect(e.ultimoPesaje.fecha).toBe('2026-10-02')
  })

  it('las fechas se cuentan por calendario: cruzar el cambio de mes no pierde ni inventa días', () => {
    const e = comoVa(pesoEstimado([{ fecha: '2026-09-30', pesoKg: 70 }], '2026-10-02'))
    expect(e.diasDesdeElUltimo).toBe(2)
  })
})
