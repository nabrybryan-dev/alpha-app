import { describe, expect, it } from 'vitest'
import { ANGULOS, aspectoDeEstacion, estacionesDeLaSerie } from './estacionesDeLaSerie'
import type { EjercicioPrescrito, SerieRegistrada } from '../../../../domain/types'

/**
 * LAS CUATRO ESTACIONES, PROBADAS.
 *
 * Dos familias de prueba, y hacen falta las dos: qué DICE cada estación —que es donde se
 * puede mentir— y cómo CAE según dónde mire la cámara, que es lo que las hace objetos de
 * la sala en vez de una interfaz pegada al cristal.
 */

function serie(orden: number): SerieRegistrada {
  return { orden, cargaKg: 80, reps: 8, rir: 2 }
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

describe('estacionesDeLaSerie', () => {
  it('son cuatro, en cruz alrededor del cuerpo', () => {
    const e = estacionesDeLaSerie(ejercicio())
    expect(e.map((x) => x.clave)).toEqual(['series', 'reps', 'descanso', 'rir'])
    expect(e.map((x) => x.angulo)).toEqual([45, 135, 225, 315])
    // Repartidos: dos estaciones en el mismo ángulo se escribirían una encima de la otra
    // en cualquier azimut, no solo en uno.
    expect(new Set(Object.values(ANGULOS)).size).toBe(4)
  })

  it('sin ejercicio no hay estaciones', () => {
    expect(estacionesDeLaSerie(undefined)).toEqual([])
  })

  it('ninguna cifra lleva unidad, rango ni espacios: partiría el renglón', () => {
    for (const e of estacionesDeLaSerie(ejercicio({ descansoMin: 1.5 }))) {
      expect(e.cifra, `${e.clave} mete algo más que la cifra`).not.toMatch(/[\s()]/)
    }
  })

  it('la de series cambia en cuanto hay algo registrado', () => {
    const pautado = estacionesDeLaSerie(ejercicio())[0]
    expect(pautado.cifra).toBe('3')
    expect(pautado.pie).toBe('bloques de trabajo')

    const enCurso = estacionesDeLaSerie(ejercicio({ series: [serie(1), serie(2)] }))[0]
    expect(enCurso.cifra).toBe('2/3')
    expect(enCurso.pie).toBe('registradas de 3')
  })

  it('FALLO no se rotula como un RIR, ni se cuenta como cero', () => {
    const alFallo = estacionesDeLaSerie(ejercicio({ rirObjetivo: 'FALLO' }))[3]
    expect(alFallo.cifra).toBe('FALLO')
    expect(alFallo.rotulo).toBe('Intensidad')

    const cero = estacionesDeLaSerie(ejercicio({ rirObjetivo: 0 }))[3]
    expect(cero.cifra).toBe('0')
    expect(cero.rotulo).toBe('RIR')
    expect(cero.pie).not.toBe(alFallo.pie)
  })

  it('el descanso lleva coma decimal, no punto', () => {
    expect(estacionesDeLaSerie(ejercicio({ descansoMin: 1.5 }))[2].cifra).toBe('1,5')
  })
})

describe('aspectoDeEstacion', () => {
  it('de frente está entera; de espaldas, apagada y encogida', () => {
    // Una estación está de frente cuando `angulo + azimut` da 0: entonces cae en el centro
    // del cuerpo, a plena luz y a tamaño completo.
    const deFrente = aspectoDeEstacion(45, -45, 138)
    expect(deFrente.x).toBeCloseTo(0, 5)
    expect(deFrente.opacidad).toBeCloseTo(1, 5)
    expect(deFrente.escala).toBeCloseTo(1, 5)
    expect(deFrente.alza).toBe(0)

    const deEspaldas = aspectoDeEstacion(45, 135, 138)
    expect(deEspaldas.opacidad).toBeCloseTo(0.32, 5)
    expect(deEspaldas.escala).toBeCloseTo(0.68, 5)
    expect(deEspaldas.alza).toBeCloseTo(110, 5)
  })

  it('las de atrás se LEVANTAN, y sin eso se escribirían encima de las de delante', () => {
    // Con el azimut a 0, la de 45° y la de 135° caen en x simétricos, pero la de 225° y la
    // de 315° comparten x con ellas. Lo único que las separa es el alza.
    const delante = aspectoDeEstacion(ANGULOS.series, 0, 138)
    const detras = aspectoDeEstacion(ANGULOS.descanso, 0, 138)
    expect(detras.x).toBeCloseTo(-delante.x, 5)
    expect(delante.alza).toBe(0)
    expect(detras.alza).toBeGreaterThan(60)
  })

  it('el giro de la cámara MUEVE las estaciones: son objetos de la sala', () => {
    // Es la diferencia con un panel pegado a la pantalla. Si esto devolviera lo mismo para
    // dos azimuts distintos, orbitar dejaría las cifras clavadas y la sala girando detrás.
    // 0 y 60 y no 0 y 90: a 90 el seno de 45 y el de 135 coinciden por simetría y la x
    // sale idéntica, así que la prueba habría pasado sin probar nada.
    const a = aspectoDeEstacion(45, 0, 138)
    const b = aspectoDeEstacion(45, 60, 138)
    expect(a.x).not.toBeCloseTo(b.x, 1)
    expect(a.opacidad).not.toBeCloseTo(b.opacidad, 2)
  })

  it('el radio escala el sitio y no toca la luz', () => {
    const cerca = aspectoDeEstacion(45, 0, 100)
    const lejos = aspectoDeEstacion(45, 0, 200)
    expect(lejos.x).toBeCloseTo(cerca.x * 2, 5)
    expect(lejos.opacidad).toBeCloseTo(cerca.opacidad, 5)
  })
})
