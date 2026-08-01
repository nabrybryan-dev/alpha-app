import { beforeEach, describe, expect, it } from 'vitest'
import { crearMockDb } from './mockDb'
import type { RegistroComida } from '../domain/types'

/**
 * Tests del repositorio de registro de comidas.
 *
 * El bloque de aislamiento no es rutina: que un asesorado no vea ni toque lo de
 * otro es la propiedad más importante de la app y ya se rompió dos veces. Por
 * eso se comprueba en las cinco operaciones que reciben un `usuarioId`, y no
 * solo en la lectura, que es donde el fallo se vería antes.
 */

const VALENTINA = 'u-valentina'
const MATEO = 'u-mateo'

const almuerzo = (usuarioId: string, momentoIso: string): Omit<RegistroComida, 'id' | 'items'> => ({
  usuarioId,
  momentoIso,
  comida: 'almuerzo',
  cocinadoPorEl: true,
  aceiteG: 14,
  salG: 1.2,
  confianza: 'pesado',
})

describe('registroComidas', () => {
  beforeEach(() => localStorage.clear())

  it('devuelve las comidas del día ordenadas por hora', () => {
    const db = crearMockDb()
    db.registroComidas.abrirComida(almuerzo(VALENTINA, '2026-07-31T13:00:00'))
    db.registroComidas.abrirComida({
      ...almuerzo(VALENTINA, '2026-07-31T08:00:00'),
      comida: 'desayuno',
    })

    const dia = db.registroComidas.delDia(VALENTINA, '2026-07-31')

    expect(dia.map((c) => c.comida)).toEqual(['desayuno', 'almuerzo'])
  })

  it('no mezcla días distintos', () => {
    const db = crearMockDb()
    db.registroComidas.abrirComida(almuerzo(VALENTINA, '2026-07-31T13:00:00'))
    db.registroComidas.abrirComida(almuerzo(VALENTINA, '2026-08-01T13:00:00'))

    expect(db.registroComidas.delDia(VALENTINA, '2026-07-31')).toHaveLength(1)
  })

  it('una comida nace sin ítems y se le van añadiendo', () => {
    const db = crearMockDb()
    const id = db.registroComidas.abrirComida(almuerzo(VALENTINA, '2026-07-31T13:00:00'))

    expect(db.registroComidas.delDia(VALENTINA, '2026-07-31')[0].items).toEqual([])

    db.registroComidas.agregarItem(VALENTINA, id, {
      alimentoId: 'tcac-A001',
      gramos: 150,
      fuePesado: true,
      estadoAsumido: 'cocido',
    })

    const items = db.registroComidas.delDia(VALENTINA, '2026-07-31')[0].items
    expect(items).toHaveLength(1)
    expect(items[0].gramos).toBe(150)
    expect(items[0].id).toBeTruthy()
  })

  it('quita un ítem sin tocar los demás', () => {
    const db = crearMockDb()
    const id = db.registroComidas.abrirComida(almuerzo(VALENTINA, '2026-07-31T13:00:00'))
    for (const alimentoId of ['tcac-A001', 'tcac-B002']) {
      db.registroComidas.agregarItem(VALENTINA, id, {
        alimentoId,
        gramos: 100,
        fuePesado: false,
        estadoAsumido: 'cocido',
      })
    }
    const [primero] = db.registroComidas.delDia(VALENTINA, '2026-07-31')[0].items

    db.registroComidas.quitarItem(VALENTINA, id, primero.id)

    const quedan = db.registroComidas.delDia(VALENTINA, '2026-07-31')[0].items
    expect(quedan.map((i) => i.alimentoId)).toEqual(['tcac-B002'])
  })

  it('persiste entre instancias', () => {
    const primera = crearMockDb()
    primera.registroComidas.abrirComida(almuerzo(VALENTINA, '2026-07-31T13:00:00'))

    expect(crearMockDb().registroComidas.delDia(VALENTINA, '2026-07-31')).toHaveLength(1)
  })

  describe('editarComida', () => {
    it('cambia solo lo que se le pasa', () => {
      const db = crearMockDb()
      const id = db.registroComidas.abrirComida(almuerzo(VALENTINA, '2026-07-31T13:00:00'))

      db.registroComidas.editarComida(VALENTINA, id, { confianza: 'estimado' })

      const comida = db.registroComidas.delDia(VALENTINA, '2026-07-31')[0]
      expect(comida.confianza).toBe('estimado')
      expect(comida.aceiteG).toBe(14)
    })

    it('una clave sin definir NO borra lo que ya estaba', () => {
      // El fallo que evita: `{ ...comida, ...cambios }` a secas escribe
      // `undefined` encima del aceite que el asesorado ya había registrado.
      const db = crearMockDb()
      const id = db.registroComidas.abrirComida(almuerzo(VALENTINA, '2026-07-31T13:00:00'))

      db.registroComidas.editarComida(VALENTINA, id, { aceiteG: undefined, salG: 2 })

      const comida = db.registroComidas.delDia(VALENTINA, '2026-07-31')[0]
      expect(comida.aceiteG).toBe(14)
      expect(comida.salG).toBe(2)
    })

    it('un null SÍ se guarda: significa "no se preguntó", que es un dato', () => {
      const db = crearMockDb()
      const id = db.registroComidas.abrirComida(almuerzo(VALENTINA, '2026-07-31T13:00:00'))

      db.registroComidas.editarComida(VALENTINA, id, { cocinadoPorEl: false, aceiteG: null })

      expect(db.registroComidas.delDia(VALENTINA, '2026-07-31')[0].aceiteG).toBeNull()
    })
  })

  describe('preferencia de estado', () => {
    it('no hay preferencia hasta que se le pregunta', () => {
      const db = crearMockDb()
      expect(db.registroComidas.preferencia(VALENTINA, 'arroz')).toBeUndefined()
    })

    it('se recuerda y se puede cambiar de opinión', () => {
      const db = crearMockDb()
      db.registroComidas.recordarPreferencia({
        usuarioId: VALENTINA,
        familia: 'arroz',
        estado: 'cocido',
      })
      db.registroComidas.recordarPreferencia({
        usuarioId: VALENTINA,
        familia: 'arroz',
        estado: 'crudo',
      })

      expect(db.registroComidas.preferencia(VALENTINA, 'arroz')?.estado).toBe('crudo')
    })
  })

  describe('aislamiento entre asesorados', () => {
    it('delDia no devuelve las comidas de otro', () => {
      const db = crearMockDb()
      db.registroComidas.abrirComida(almuerzo(MATEO, '2026-07-31T13:00:00'))

      expect(db.registroComidas.delDia(VALENTINA, '2026-07-31')).toEqual([])
    })

    it('no se puede editar la comida de otro conociendo su id', () => {
      const db = crearMockDb()
      const id = db.registroComidas.abrirComida(almuerzo(MATEO, '2026-07-31T13:00:00'))

      db.registroComidas.editarComida(VALENTINA, id, { confianza: 'ajeno' })

      expect(db.registroComidas.delDia(MATEO, '2026-07-31')[0].confianza).toBe('pesado')
    })

    it('no se puede añadir un ítem a la comida de otro', () => {
      const db = crearMockDb()
      const id = db.registroComidas.abrirComida(almuerzo(MATEO, '2026-07-31T13:00:00'))

      db.registroComidas.agregarItem(VALENTINA, id, {
        alimentoId: 'tcac-A001',
        gramos: 150,
        fuePesado: true,
        estadoAsumido: 'cocido',
      })

      expect(db.registroComidas.delDia(MATEO, '2026-07-31')[0].items).toEqual([])
    })

    it('no se puede quitar un ítem de la comida de otro', () => {
      const db = crearMockDb()
      const id = db.registroComidas.abrirComida(almuerzo(MATEO, '2026-07-31T13:00:00'))
      db.registroComidas.agregarItem(MATEO, id, {
        alimentoId: 'tcac-A001',
        gramos: 150,
        fuePesado: true,
        estadoAsumido: 'cocido',
      })
      const [item] = db.registroComidas.delDia(MATEO, '2026-07-31')[0].items

      db.registroComidas.quitarItem(VALENTINA, id, item.id)

      expect(db.registroComidas.delDia(MATEO, '2026-07-31')[0].items).toHaveLength(1)
    })

    it('no se puede borrar la comida de otro', () => {
      const db = crearMockDb()
      const id = db.registroComidas.abrirComida(almuerzo(MATEO, '2026-07-31T13:00:00'))

      db.registroComidas.borrarComida(VALENTINA, id)

      expect(db.registroComidas.delDia(MATEO, '2026-07-31')).toHaveLength(1)
    })

    it('la preferencia de uno no la ve el otro', () => {
      const db = crearMockDb()
      db.registroComidas.recordarPreferencia({
        usuarioId: MATEO,
        familia: 'arroz',
        estado: 'crudo',
      })

      expect(db.registroComidas.preferencia(VALENTINA, 'arroz')).toBeUndefined()
    })
  })
})
