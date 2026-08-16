/**
 * Una serie sin RIR ni repeticiones SE SALTA. Nunca cuenta como cero.
 *
 * `SerieRegistrada.rir` y `.reps` son opcionales desde el 2026-08-15 porque hay
 * trabajo que no se mide así: una plancha isométrica no tiene repeticiones en
 * reserva y un foam roller tampoco. La base guardaba ahí las palabras
 * «Isometría», «Control», «Movilidad» y «Suave» —81 series— porque el tipo
 * exigía un número y no había dónde poner «esto no lleva RIR». Un `avg` sobre
 * esa columna reventaba al toparse con el texto.
 *
 * La diferencia entre saltarse y contar como cero no es cosmética:
 *
 *   · RIR 0 significa **llegué al fallo**. Es el dato más duro que existe.
 *   · Reps 0 significa **no levanté nada**.
 *
 * Meter una plancha como RIR 0 en el promedio de un ejercicio dice que el
 * asesorado se vació cuando en realidad hizo un isométrico de control. Y ese
 * promedio es el que decide la carga de la semana siguiente.
 *
 * Ver `docs/specs/` y la migración 0039.
 */
import { describe, expect, it } from 'vitest'
import { desviacionRir } from './cumplimiento'
import { brechaReps, e1rmDeSeries } from './ondulacion'
import type { EjercicioPrescrito, SerieRegistrada } from './types'

const conRir = (orden: number, rir: number): SerieRegistrada => ({
  orden,
  cargaKg: 40,
  reps: 10,
  rir,
})

/** Una plancha registrada: hay carga y hay serie, pero ni reps ni RIR. */
const isometrica = (orden: number): SerieRegistrada => ({ orden, cargaKg: 20 })

function ejercicio(series: SerieRegistrada[], parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'ANTIEXTENSIÓN',
    nombre: 'Plancha a peso corporal',
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets: 3,
    rango: '8-10',
    repsDiana: 10,
    rirObjetivo: 2,
    series,
    ...parcial,
  }
}

describe('desviacionRir', () => {
  it('ignora las series sin RIR en vez de contarlas como 0', () => {
    // Con dos series a RIR 2 y una isométrica: el promedio es 2, no 1,33.
    expect(desviacionRir(2, [conRir(1, 2), conRir(2, 2), isometrica(3)])).toBe(0)
  })

  it('sin ninguna serie con RIR no inventa una desviación', () => {
    expect(desviacionRir(2, [isometrica(1), isometrica(2)])).toBeUndefined()
  })

  it('sigue midiendo la desviación cuando el RIR existe', () => {
    expect(desviacionRir(2, [conRir(1, 3), conRir(2, 3)])).toBe(1)
  })

  it('el RIR 0 sí cuenta: llegar al fallo es un dato, no un hueco', () => {
    expect(desviacionRir(2, [conRir(1, 0), conRir(2, 0)])).toBe(-2)
  })
})

describe('e1rmDeSeries', () => {
  it('no estima un 1RM a partir de una serie sin reps ni RIR', () => {
    expect(e1rmDeSeries([isometrica(1), isometrica(2)])).toBeUndefined()
  })

  it('estima con las medibles y descarta el resto', () => {
    const soloMedibles = e1rmDeSeries([conRir(1, 2), conRir(2, 2)])
    const conUnaIsometrica = e1rmDeSeries([conRir(1, 2), conRir(2, 2), isometrica(3)])
    expect(conUnaIsometrica).toBe(soloMedibles)
  })
})

describe('brechaReps', () => {
  it('no arrastra la brecha hacia abajo con las series sin reps', () => {
    // Diez repeticiones pedidas, diez hechas: la brecha es 0. Contar la
    // isométrica como 0 reps la dejaría en -3,3 y pediría bajar la carga.
    expect(brechaReps(ejercicio([conRir(1, 2), conRir(2, 2), isometrica(3)]))).toBe(0)
  })

  it('sin ninguna serie con reps devuelve undefined', () => {
    expect(brechaReps(ejercicio([isometrica(1), isometrica(2)]))).toBeUndefined()
  })
})

describe('la serie isométrica no desaparece del registro', () => {
  it('sigue contando como serie hecha aunque no tenga RIR', () => {
    // Lo que se pierde es la métrica, no la prueba de que entrenó.
    const e = ejercicio([conRir(1, 2), isometrica(2), isometrica(3)])
    expect(e.series).toHaveLength(3)
    expect(e.series.filter((s) => s.cargaKg > 0)).toHaveLength(3)
  })
})
