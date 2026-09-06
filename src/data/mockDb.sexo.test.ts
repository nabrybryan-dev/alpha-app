import { beforeEach, describe, expect, it } from 'vitest'
import { crearMockDb } from './mockDb'

/**
 * `guardarSexo` en el almacén local: pone, quita y no toca nada más.
 *
 * «Quitar» es que la clave NO esté —no que valga `undefined`— para que una
 * ficha a la que se le quitó sea idéntica a una que nunca lo tuvo: es lo que
 * comparan los tests de aislamiento y lo que sube a la nube.
 */
describe('mockDb.perfiles.guardarSexo', () => {
  beforeEach(() => localStorage.clear())

  it('el seed de demo trae el dato: Valentina es mujer, Mateo hombre', () => {
    const db = crearMockDb()
    expect(db.perfiles.byUsuario('u-valentina')?.sexo).toBe('mujer')
    expect(db.perfiles.byUsuario('u-mateo')?.sexo).toBe('hombre')
    expect(db.perfiles.byUsuario('u-sara')?.sexo).toBe('mujer')
  })

  it('pone y cambia', () => {
    const db = crearMockDb()
    db.perfiles.guardarSexo('u-valentina', 'hombre')
    expect(db.perfiles.byUsuario('u-valentina')?.sexo).toBe('hombre')
    db.perfiles.guardarSexo('u-valentina', 'mujer')
    expect(db.perfiles.byUsuario('u-valentina')?.sexo).toBe('mujer')
  })

  it('quita de verdad: la clave desaparece', () => {
    const db = crearMockDb()
    db.perfiles.guardarSexo('u-valentina', undefined)
    const perfil = db.perfiles.byUsuario('u-valentina')!
    expect('sexo' in perfil).toBe(false)
  })

  it('no toca el resto de la ficha ni las fichas de los demás', () => {
    const db = crearMockDb()
    const antes = db.perfiles.byUsuario('u-valentina')!
    const mateoAntes = db.perfiles.byUsuario('u-mateo')!
    db.perfiles.guardarSexo('u-valentina', 'hombre')
    expect({ ...db.perfiles.byUsuario('u-valentina'), sexo: undefined }).toEqual({ ...antes, sexo: undefined })
    expect(db.perfiles.byUsuario('u-mateo')).toEqual(mateoAntes)
  })

  it('sin ficha no escribe nada: no inventa una ficha vacía por un dato suelto', () => {
    const db = crearMockDb()
    db.perfiles.guardarSexo('u-sin-ficha', 'mujer')
    expect(db.perfiles.byUsuario('u-sin-ficha')).toBeUndefined()
  })

  it('sobrevive a recargar el almacén', () => {
    crearMockDb().perfiles.guardarSexo('u-valentina', 'hombre')
    expect(crearMockDb().perfiles.byUsuario('u-valentina')?.sexo).toBe('hombre')
  })
})
