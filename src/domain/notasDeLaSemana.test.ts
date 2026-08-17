import { describe, expect, it } from 'vitest'
import { esNotaDeLaSemana, notasDelMicrociclo, separarNotas } from './notasDeLaSemana'
import type { ItemMarcable, Microciclo } from './types'

const bloque = (titulo: string): ItemMarcable => ({ id: titulo, titulo, indicaciones: '' })

describe('esNotaDeLaSemana', () => {
  it('reconoce las notas tal como están escritas hoy', () => {
    // Los seis títulos reales que existen en los microciclos vivos.
    expect(esNotaDeLaSemana(bloque('LEE ESTO: TU M4 Y LOS TRES NÚMEROS QUE CAMBIAN'))).toBe(true)
    expect(esNotaDeLaSemana(bloque('Leer: reglas de la semana 2 del déficit'))).toBe(true)
    expect(esNotaDeLaSemana(bloque('Leer: reglas del Bloque 2'))).toBe(true)
    expect(esNotaDeLaSemana(bloque('Leer: reglas de la semana IMPAR (pesada)'))).toBe(true)
    expect(esNotaDeLaSemana(bloque('📋 LEE ESTO — ARRANCA TU REINGRESO'))).toBe(true)
  })

  it('no confunde un bloque de trabajo con una nota', () => {
    expect(esNotaDeLaSemana(bloque('HIIT 4 estaciones · circuito 40/20'))).toBe(false)
    expect(esNotaDeLaSemana(bloque('35 min escaladora + 10.000 pasos/día'))).toBe(false)
    expect(esNotaDeLaSemana(bloque('Registra tu EVA (dolor 0-10) cada día'))).toBe(false)
  })
})

describe('separarNotas', () => {
  it('las notas salen de la lista de marcables: no son tareas que se tachan', () => {
    const { notas, marcables } = separarNotas([
      bloque('LEE ESTO: arranca tu reingreso'),
      bloque('40 min caminadora zona 2'),
    ])
    expect(notas.map((n) => n.titulo)).toEqual(['LEE ESTO: arranca tu reingreso'])
    expect(marcables.map((m) => m.titulo)).toEqual(['40 min caminadora zona 2'])
  })

  it('sin bloques no revienta', () => {
    expect(separarNotas()).toEqual({ notas: [], marcables: [] })
  })
})

describe('notasDelMicrociclo', () => {
  it('junta las notas de todas las sesiones, no solo la que las lleva', () => {
    const micro = {
      id: 'm1',
      usuarioId: 'u1',
      numero: 20,
      cadenciaDias: 8,
      estado: 'activo',
      fechaInicio: '2026-08-03',
      sesiones: [
        { id: 's1', nombre: 'LEG A', orden: 1, ejercicios: [], bloquesCardio: [bloque('Leer: reglas de la semana')] },
        { id: 's2', nombre: 'PULL', orden: 2, ejercicios: [], preparacion: [] },
        { id: 's3', nombre: 'PUSH', orden: 3, ejercicios: [], bloquesCardio: [bloque('30 min bici')] },
      ],
    } as unknown as Microciclo
    expect(notasDelMicrociclo(micro).map((n) => n.titulo)).toEqual(['Leer: reglas de la semana'])
  })

  it('sin microciclo devuelve lista vacía', () => {
    expect(notasDelMicrociclo(undefined)).toEqual([])
  })
})
