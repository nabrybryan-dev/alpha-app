import { describe, expect, it } from 'vitest'
import { salonDeMaquinas } from './salonDeMaquinas'
import type { EjercicioPrescrito, SerieRegistrada } from './types'

function ejercicio(sets: number, hechas: number): EjercicioPrescrito {
  const series: SerieRegistrada[] = Array.from({ length: hechas }, (_, i) => ({
    orden: i + 1,
    cargaKg: 40,
    reps: 8,
    rir: 2,
  }))
  return {
    id: `e${sets}-${hechas}-${Math.round(hechas * 7 + sets)}`,
    categoria: 'SENTADILLA',
    nombre: 'Sentadilla',
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets,
    rango: '8-10',
    repsDiana: 8,
    rirObjetivo: 2,
    series,
  }
}

describe('salonDeMaquinas', () => {
  it('abre una máquina por cada ejercicio con sus series completas', () => {
    const s = salonDeMaquinas([ejercicio(3, 3), ejercicio(3, 1), ejercicio(3, 3)])
    expect(s.abiertas).toEqual([0, 2])
    expect(s.total).toBe(3)
  })

  /**
   * Se desbloquea con series, no con toques. Si bastara con verlas, en diez
   * segundos de scroll estarían las cinco y el contador hablaría de navegación,
   * no de entrenamiento.
   */
  it('un ejercicio empezado pero sin terminar no abre nada', () => {
    expect(salonDeMaquinas([ejercicio(4, 3)]).abiertas).toEqual([])
  })

  it('pasarse de series también cuenta como completo', () => {
    expect(salonDeMaquinas([ejercicio(3, 5)]).abiertas).toEqual([0])
  })

  describe('insignia', () => {
    it('con todas hechas, el salón está completo', () => {
      expect(salonDeMaquinas([ejercicio(3, 3), ejercicio(2, 2)]).completo).toBe(true)
    })

    it('con una a medias, no', () => {
      expect(salonDeMaquinas([ejercicio(3, 3), ejercicio(2, 1)]).completo).toBe(false)
    })

    /** Una sesión sin ejercicios no es un salón completo: es una sesión vacía. */
    it('sin ejercicios no se regala la insignia', () => {
      expect(salonDeMaquinas([])).toEqual({ abiertas: [], total: 0, completo: false })
    })
  })
})
