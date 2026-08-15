import { describe, expect, it } from 'vitest'
import type { EjercicioPrescrito, Microciclo } from './types'
import { volumenDeBloque } from './volumenDeBloque'

let contador = 0

function ejercicio(categoria: string, sets: number): EjercicioPrescrito {
  contador += 1
  return {
    id: `e-test-${contador}`,
    categoria,
    nombre: categoria,
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets,
    rango: '8-10',
    repsDiana: 8,
    rirObjetivo: 2,
    series: [],
  }
}

function microciclo(numero: number, ejercicios: EjercicioPrescrito[]): Microciclo {
  return {
    id: `m-${numero}`,
    usuarioId: 'u-test',
    numero,
    cadenciaDias: 8,
    estado: 'cerrado',
    fechaInicio: '2026-07-10',
    sesiones: [{ id: `s-${numero}`, nombre: 'LEG A', orden: 1, ejercicios }],
  }
}

describe('volumenDeBloque', () => {
  it('sin microciclos devuelve la rejilla vacía', () => {
    expect(volumenDeBloque([])).toEqual({ numeros: [], filas: [] })
  })

  it('pone una columna por microciclo y una fila por grupo con volumen', () => {
    const rejilla = volumenDeBloque([
      microciclo(1, [ejercicio('SENTADILLA', 4)]),
      microciclo(2, [ejercicio('SENTADILLA', 6)]),
    ])
    expect(rejilla.numeros).toEqual([1, 2])
    expect(rejilla.filas.find((f) => f.grupo === 'Cuádriceps')?.porMicrociclo).toEqual([4, 6])
  })

  it('ordena las columnas por número, no por como vinieran de la base', () => {
    const rejilla = volumenDeBloque([
      microciclo(12, [ejercicio('SENTADILLA', 9)]),
      microciclo(3, [ejercicio('SENTADILLA', 5)]),
      microciclo(8, [ejercicio('SENTADILLA', 7)]),
    ])
    expect(rejilla.numeros).toEqual([3, 8, 12])
    expect(rejilla.filas[0].porMicrociclo).toEqual([5, 7, 9])
  })

  /**
   * Sin el 0 la fila no se puede leer como serie temporal: un grupo que
   * descansó una semana se vería igual que uno que nunca se programó.
   */
  it('escribe 0 en el microciclo donde el grupo no se tocó', () => {
    const rejilla = volumenDeBloque([
      microciclo(1, [ejercicio('FLEXIÓN DE CODO', 4)]),
      microciclo(2, [ejercicio('SENTADILLA', 6)]),
      microciclo(3, [ejercicio('FLEXIÓN DE CODO', 2)]),
    ])
    expect(rejilla.filas.find((f) => f.grupo === 'Bíceps')?.porMicrociclo).toEqual([4, 0, 2])
    expect(rejilla.filas.find((f) => f.grupo === 'Cuádriceps')?.porMicrociclo).toEqual([0, 6, 0])
  })

  it('suma el total del bloque por grupo', () => {
    const rejilla = volumenDeBloque([
      microciclo(1, [ejercicio('EXTENSIÓN DE RODILLA', 3)]),
      microciclo(2, [ejercicio('EXTENSIÓN DE RODILLA', 5)]),
    ])
    expect(rejilla.filas.find((f) => f.grupo === 'Cuádriceps')?.total).toBe(8)
  })

  it('acumula varios ejercicios del mismo grupo dentro de un microciclo', () => {
    const rejilla = volumenDeBloque([
      microciclo(1, [ejercicio('SENTADILLA', 4), ejercicio('EXTENSIÓN DE RODILLA', 3)]),
    ])
    expect(rejilla.filas.find((f) => f.grupo === 'Cuádriceps')?.porMicrociclo).toEqual([7])
  })

  it('reparte el trabajo indirecto, igual que el resto del dominio', () => {
    const rejilla = volumenDeBloque([microciclo(1, [ejercicio('EMPUJE HORIZONTAL', 4)])])
    expect(rejilla.filas.map((f) => [f.grupo, f.total])).toEqual([
      ['Pecho', 4],
      ['Hombros', 2],
      ['Tríceps', 2],
    ])
  })

  it('no arrastra el ruido de la coma flotante al sumar el bloque', () => {
    const rejilla = volumenDeBloque([
      microciclo(1, [ejercicio('EMPUJE HORIZONTAL', 1)]),
      microciclo(2, [ejercicio('EMPUJE INCLINADO', 1)]),
      microciclo(3, [ejercicio('EMPUJE VERTICAL', 1)]),
    ])
    const triceps = rejilla.filas.find((f) => f.grupo === 'Tríceps')
    expect(triceps?.porMicrociclo).toEqual([0.5, 0.5, 0.5])
    expect(triceps?.total).toBe(1.5)
  })

  it('devuelve las filas en el orden de presentación del PANEL', () => {
    const rejilla = volumenDeBloque([
      microciclo(1, [
        ejercicio('FLEXIÓN DE CODO', 3),
        ejercicio('SENTADILLA', 3),
        ejercicio('EMPUJE HORIZONTAL', 3),
      ]),
    ])
    expect(rejilla.filas.map((f) => f.grupo)).toEqual([
      'Pecho',
      'Hombros',
      'Bíceps',
      'Tríceps',
      'Cuádriceps',
      'Glúteos',
      'Aductores',
    ])
  })

  it('deja fuera el trabajo que no suma volumen', () => {
    const rejilla = volumenDeBloque([
      microciclo(1, [ejercicio('PREV/REHAB', 4), ejercicio('ACONDICIONAMIENTO', 4)]),
    ])
    expect(rejilla.filas).toEqual([])
    expect(rejilla.numeros).toEqual([1])
  })

  /** La ondulación es justo lo que una sola columna no deja ver. */
  it('deja leer la ondulación de un grupo a lo largo del bloque', () => {
    const rejilla = volumenDeBloque(
      [5, 9, 7, 11, 6].map((sets, i) => microciclo(i + 1, [ejercicio('SENTADILLA', sets)])),
    )
    expect(rejilla.filas.find((f) => f.grupo === 'Cuádriceps')?.porMicrociclo).toEqual([
      5, 9, 7, 11, 6,
    ])
  })
})
