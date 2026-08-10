import { describe, expect, it } from 'vitest'
import { cargaEnTexto, cargaPrescritaDe } from './cargaPrescrita'
import type { EjercicioPrescrito } from './types'

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

describe('cargaEnTexto', () => {
  it('lee la carga del formato canónico del coach', () => {
    expect(cargaEnTexto('85KG A 10 REPS; 3 SERIES (RIR 2)')).toBe(85)
  })

  it('se queda con la carga y no con el salto que viene después', () => {
    expect(cargaEnTexto('85KG A 10 REPS; 3 SERIES (RIR 2). PROGRESA +5KG VS M21')).toBe(85)
  })

  it('encuentra los kilos aunque el texto no empiece por ellos', () => {
    expect(cargaEnTexto('ASISTENCIA 15KG A 8 REPS; 3 SERIES (RIR 2)')).toBe(15)
  })

  it('no confunde una duración con una carga', () => {
    // La plancha se pauta en segundos y el peso va en la espalda: son 5 kg, no 40.
    expect(cargaEnTexto('40 SEG; 3 SERIES. +5KG EN ESPALDA VS M21')).toBe(5)
  })

  it('admite decimales con punto y con coma', () => {
    expect(cargaEnTexto('52.5KG A 9 REPS')).toBe(52.5)
    expect(cargaEnTexto('52,5KG A 9 REPS')).toBe(52.5)
  })

  it('admite el espacio y la minúscula que a veces se cuelan al pegar del Excel', () => {
    expect(cargaEnTexto('42.5 kg a 11 reps')).toBe(42.5)
  })

  it('sin unidad no inventa una carga', () => {
    expect(cargaEnTexto('3 SERIES A 12 REPS AL FALLO')).toBeUndefined()
    expect(cargaEnTexto('')).toBeUndefined()
  })

  it('un cero pautado no es una carga: es la ausencia de una', () => {
    expect(cargaEnTexto('0KG A 12 REPS')).toBeUndefined()
  })
})

describe('cargaPrescritaDe', () => {
  it('manda el campo cuando el ejercicio lo trae', () => {
    const e = ejercicio({ cargaPrescritaKg: 90, prescripcion: '85KG A 10 REPS' })
    expect(cargaPrescritaDe(e)).toBe(90)
  })

  /**
   * Los microciclos que ya están en la nube y los que se cargan a mano por SQL
   * no traen el campo. Mientras existan, el texto sigue siendo su única carga.
   */
  it('cae en el texto para los microciclos guardados antes de que el campo existiera', () => {
    expect(cargaPrescritaDe(ejercicio({ prescripcion: '85KG A 10 REPS' }))).toBe(85)
  })

  it('sin campo y sin texto no devuelve un número de relleno', () => {
    expect(cargaPrescritaDe(ejercicio())).toBeUndefined()
  })
})
