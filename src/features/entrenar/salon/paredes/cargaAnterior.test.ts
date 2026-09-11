import { describe, expect, it } from 'vitest'
import { cargaAnterior } from './cargaAnterior'
import type { EjercicioPrescrito, Microciclo, SerieRegistrada } from '../../../../domain/types'

/**
 * «LA SEMANA PASADA», PROBADO.
 *
 * El muro pone dos kilos uno debajo del otro y el de abajo es un HECHO: con cuánto levantó
 * la última vez. Un número inventado ahí es peor que ninguno, porque se compara con el de
 * hoy y decide si sube o baja la carga. Por eso cada camino que devuelve `undefined` tiene
 * su prueba: son los casos en que la línea NO se pinta.
 */

function serie(parcial: Partial<SerieRegistrada> = {}): SerieRegistrada {
  return { orden: 1, cargaKg: 70, reps: 8, rir: 2, ...parcial }
}

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'EMPUJE HORIZONTAL',
    nombre: 'Press de banca con barra',
    cues: 'Escápulas retraídas.',
    prescripcion: '80KG A 8 REPS; 3 SERIES (RIR 2).',
    cargaKg: 80,
    descansoMin: 3,
    sets: 3,
    rango: '(8-10)',
    repsDiana: 8,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

function microciclo(ejercicios: EjercicioPrescrito[]): Microciclo {
  return {
    id: 'm-previo',
    usuarioId: 'u1',
    numero: 3,
    cadenciaDias: 8,
    estado: 'cerrado',
    sesiones: [{ id: 's1', nombre: 'EMPUJE (LUNES)', orden: 1, ejercicios }],
  } as unknown as Microciclo
}

describe('cargaAnterior', () => {
  it('devuelve los kilos de la última serie registrada del mismo ejercicio', () => {
    const previo = microciclo([
      ejercicio({ series: [serie({ orden: 1, cargaKg: 72.5 }), serie({ orden: 2, cargaKg: 77.5 })] }),
    ])
    expect(cargaAnterior(previo, ejercicio())).toBe(77.5)
  })

  it('la ÚLTIMA por orden, no la última escrita ni la máxima', () => {
    // Una serie corregida se reescribe en su sitio: el array llega desordenado y la
    // máxima del día (80) no es con la que se terminó.
    const previo = microciclo([
      ejercicio({
        series: [serie({ orden: 3, cargaKg: 70 }), serie({ orden: 1, cargaKg: 80 }), serie({ orden: 2, cargaKg: 75 })],
      }),
    ])
    expect(cargaAnterior(previo, ejercicio())).toBe(70)
  })

  it('cruza por nombre aunque cambien acentos, mayúsculas y espacios', () => {
    // Los id se generan por microciclo: el mismo ejercicio tiene otro id cada semana.
    const previo = microciclo([
      ejercicio({ id: 'otro-id', nombre: '  PRESS  DE BANCA CON BARRA ', series: [serie({ cargaKg: 65 })] }),
    ])
    expect(cargaAnterior(previo, ejercicio({ id: 'e-nuevo' }))).toBe(65)
  })

  it('no inventa nada cuando la semana pasada no se llegó a registrar', () => {
    // Prescrito 80 kg y ni una serie escrita. Devolver esos 80 sería enseñar bajo «la
    // semana pasada» una carga que nadie levantó.
    expect(cargaAnterior(microciclo([ejercicio({ series: [] })]), ejercicio())).toBeUndefined()
  })

  it('devuelve indefinido si el ejercicio es nuevo o no hay microciclo previo', () => {
    const previo = microciclo([ejercicio({ nombre: 'Remo con barra', series: [serie()] })])
    expect(cargaAnterior(previo, ejercicio())).toBeUndefined()
    expect(cargaAnterior(undefined, ejercicio())).toBeUndefined()
    expect(cargaAnterior(previo, undefined)).toBeUndefined()
  })
})
