import { describe, expect, it } from 'vitest'
import { perfilVacio } from './perfilVacio'

describe('la ficha vacía', () => {
  it('lleva solo los valores neutros, sin sexo y sin nada del coach', () => {
    const p = perfilVacio('u-x')
    expect(p).toEqual({
      usuarioId: 'u-x',
      objetivos: '',
      edad: 0,
      diasEntrenamiento: 0,
      tiempoSesionMin: 0,
      somatotipo: '',
      volumenSemanal: {},
      medidas: [],
    })
    expect('sexo' in p).toBe(false)
  })

  it('copia las medidas que le dan, no las comparte', () => {
    const medidas = [{ fecha: '2026-09-06', alturaCm: 165, perimetros: {} }]
    const p = perfilVacio('u-x', medidas)
    expect(p.medidas).toEqual(medidas)
    expect(p.medidas).not.toBe(medidas)
  })
})
