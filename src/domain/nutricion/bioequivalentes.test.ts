import { describe, expect, it } from 'vitest'

import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import type { AlimentoIndice } from './busqueda'
import {
  anclaDe,
  cambiosPara,
  porQueNoHayCambios,
  porcionDeReferencia,
} from './bioequivalentes'

const porId = (id: string) => catalogoRepo.porId(id)
const buscar = (id: string) => {
  const alimento = porId(id)
  if (!alimento) throw new Error(`el índice no trae ${id}`)
  return alimento
}

const ARROZ = 'arroz-blanco-cocido'

describe('las anclas que decidió Manuela', () => {
  it('los lácteos se cambian por proteína y las verduras por fibra', () => {
    // 2026-08-09. Hasta ese día los dos grupos salían vacíos a propósito.
    expect(anclaDe({ grupo: 'lacteos' })).toBe('proteina_g')
    expect(anclaDe({ grupo: 'vegetales' })).toBe('fibra_g')
  })

  it('el grupo «otro» sigue sin ancla, y eso se puede explicar', () => {
    expect(anclaDe({ grupo: 'otro' })).toBeNull()
  })
})

describe('los cambios de un alimento', () => {
  it('propone cantidades, no solo nombres', () => {
    const cambios = cambiosPara(buscar(ARROZ), porId)
    expect(cambios.length).toBeGreaterThan(0)
    for (const cambio of cambios) {
      expect(cambio.gramos).toBeGreaterThan(0)
      expect(cambio.alimento.nombre).toBeTruthy()
    }
  })

  it('nunca más de cinco, que es lo que cabe leer', () => {
    expect(cambiosPara(buscar(ARROZ), porId).length).toBeLessThanOrEqual(5)
  })

  it('LA DERIVA SE DICE: cada propuesta trae lo que mueve', () => {
    // Igualar el ancla no iguala el plato. Si esto se vacía, la pantalla
    // estaría prometiendo un cambio gratis que no lo es.
    const [primero] = cambiosPara(buscar(ARROZ), porId)
    expect(Object.keys(primero.deriva).length).toBeGreaterThan(0)
    expect(primero.deriva).toHaveProperty('kcal')
  })

  it('el ancla queda igualada: el carbohidrato del arroz casi no se mueve', () => {
    // Es la prueba de que los gramos salen de igualar el ancla y no de otra
    // cosa. «Casi» por el redondeo de los gramos a entero.
    for (const cambio of cambiosPara(buscar(ARROZ), porId)) {
      expect(Math.abs(cambio.deriva.carbos_g ?? 0)).toBeLessThan(1)
    }
  })

  it('la porción de referencia es la curada, no una inventada', () => {
    expect(porcionDeReferencia(ARROZ)).toBeGreaterThan(0)
    expect(porcionDeReferencia('no-existe')).toBeNull()
  })
})

describe('la tabla no sabe de quién es, y por eso se filtra al leerla', () => {
  it('lo que ella no puede comer NO se le propone', () => {
    // El peor fallo posible de esta pantalla: proponerle leche a una alérgica
    // porque el archivo venía así.
    const todos = cambiosPara(buscar(ARROZ), porId)
    const vetado = todos[0].alimento.id
    const filtrados = cambiosPara(buscar(ARROZ), porId, new Set([vetado]))
    expect(filtrados.map((c) => c.alimento.id)).not.toContain(vetado)
  })

  it('y al filtrar sigue habiendo cinco, porque se exportan diez', () => {
    // El margen no es de adorno: sin él, quien tiene una alergia vería menos
    // propuestas que las demás justo por tenerla.
    const todos = cambiosPara(buscar(ARROZ), porId)
    if (todos.length < 5) return
    const dosFuera = new Set(todos.slice(0, 2).map((c) => c.alimento.id))
    expect(cambiosPara(buscar(ARROZ), porId, dosFuera)).toHaveLength(5)
  })
})

describe('vacío no es «no hay nada parecido»', () => {
  it('el grupo sin ancla lo dice, no se queda callado', () => {
    const sinAncla = { id: 'x', grupo: 'otro' } as AlimentoIndice
    expect(cambiosPara(sinAncla, porId)).toEqual([])
    expect(porQueNoHayCambios(sinAncla).motivo).toBe('sin_ancla')
  })

  it('un alimento con ancla y sin porción curada es un hueco que se llena', () => {
    const conAncla = { id: 'no-esta-en-la-tabla', grupo: 'frutas' } as AlimentoIndice
    expect(porQueNoHayCambios(conAncla).motivo).toBe('sin_porcion')
  })
})

describe('la tabla y el índice hablan del mismo catálogo', () => {
  it('toda propuesta existe en el índice de la app', () => {
    // Si alguien exporta la tabla y no regenera el índice, esto lo caza. La
    // app se lo saltaría en silencio, que es lo correcto en pantalla y lo que
    // no se quiere descubrir en producción.
    // `buscar` revienta si el id no está, a propósito: un test que se salta lo
    // que no encuentra pasa siempre y no protege nada.
    for (const id of [ARROZ, 'yogur-natural-entero', 'brocoli-crudo']) {
      for (const cambio of cambiosPara(buscar(id), porId)) {
        expect(porId(cambio.alimento.id)).toBeTruthy()
      }
    }
  })

  it('los dos grupos que desbloqueó Manuela ya proponen algo', () => {
    expect(cambiosPara(buscar('yogur-natural-entero'), porId).length).toBeGreaterThan(0)
    expect(cambiosPara(buscar('brocoli-crudo'), porId).length).toBeGreaterThan(0)
  })
})
