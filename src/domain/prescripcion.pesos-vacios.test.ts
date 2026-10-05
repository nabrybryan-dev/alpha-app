import { describe, expect, it } from 'vitest'
import { componerPrescripcion } from './prescripcion'
import type { EjercicioPrescrito } from './types'

/**
 * COMPONER LA FRASE CON UNA ESCALERA QUE TIENE UN ESCALÓN SIN KILOS.
 *
 * `SeriePrescrita.cargaKg` es obligatorio en el tipo, pero los planes reales traen `null` o
 * directamente sin la llave en algunas series. `cabeceraOndulada` le hacía `toFixed` y el
 * panel del coach caía al proponer la semana. Medido el 14-sep: 12 ejercicios en 4
 * asesorados. La regla 3 del propio archivo ya dice qué hacer cuando no hay kilos con los
 * que componer: devolver la prescripción intacta, sin inventar un número.
 */

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'FLEXIÓN DE RODILLA',
    nombre: 'Flexión de rodilla en máquina',
    cues: '',
    prescripcion: 'ELIGE TÚ EL PESO; 3 SERIES (RIR 3).',
    descansoMin: 2,
    sets: 3,
    rango: '8-10',
    repsDiana: 10,
    rirObjetivo: 3,
    series: [],
    ...parcial,
  }
}

describe('componerPrescripcion con escalones sin kilos', () => {
  it('un escalón con `cargaKg: null` no revienta y devuelve la prescripción intacta', () => {
    const e = ejercicio({
      seriesPrescritas: [
        { orden: 1, reps: 10, rir: 3, cargaKg: 20 },
        { orden: 2, reps: 10, rir: 3, cargaKg: null as never },
      ],
    })
    expect(componerPrescripcion(e)).toBe(e.prescripcion)
  })

  it('un escalón sin la llave `cargaKg` tampoco', () => {
    const sinLlave = { orden: 1, reps: 10, rir: 3 } as never
    const e = ejercicio({ seriesPrescritas: [sinLlave] })
    expect(componerPrescripcion(e)).toBe(e.prescripcion)
  })

  it('y una escalera completa se sigue componiendo como siempre', () => {
    const e = ejercicio({
      seriesPrescritas: [
        { orden: 1, reps: 10, rir: 3, cargaKg: 60 },
        { orden: 2, reps: 8, rir: 3, cargaKg: 62.5 },
      ],
    })
    expect(componerPrescripcion(e)).toMatch(/^ONDULACIÓN ASCENDENTE: 60KG×10 · 62\.5KG×8/)
  })
})
