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
 * la carga que dice la prescripción del coach → 20 kg.
 *
 * Los dos últimos casos de este archivo documentan un fallo REAL: el último
 * escalón lee la carga sacándole un número al texto libre del coach
 * (`Number.parseFloat(prescripcion)`), y ese texto no siempre empieza por los
 * kilos. Están en rojo a propósito hasta que la carga viaje en su propio campo.
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
      prescripcion: '85KG A 10 REPS; 3 SERIES (RIR 2)',
      series: [
        { orden: 1, cargaKg: 85, reps: 10, rir: 2 },
        { orden: 2, cargaKg: 87.5, reps: 9, rir: 2 },
      ],
    })
    expect(cargaSugerida(e, 3)).toBe(87.5)
  })

  it('en la primera serie de la semana toma la carga de la prescripción', () => {
    const e = ejercicio({ prescripcion: '85KG A 10 REPS; 3 SERIES (RIR 2). PROGRESA +5KG VS M21' })
    expect(cargaSugerida(e)).toBe(85)
  })

  it('sin ondulación, sin series y sin prescripción cae en 20 kg', () => {
    expect(cargaSugerida(ejercicio())).toBe(20)
  })

  it('lee los kilos de la asistencia cuando la prescripción no empieza por el número', () => {
    const e = ejercicio({
      nombre: 'Dominadas asistidas',
      prescripcion: 'ASISTENCIA 15KG A 8 REPS; 3 SERIES (RIR 2)',
    })
    expect(cargaSugerida(e)).toBe(15)
  })

  it('no confunde los segundos de la plancha con kilos', () => {
    const e = ejercicio({
      nombre: 'Plancha con carga',
      prescripcion: '40 SEG; 3 SERIES. +5KG EN ESPALDA VS M21',
      repsDiana: 40,
    })
    expect(cargaSugerida(e)).toBe(5)
  })
})
