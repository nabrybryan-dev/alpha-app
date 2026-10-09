import { beforeEach, describe, expect, it } from 'vitest'
import { crearMockDb } from './mockDb'

/**
 * `guardarVistaSimple` en el almacén local: pone, quita y no toca nada más.
 *
 * Mismo criterio que `guardarSexo`: «apagada» es que la clave NO esté —no que
 * valga `false`— para que una ficha a la que se la quitaron sea idéntica a una
 * que nunca la tuvo.
 */
describe('mockDb.perfiles.guardarVistaSimple', () => {
  beforeEach(() => localStorage.clear())

  it('el seed de demo no la trae: nadie empieza en vista simple', () => {
    const db = crearMockDb()
    expect(db.perfiles.byUsuario('u-valentina')?.vistaSimple).toBeUndefined()
  })

  it('la prende', () => {
    const db = crearMockDb()
    db.perfiles.guardarVistaSimple('u-valentina', true)
    expect(db.perfiles.byUsuario('u-valentina')?.vistaSimple).toBe(true)
  })

  it('la apaga de verdad: la clave desaparece', () => {
    const db = crearMockDb()
    db.perfiles.guardarVistaSimple('u-valentina', true)
    db.perfiles.guardarVistaSimple('u-valentina', undefined)
    const perfil = db.perfiles.byUsuario('u-valentina')!
    expect('vistaSimple' in perfil).toBe(false)
  })

  it('no toca el resto de la ficha ni las fichas de los demás', () => {
    const db = crearMockDb()
    const antes = db.perfiles.byUsuario('u-valentina')!
    const mateoAntes = db.perfiles.byUsuario('u-mateo')!
    db.perfiles.guardarVistaSimple('u-valentina', true)
    expect({ ...db.perfiles.byUsuario('u-valentina'), vistaSimple: undefined }).toEqual({
      ...antes,
      vistaSimple: undefined,
    })
    expect(db.perfiles.byUsuario('u-mateo')).toEqual(mateoAntes)
  })

  it('sin ficha, la estrena con lo mínimo (0107)', () => {
    const db = crearMockDb()
    db.perfiles.guardarVistaSimple('u-sin-ficha', true)
    const ficha = db.perfiles.byUsuario('u-sin-ficha')
    expect(ficha?.vistaSimple).toBe(true)
    expect(ficha?.objetivos).toBe('')
  })

  it('sobrevive a recargar el almacén', () => {
    crearMockDb().perfiles.guardarVistaSimple('u-valentina', true)
    expect(crearMockDb().perfiles.byUsuario('u-valentina')?.vistaSimple).toBe(true)
  })
})
