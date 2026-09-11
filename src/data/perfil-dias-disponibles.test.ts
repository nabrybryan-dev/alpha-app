/**
 * `diasDisponibles` en el perfil: cuáles, no cuántos (0065).
 *
 * Dos hechos distintos llevaban semanas compartiendo un nombre —`diasEntrenamiento` es
 * un NÚMERO, cuántos por semana— y de un número no se saca un día sin inventarlo. Esto
 * fija que el campo nuevo se guarda, que se lee de vuelta, que no pisa al número, y que
 * a quien no tiene ficha se le crea con lo mínimo en vez de fabricarle objetivos o edad.
 */
import { describe, expect, it } from 'vitest'
import { crearMockDb } from './mockDb'

describe('los días disponibles del perfil', () => {
  it('se guardan y se leen de vuelta', () => {
    const db = crearMockDb()
    db.perfiles.guardarDiasDisponibles('p-dias-1', ['MARTES', 'VIERNES'])
    expect(db.perfiles.byUsuario('p-dias-1')?.diasDisponibles).toEqual(['MARTES', 'VIERNES'])
  })

  it('no tocan el número de días, que es otro hecho', () => {
    const db = crearMockDb()
    db.perfiles.guardarDiasDisponibles('p-dias-2', ['LUNES'])
    const antes = db.perfiles.byUsuario('p-dias-2')?.diasEntrenamiento
    db.perfiles.guardarDiasDisponibles('p-dias-2', ['LUNES', 'JUEVES', 'SÁBADO'])
    expect(db.perfiles.byUsuario('p-dias-2')?.diasEntrenamiento).toBe(antes)
    expect(db.perfiles.byUsuario('p-dias-2')?.diasDisponibles).toEqual(['LUNES', 'JUEVES', 'SÁBADO'])
  })

  it('sin ficha, nace con lo mínimo: nada de objetivos ni edad inventados', () => {
    const db = crearMockDb()
    expect(db.perfiles.byUsuario('p-dias-3')).toBeUndefined()
    db.perfiles.guardarDiasDisponibles('p-dias-3', ['DOMINGO'])
    const ficha = db.perfiles.byUsuario('p-dias-3')
    expect(ficha?.diasDisponibles).toEqual(['DOMINGO'])
    expect(ficha?.objetivos ?? '').toBe('')
  })

  it('sin decirlo nunca, el campo NO está: eso no es «ningún día»', () => {
    const db = crearMockDb()
    db.perfiles.agregarMedida('p-dias-4', { fecha: '2026-09-10', alturaCm: 170, perimetros: {} })
    expect(db.perfiles.byUsuario('p-dias-4')?.diasDisponibles).toBeUndefined()
  })
})
