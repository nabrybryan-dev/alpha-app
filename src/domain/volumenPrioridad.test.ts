import { describe, expect, it } from 'vitest'
import { prioridadDeVolumen } from './volumenPrioridad'

describe('prioridadDeVolumen', () => {
  it('destaca los dos grupos con más volumen y el que menos', () => {
    expect(
      prioridadDeVolumen({
        Isquios: 'Muy Alto',
        Glúteo: 'Alto',
        Bíceps: 'Normal',
        Cuádriceps: 'Bajo',
      }),
    ).toEqual([
      { grupo: 'Isquios', nivel: 'Muy Alto' },
      { grupo: 'Glúteo', nivel: 'Alto' },
      { grupo: 'Cuádriceps', nivel: 'Bajo' },
    ])
  })

  it('con varios empatados, respeta el orden en que vienen', () => {
    const r = prioridadDeVolumen({
      Isquios: 'Muy Alto',
      Pecho: 'Muy Alto',
      Espalda: 'Muy Alto',
      Tríceps: 'Muy Bajo',
    })
    expect(r.map((g) => g.grupo)).toEqual(['Isquios', 'Pecho', 'Tríceps'])
  })

  it('deja fuera los Normal: no dicen nada del sesgo del bloque', () => {
    expect(prioridadDeVolumen({ Pecho: 'Normal', Espalda: 'Normal' })).toEqual([])
  })

  it('sin grupo bajo, muestra solo los altos', () => {
    expect(prioridadDeVolumen({ Pecho: 'Alto', Espalda: 'Normal' })).toEqual([
      { grupo: 'Pecho', nivel: 'Alto' },
    ])
  })

  it('con el perfil vacío no inventa nada', () => {
    expect(prioridadDeVolumen({})).toEqual([])
  })
})
