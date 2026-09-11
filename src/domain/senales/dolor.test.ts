import { describe, expect, it } from 'vitest'
import { TRAMOS_DOLOR, UMBRAL_DOLOR_QUE_AVISA, tramoDeDolor } from './dolor'

describe('tramoDeDolor', () => {
  it('el cero es un tramo propio: «sin dolor» es una medición, no un hueco', () => {
    expect(tramoDeDolor(0).etiqueta).toBe('ninguno')
  })

  it('reparte el 1-10 en leve / moderado / intenso sin dejar huecos ni solapes', () => {
    const etiquetas = Array.from({ length: 11 }, (_, n) => tramoDeDolor(n).etiqueta)
    expect(etiquetas).toEqual([
      'ninguno',
      'leve', 'leve', 'leve',
      'moderado', 'moderado', 'moderado',
      'intenso', 'intenso', 'intenso', 'intenso',
    ])
  })

  it('cada tramo dice cómo se vive, para que dos personas calibren igual', () => {
    for (const tramo of TRAMOS_DOLOR) expect(tramo.descripcion.length).toBeGreaterThan(0)
  })

  it('rechaza lo que no es un entero del 0 al 10', () => {
    expect(() => tramoDeDolor(-1)).toThrow(/entre 0 y 10/)
    expect(() => tramoDeDolor(11)).toThrow(/entre 0 y 10/)
    expect(() => tramoDeDolor(2.5)).toThrow(/enteros/)
  })

  it('el umbral que avisa al coach cae justo donde empieza «moderado»', () => {
    expect(tramoDeDolor(UMBRAL_DOLOR_QUE_AVISA).etiqueta).toBe('moderado')
    expect(tramoDeDolor(UMBRAL_DOLOR_QUE_AVISA - 1).etiqueta).toBe('leve')
  })
})
