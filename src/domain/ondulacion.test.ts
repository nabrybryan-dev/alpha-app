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
  aplicarOndulacion,
  ejercicioOndulado,
  ondularEjercicio,
  rangoReps,
  redondearCarga,
  seriePrescrita,
  sesionOndulada,
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

  /**
   * Los tres únicos valores que la app puede producir: el test post-sesión pregunta
   * con botones POCO / NORMAL / MUCHO, que valen 3 / 6 / 9
   * (`TestPostSesion.tsx:16-20`). Los demás números de la escala 0-10 no llegan
   * nunca, así que este es el caso que hay que proteger: si alguien mueve los
   * cortes, lo que importa es que POCO siga frenando.
   */
  it('sobre los cuatro valores reales de la app', () => {
    expect(bandaPrs(1)).toBe('critico') // NADA
    expect(bandaPrs(3)).toBe('rojo') // POCO
    expect(bandaPrs(6)).toBe('ambar') // NORMAL
    expect(bandaPrs(9)).toBe('verde') // MUCHO
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

  /**
   * FIJA LO MEDIDO, no una preferencia. `FACTOR_DESCARGA = 2/3` salió de 356
   * bajadas reales de series entre microciclos consecutivos de las 21 plantillas:
   * acierta el 81,7 % de ellas, contra 70,5 % de 0.6 y 67,1 % de 0.75.
   *
   * El caso de 2 series es el que descarta 0.75 por sí solo: `round(2 * 0.75) = 2`
   * dejaría la descarga sin efecto, y hay 51 bajadas reales de 2→1.
   *
   * Si alguien cambia la constante, estos tres casos se ponen rojos. Ese es el
   * punto: el número se mueve con datos nuevos, no por intuición.
   */
  it('la descarga recorta las series como lo hace Bryan de verdad', () => {
    const conSets = (sets: number) =>
      ondularEjercicio(ejercicio({ ...registrado, sets, series: registrado.series }), {
        descarga: true,
      }).series.length

    expect(conSets(3)).toBe(2) // el patrón más frecuente: 177 de 356
    expect(conSets(4)).toBe(3) // el segundo: 61 — con 0.6 daría 2
    expect(conSets(2)).toBe(1) // 51 casos — con 0.75 se quedaría en 2
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

  /**
   * SE QUEDA CERCA DE UN CASO REAL, QUE NO ES LO MISMO QUE REPRODUCIRLO.
   *
   * Este test se llamaba «reproduce el ejemplo documentado» y fijaba tres cargas
   * exactas del microciclo 15 de una asesorada (65→70→75→77.5). Dos problemas:
   *
   *   1. **Nunca lo reprodujo.** Ni con la deriva vieja de 0.025: daba
   *      65 · 67.5 · 75 · 77.5, con el segundo set 2.5 kg por debajo. El test solo
   *      miraba los sets 1, 3 y 4, así que el desajuste no se veía.
   *   2. Era la calibración de **un solo caso** convertida en especificación. Al
   *      medir 505 casos reales (ver `DERIVA_FATIGA_POR_SET`), este resultó estar
   *      por encima de la mediana: con la deriva medida, el motor cierra en 75 y no
   *      en 77.5.
   *
   * Así que ahora se comprueba lo que de verdad se quiere: que el motor **arranque
   * en la carga pautada, suba de forma monótona y se quede dentro de un escalón de
   * redondeo (2.5 kg) del patrón real, nunca por encima**. Ir por debajo es el lado
   * recuperable; una serie ligera se corrige la semana siguiente.
   */
  it('se queda a un escalón del patrón real, y nunca por encima', () => {
    const ej = ejercicio({
      nombre: 'ADUCCIÓN POLEA',
      sets: 4,
      rango: '9-13',
      repsDiana: 13,
      rirObjetivo: 2,
      series: [],
    })
    const real = [65, 70, 75, 77.5]
    const cargas = ondularEjercicio(ej, { cargaPrescritaKg: 65 }).series.map((s) => s.cargaKg)

    expect(cargas[0]).toBe(65)
    expect(cargas).toEqual([...cargas].sort((a, b) => a - b))
    cargas.forEach((kg, i) => {
      expect(kg).toBeLessThanOrEqual(real[i])
      expect(real[i] - kg).toBeLessThanOrEqual(2.5)
    })
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
    const r = ondularEjercicio(registrado, { prs: 3 })
    expect(r.series.every((s) => s.rir === registrado.rirObjetivo + 1)).toBe(true)
    expect(r.motivo).toContain('PRS en rojo')
  })

  /**
   * El nivel NADA (1). Antes había solo tres botones y esto se trataba igual que
   * POCO; el método pide para la banda 0-2 algo más fuerte que frenar.
   */
  it('con PRS crítico recorta una serie y suelta 2 de RIR', () => {
    const r = ondularEjercicio(registrado, { prs: 1 })
    expect(r.series).toHaveLength(registrado.sets - 1)
    expect(r.series.every((s) => s.rir === registrado.rirObjetivo + 2)).toBe(true)
    expect(r.motivo).toContain('PRS crítico')
    // Lo que el motor NO decide, pero recuerda:
    expect(r.motivo).toContain('accesorios')
  })

  it('crítico nunca deja un ejercicio sin series', () => {
    const unaSerie = { ...registrado, sets: 1 }
    expect(ondularEjercicio(unaSerie, { prs: 1 }).series).toHaveLength(1)
  })

  it('crítico y descarga se acumulan, sin bajar de una serie', () => {
    const r = ondularEjercicio(registrado, { prs: 1, descarga: true })
    const soloDescarga = ondularEjercicio(registrado, { descarga: true })
    expect(r.series.length).toBeLessThan(soloDescarga.series.length)
    expect(r.series.length).toBeGreaterThanOrEqual(1)
  })

  /**
   * El caso que de verdad ocurre: el asesorado pulsa POCO, que vale 3. El test de
   * arriba usa un 2, que la app no puede producir.
   */
  it('POCO (3) frena igual que cualquier rojo, y NORMAL (6) no frena', () => {
    const poco = ondularEjercicio(registrado, { prs: 3 })
    expect(poco.series.every((s) => s.rir === registrado.rirObjetivo + 1)).toBe(true)
    expect(poco.motivo).toContain('PRS en rojo')

    const normal = ondularEjercicio(registrado, { prs: 6 })
    expect(normal.series.every((s) => s.rir === registrado.rirObjetivo)).toBe(true)
    // El ámbar ya no anuncia una "progresión vigilada" que no existía.
    expect(normal.motivo).not.toContain('vigilada')
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

describe('la ondulación guardada en el ejercicio', () => {
  const base = ejercicio({ sets: 4, rango: '8-10', repsDiana: 10, rirObjetivo: 2 })

  it('aplicarOndulacion deja una prescripción por set', () => {
    const r = aplicarOndulacion(base, { cargaPrescritaKg: 50 })
    expect(r.seriesPrescritas).toHaveLength(4)
    expect(r.seriesPrescritas!.map((s) => s.orden)).toEqual([1, 2, 3, 4])
    expect(ejercicioOndulado(r)).toBe(true)
  })

  it('deja el ejercicio intacto si no hay ancla para calcular', () => {
    const r = aplicarOndulacion(base)
    expect(r).toBe(base)
    expect(ejercicioOndulado(r)).toBe(false)
  })

  it('ajusta los sets cuando la descarga recorta volumen', () => {
    const r = aplicarOndulacion(base, { cargaPrescritaKg: 50, descarga: true })
    expect(r.sets).toBe(r.seriesPrescritas!.length)
    expect(r.sets).toBeLessThan(base.sets)
    expect(ejercicioOndulado(r)).toBe(true)
  })

  it('seriePrescrita devuelve la serie por su orden', () => {
    const r = aplicarOndulacion(base, { cargaPrescritaKg: 50 })
    expect(seriePrescrita(r, 1)!.reps).toBe(10)
    expect(seriePrescrita(r, 4)!.reps).toBe(8)
    expect(seriePrescrita(r, 9)).toBeUndefined()
    expect(seriePrescrita(base, 1)).toBeUndefined()
  })

  it('una sesión solo está ondulada si lo están todos sus ejercicios', () => {
    const ondulado = aplicarOndulacion(base, { cargaPrescritaKg: 50 })
    expect(sesionOndulada([ondulado, ondulado])).toBe(true)
    expect(sesionOndulada([ondulado, base])).toBe(false)
    expect(sesionOndulada([])).toBe(false)
  })
})
