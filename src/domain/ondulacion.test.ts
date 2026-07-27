import { describe, expect, it } from 'vitest'
import {
  MICROS_POR_MACRO,
  REPS_MAX_TABLA,
  RIR_MAX_TABLA,
  bandaPrs,
  brechaReps,
  cargaObjetivo,
  coeficiente1rm,
  e1rmDeSerie,
  e1rmDeSeries,
  fasePeriodizacion,
  ondularEjercicio,
  rangoReps,
  redondearCarga,
} from './ondulacion'
import type { EjercicioPrescrito } from './types'

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'BISAGRA DE CADERA',
    nombre: 'PESO MUERTO RUMANO',
    cues: '',
    prescripcion: '',
    descansoMin: 3,
    sets: 4,
    rango: '8-10',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

describe('fasePeriodizacion', () => {
  it('sitúa cada microciclo en su mesociclo y semana', () => {
    expect(fasePeriodizacion(1)).toMatchObject({ meso: 1, semana: 1, descarga: false })
    expect(fasePeriodizacion(4)).toMatchObject({ meso: 1, semana: 4, descarga: true })
    expect(fasePeriodizacion(13)).toMatchObject({
      meso: 4,
      semana: 1,
      fase: 'Fuerza-hipertrofia',
      modelo: 'bloques-en-sesion',
      descarga: false,
    })
    expect(fasePeriodizacion(24)).toMatchObject({ meso: 6, semana: 4, descarga: true })
  })

  it('marca descarga solo en la semana 4 de cada mesociclo', () => {
    const descargas = Array.from({ length: MICROS_POR_MACRO }, (_, i) => i + 1)
      .filter((n) => fasePeriodizacion(n).descarga)
    expect(descargas).toEqual([4, 8, 12, 16, 20, 24])
  })

  it('repite el macrociclo pasado el 24', () => {
    expect(fasePeriodizacion(25)).toMatchObject({ micro: 1, meso: 1, semana: 1 })
  })

  it('los microciclos 14 y 15 caen en fuerza-hipertrofia sin descarga', () => {
    for (const numero of [14, 15]) {
      const fase = fasePeriodizacion(numero)
      expect(fase.fase).toBe('Fuerza-hipertrofia')
      expect(fase.descarga).toBe(false)
    }
  })
})

describe('coeficiente1rm', () => {
  it('coincide con la tabla de la plantilla', () => {
    expect(coeficiente1rm(1, 0)).toBe(1)
    expect(coeficiente1rm(10, 2)).toBe(0.615)
    expect(coeficiente1rm(8, 1)).toBe(0.715)
    expect(coeficiente1rm(15, 6)).toBe(0.3)
  })

  it('decrece de forma monótona al sumar reps o RIR, en pasos de 0.030 a 0.040', () => {
    for (let reps = 1; reps <= REPS_MAX_TABLA; reps++) {
      for (let rir = 0; rir <= RIR_MAX_TABLA; rir++) {
        if (rir < RIR_MAX_TABLA) {
          const paso = coeficiente1rm(reps, rir) - coeficiente1rm(reps, rir + 1)
          expect(paso).toBeGreaterThanOrEqual(0.03 - 1e-9)
          expect(paso).toBeLessThanOrEqual(0.04 + 1e-9)
        }
        if (reps < REPS_MAX_TABLA) {
          const paso = coeficiente1rm(reps, rir) - coeficiente1rm(reps + 1, rir)
          expect(paso).toBeGreaterThanOrEqual(0.03 - 1e-9)
          expect(paso).toBeLessThanOrEqual(0.04 + 1e-9)
        }
      }
    }
  })

  it('acota fuera de tabla en vez de romper', () => {
    expect(coeficiente1rm(0, 0)).toBe(coeficiente1rm(1, 0))
    expect(coeficiente1rm(99, 9)).toBe(coeficiente1rm(REPS_MAX_TABLA, RIR_MAX_TABLA))
  })
})

describe('1RM estimado', () => {
  it('invierte la tabla: 60 kg a 10 reps con RIR 2 son ~97.6 kg de 1RM', () => {
    expect(e1rmDeSerie({ orden: 1, cargaKg: 60, reps: 10, rir: 2 })).toBeCloseTo(97.56, 1)
  })

  it('carga y 1RM son consistentes en ida y vuelta', () => {
    const e1rm = e1rmDeSerie({ orden: 1, cargaKg: 80, reps: 8, rir: 2 })
    expect(cargaObjetivo(e1rm, 8, 2)).toBeCloseTo(80, 6)
  })

  it('usa la mediana para que una serie mal registrada no arrastre la semana', () => {
    const series = [
      { orden: 1, cargaKg: 60, reps: 10, rir: 2 },
      { orden: 2, cargaKg: 62.5, reps: 10, rir: 2 },
      { orden: 3, cargaKg: 600, reps: 10, rir: 2 },
    ]
    const estimado = e1rmDeSeries(series)
    expect(estimado).toBeCloseTo(62.5 / coeficiente1rm(10, 2), 1)
  })

  it('devuelve undefined sin series válidas', () => {
    expect(e1rmDeSeries([])).toBeUndefined()
    expect(e1rmDeSeries([{ orden: 1, cargaKg: 0, reps: 0, rir: 2 }])).toBeUndefined()
  })
})

describe('utilidades de prescripción', () => {
  it('lee rangos escritos de varias formas', () => {
    expect(rangoReps('8-10')).toEqual({ min: 8, max: 10 })
    expect(rangoReps('(6–8)')).toEqual({ min: 6, max: 8 })
    expect(rangoReps('12 a 15')).toEqual({ min: 12, max: 15 })
    expect(rangoReps('sin números')).toBeUndefined()
  })

  it('redondea al salto real del gimnasio', () => {
    expect(redondearCarga(61.3)).toBe(62.5)
    expect(redondearCarga(61.3, 5)).toBe(60)
  })

  it('calcula la brecha de reps contra la diana', () => {
    const ej = ejercicio({
      repsDiana: 10,
      series: [
        { orden: 1, cargaKg: 50, reps: 12, rir: 2 },
        { orden: 2, cargaKg: 50, reps: 12, rir: 2 },
      ],
    })
    expect(brechaReps(ej)).toBe(2)
    expect(brechaReps(ejercicio())).toBeUndefined()
  })

  it('clasifica el PRS en las bandas de la plantilla', () => {
    expect(bandaPrs(8)).toBe('verde')
    expect(bandaPrs(5)).toBe('ambar')
    expect(bandaPrs(3)).toBe('rojo')
  })
})

describe('ondularEjercicio', () => {
  const registrado = ejercicio({
    sets: 4,
    rango: '8-10',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [
      { orden: 1, cargaKg: 50, reps: 10, rir: 2 },
      { orden: 2, cargaKg: 50, reps: 10, rir: 2 },
      { orden: 3, cargaKg: 50, reps: 10, rir: 2 },
      { orden: 4, cargaKg: 50, reps: 10, rir: 2 },
    ],
  })

  it('ondula con reps descendentes y cargas ascendentes', () => {
    const r = ondularEjercicio(registrado)
    expect(r.series).toHaveLength(4)
    const reps = r.series.map((s) => s.reps)
    const cargas = r.series.map((s) => s.cargaKg)
    expect(reps).toEqual([...reps].sort((a, b) => b - a))
    expect(cargas).toEqual([...cargas].sort((a, b) => a - b))
    expect(reps[0]).toBe(10)
    expect(reps[reps.length - 1]).toBe(8)
  })

  it('deja el último set como el de mayor carga, con el RIR sostenido', () => {
    const r = ondularEjercicio(registrado)
    expect(r.series.every((s) => s.rir === registrado.rirObjetivo)).toBe(true)
    const cargas = r.series.map((s) => s.cargaKg)
    expect(cargas[cargas.length - 1]).toBeGreaterThan(cargas[0])
  })

  it('reproduce el ejemplo documentado (Mariana M15: 65→70→75→77.5 kg)', () => {
    const ej = ejercicio({
      nombre: 'ADUCCIÓN POLEA',
      sets: 4,
      rango: '9-13',
      repsDiana: 13,
      rirObjetivo: 2,
      series: [],
    })
    const r = ondularEjercicio(ej, { cargaPrescritaKg: 65 })
    const cargas = r.series.map((s) => s.cargaKg)
    // Arranca en la carga pautada y cierra donde cerró el ejemplo real.
    expect(cargas[0]).toBe(65)
    expect(cargas[2]).toBe(75)
    expect(cargas[3]).toBe(77.5)
    expect(cargas).toEqual([...cargas].sort((a, b) => a - b))
  })

  it('sin deriva de fatiga la carga se dispara por encima del patrón real', () => {
    const ej = ejercicio({ sets: 4, rango: '9-13', repsDiana: 13, rirObjetivo: 2, series: [] })
    const sin = ondularEjercicio(ej, { cargaPrescritaKg: 65, derivaFatiga: 0 })
    expect(sin.series[3].cargaKg).toBeGreaterThan(82)
  })

  it('ondula sobre una programación ya hecha, sin series registradas', () => {
    const soloPautado = ejercicio({ sets: 5, rango: '8-10', repsDiana: 10, rirObjetivo: 2 })
    const r = ondularEjercicio(soloPautado, { cargaPrescritaKg: 50 })
    expect(r.series).toHaveLength(5)
    expect(r.series[0].cargaKg).toBe(50)
    // Con un rango estrecho y muchos sets la deriva de fatiga compensa lo que
    // gana el descenso de reps: la carga se aplana, pero nunca baja.
    expect(r.series.at(-1)!.cargaKg).toBeGreaterThanOrEqual(50)
  })

  it('la carga nunca retrocede entre sets consecutivos', () => {
    for (const rango of ['8-10', '6-8', '10-12', '12-15']) {
      for (const sets of [2, 3, 4, 5]) {
        const r = ondularEjercicio(ejercicio({ sets, rango, repsDiana: 10, rirObjetivo: 2 }), {
          cargaPrescritaKg: 50,
        })
        const cargas = r.series.map((s) => s.cargaKg)
        expect(cargas).toEqual([...cargas].sort((a, b) => a - b))
      }
    }
  })

  it('aplica deriva de fatiga bajando el 1RM efectivo set a set', () => {
    const sinDeriva = ondularEjercicio(registrado, { derivaFatiga: 0 })
    const conDeriva = ondularEjercicio(registrado, { derivaFatiga: 0.05 })
    expect(conDeriva.series.at(-1)!.cargaKg).toBeLessThan(sinDeriva.series.at(-1)!.cargaKg)
  })

  it('sube la carga cuando hizo más reps de las pedidas', () => {
    const corto = ejercicio({
      ...registrado,
      series: registrado.series.map((s) => ({ ...s, reps: 13 })),
    })
    const r = ondularEjercicio(corto)
    expect(r.brechaReps).toBe(3)
    expect(r.direccion).toBe('subir')
    expect(r.motivo).toContain('la carga iba corta')
  })

  it('baja la carga cuando se quedó por debajo', () => {
    const pasado = ejercicio({
      ...registrado,
      series: registrado.series.map((s) => ({ ...s, reps: 5 })),
    })
    const r = ondularEjercicio(pasado)
    expect(r.brechaReps).toBe(-5)
    expect(r.direccion).toBe('bajar')
    expect(r.motivo).toContain('la carga iba por encima')
  })

  it('congela la progresión y suelta el RIR con PRS en rojo', () => {
    const r = ondularEjercicio(registrado, { prs: 2 })
    expect(r.series.every((s) => s.rir === registrado.rirObjetivo + 1)).toBe(true)
    expect(r.motivo).toContain('PRS en rojo')
  })

  it('recorta series en semana de descarga sin bajar la intensidad', () => {
    const normal = ondularEjercicio(registrado)
    const descarga = ondularEjercicio(registrado, { descarga: true })
    expect(descarga.series.length).toBeLessThan(normal.series.length)
    expect(descarga.motivo).toContain('descarga')
    const tope = descarga.series[descarga.series.length - 1]
    expect(tope.rir).toBe(registrado.rirObjetivo)
  })

  it('no inventa prescripción si no hay nada registrado', () => {
    const r = ondularEjercicio(ejercicio())
    expect(r.direccion).toBe('sin-datos')
    expect(r.series).toEqual([])
    expect(r.e1rm).toBeUndefined()
  })
})
