import { beforeEach, describe, expect, it } from 'vitest'
import { crearMockDb } from '../mockDb'
import type { Microciclo } from '../../domain/types'
import { leerLoQuePraxisVe } from './fuente'

/**
 * Lo que Praxis lee de la persona con sesión. Sale del almacén local —que ya se hidrató con
 * el JWT de esa persona— y pasa ENTERO por la lista blanca del dominio. Aquí se prueba el
 * cableado: que se piden los datos de quien toca y que la lista blanca está de verdad en
 * medio. Los datos son los del seed ficticio.
 */
const HOY = new Date().toISOString().slice(0, 10)

describe('leerLoQuePraxisVe', () => {
  beforeEach(() => localStorage.clear())

  it('trae el plan activo de la persona del seed', () => {
    const db = crearMockDb()
    const ve = leerLoQuePraxisVe(db, 'u-valentina', HOY)
    const activo = db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')
    expect(activo).toBeDefined()
    expect(ve.activo?.numero).toBe(activo?.numero)
    expect(ve.activo?.sesiones.length).toBe(activo?.sesiones.length)
  })

  it('una propuesta sin aprobar que ya está en el almacén NO llega a Praxis', () => {
    const db = crearMockDb()
    const activo = db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo') as Microciclo
    db.microciclos.guardarPropuesta({ ...structuredClone(activo), id: 'm-propuesta-secreta', numero: activo.numero + 1, estado: 'propuesto' })
    expect(db.microciclos.byUsuario('u-valentina').some((m) => m.estado === 'propuesto')).toBe(true)

    const ve = leerLoQuePraxisVe(db, 'u-valentina', HOY)
    expect(ve.activo?.numero).toBe(activo.numero)
    expect(ve.cerrados.map((m) => m.numero)).not.toContain(activo.numero + 1)
  })

  it('no mezcla personas: quien no tiene plan propio no ve el de otra', () => {
    const db = crearMockDb()
    const ve = leerLoQuePraxisVe(db, 'u-nadie', HOY)
    expect(ve.activo).toBeNull()
    expect(ve.checkins).toEqual([])
    expect(ve.falta).toContain('plan_activo')
  })

  it('no escribe nada: leer deja el almacén como estaba', () => {
    const db = crearMockDb()
    const antes = JSON.stringify([db.microciclos.byUsuario('u-valentina'), db.bienestar.byUsuario('u-valentina')])
    leerLoQuePraxisVe(db, 'u-valentina', HOY)
    expect(JSON.stringify([db.microciclos.byUsuario('u-valentina'), db.bienestar.byUsuario('u-valentina')])).toBe(antes)
  })
})
