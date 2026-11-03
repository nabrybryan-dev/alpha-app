import { describe, expect, it } from 'vitest'
import {
  contarPorSombrero,
  filtrarPorSombrero,
  NOMBRE_SOMBRERO,
  SOMBREROS,
  type ConSombrero,
  type FiltroSombrero,
} from './sombreros'

/**
 * Los tres sombreros del equipo (maqueta 7, paso 9). La misma persona hace entrenamiento,
 * nutrición y administración el mismo día: no se cambia de modo, se ven juntos y se filtran.
 * Este módulo es el que decide qué cuenta cada chip y qué se esconde al filtrar.
 */

const pendientes: (ConSombrero & { id: string })[] = [
  { sombrero: 'nutricion', id: 'primer-plan' },
  { sombrero: 'nutricion', id: 'renovado' },
  { sombrero: 'entreno', id: 'revision' },
  { sombrero: 'administracion', id: 'tarea' },
]

describe('contarPorSombrero', () => {
  it('cuenta el total y cada sombrero por separado', () => {
    expect(contarPorSombrero(pendientes)).toEqual({
      todo: 4,
      entreno: 1,
      nutricion: 2,
      administracion: 1,
    })
  })

  it('sin pendientes deja los tres sombreros en cero, no en undefined', () => {
    expect(contarPorSombrero([])).toEqual({
      todo: 0,
      entreno: 0,
      nutricion: 0,
      administracion: 0,
    })
  })

  it('no muta la lista que recibe', () => {
    const copia = [...pendientes]
    contarPorSombrero(pendientes)
    expect(pendientes).toEqual(copia)
  })
})

describe('filtrarPorSombrero', () => {
  it('«todo» devuelve todo y no la misma referencia (inmutabilidad)', () => {
    const todos = filtrarPorSombrero(pendientes, 'todo')
    expect(todos).toHaveLength(4)
    expect(todos).not.toBe(pendientes)
  })

  it.each([
    ['entreno', ['revision']],
    ['nutricion', ['primer-plan', 'renovado']],
    ['administracion', ['tarea']],
  ] as [FiltroSombrero, string[]][])('«%s» deja solo lo suyo', (filtro, ids) => {
    const vistos = filtrarPorSombrero(pendientes, filtro).map((p) => (p as ConSombrero & { id: string }).id)
    expect(vistos).toEqual(ids)
  })

  it('un filtro sin pendientes devuelve una lista vacía, no la lista entera', () => {
    expect(filtrarPorSombrero([], 'nutricion')).toEqual([])
  })
})

describe('los nombres de los chips', () => {
  it('son los de la maqueta, en el orden de la barra', () => {
    expect(SOMBREROS.map((s) => NOMBRE_SOMBRERO[s])).toEqual([
      'Todo',
      'Entreno',
      'Nutrición',
      'Administración',
    ])
  })

  it('toda etiqueta del filtro tiene nombre escrito (nada depende del icono)', () => {
    for (const s of SOMBREROS) expect(NOMBRE_SOMBRERO[s]).toBeTruthy()
  })
})
