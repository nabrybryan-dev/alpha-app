import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EjercicioPrescrito } from '../../domain/types'
import { RegistroSerie } from './RegistroSerie'

/**
 * La carga que aparece ya escrita al abrir una serie. Es lo primero que ve el
 * asesorado con el teléfono en la mano y la barra cargada: si el número está
 * mal, o carga mal o pierde tiempo corrigiéndolo entre series.
 *
 * De dónde sale, en orden: la ondulación guardada → la última serie que hizo →
 * `cargaKg`, ya separado del texto. Y si no hay ninguna de las tres, 20 kg.
 *
 * Los tres últimos casos son los que justifican que exista la separación. Antes
 * la carga se sacaba de la frase con `parseFloat`, y el primer número de una
 * frase no es la carga: a veces son segundos, metros o repeticiones.
 */

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

let contador = 0

/** Cada render estrena borrador: el de localStorage no debe filtrarse al de al lado. */
function cargaSugerida(ejercicioPrescrito: EjercicioPrescrito, orden = 1): number {
  cleanup() // un test puede medir dos ejercicios: que no queden dos steppers
  contador += 1
  render(
    <RegistroSerie
      ejercicio={ejercicioPrescrito}
      orden={orden}
      borradorId={`t${contador}`}
      onGuardar={vi.fn()}
    />,
  )
  return Number((screen.getByLabelText('Carga en kg') as HTMLInputElement).value)
}

describe('RegistroSerie · carga sugerida', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('con el microciclo ondulado usa la carga de esa serie, no la de la anterior', () => {
    const e = ejercicio({
      seriesPrescritas: [
        { orden: 1, reps: 12, rir: 2, cargaKg: 80 },
        { orden: 2, reps: 10, rir: 2, cargaKg: 85 },
        { orden: 3, reps: 8, rir: 2, cargaKg: 90 },
      ],
      series: [{ orden: 1, cargaKg: 80, reps: 12, rir: 2 }],
    })
    expect(cargaSugerida(e, 2)).toBe(85)
  })

  it('sin ondulación repite la última carga registrada', () => {
    const e = ejercicio({
      cargaKg: 85,
      series: [
        { orden: 1, cargaKg: 85, reps: 10, rir: 2 },
        { orden: 2, cargaKg: 87.5, reps: 9, rir: 2 },
      ],
    })
    expect(cargaSugerida(e, 3)).toBe(87.5)
  })

  it('en la primera serie de la semana toma la carga pautada del campo', () => {
    const e = ejercicio({
      prescripcion: '85KG A 10 REPS; 3 SERIES (RIR 2). PROGRESA +5KG VS M21.',
      cargaKg: 85,
      unidadCarga: 'kg',
    })
    expect(cargaSugerida(e)).toBe(85)
  })

  it('sin ondulación, sin series y sin carga pautada cae en 20 kg', () => {
    expect(cargaSugerida(ejercicio())).toBe(20)
  })

  /**
   * Los tres de abajo tienen frase con números y **ningún** kilo que sacar de
   * ella. Antes salían 30, 30 y 8 respectivamente, porque se leía el primer
   * número de la frase. Ahora sale el valor por defecto, que es honesto: la app
   * no sabe la carga y no la finge.
   */
  it('no confunde los segundos de una plancha con kilos', () => {
    const e = ejercicio({ nombre: 'Plancha', prescripcion: '30 SEG POR LADO; 3 SERIES.' })
    expect(cargaSugerida(e)).toBe(20)
  })

  it('no confunde los metros de un paseo del granjero con kilos', () => {
    const e = ejercicio({ nombre: 'Paseo del granjero', prescripcion: '30 METROS; 4 SERIES.' })
    expect(cargaSugerida(e)).toBe(20)
  })

  /**
   * «ASISTENCIA 15KG» sí lleva kilos, pero la cabecera se lee anclada al
   * principio de la frase y aquí no lo está. Es deliberado: buscar «KG» en
   * cualquier parte del texto también encontraría el «+5KG» de «PROGRESA +5KG»
   * o el «61.5» de una nota del coach. Estos casos los rellena a mano
   * `scripts/rellenar-carga.mjs`, que los aparta en vez de adivinarlos.
   */
  it('con la carga en mitad de la frase no adivina: espera al campo', () => {
    const e = ejercicio({
      nombre: 'Dominadas asistidas',
      prescripcion: 'ASISTENCIA 15KG A 8 REPS; 3 SERIES (RIR 2).',
    })
    expect(cargaSugerida(e)).toBe(20)
    // Y con el campo puesto, que es lo que deja el relleno, sale bien.
    expect(cargaSugerida({ ...e, cargaKg: 15 })).toBe(15)
  })
})
