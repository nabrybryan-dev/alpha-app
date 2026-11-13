import { describe, expect, it } from 'vitest'
import { aplicarOrganizacion, SIN_ORGANIZACION } from './aplicarOrganizacion'

const lista = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

describe('aplicar la organización guardada a una pantalla', () => {
  it('sin organización, el orden de fábrica', () => {
    expect(ids(aplicarOrganizacion(lista, SIN_ORGANIZACION))).toEqual(['a', 'b', 'c', 'd'])
  })
  it('esconde lo escondido', () => {
    expect(ids(aplicarOrganizacion(lista, { ocultas: new Set(['b']), movidas: {} }))).toEqual(['a', 'c', 'd'])
  })
  it('subir uno salta un vecino; bajar dos salta dos', () => {
    expect(ids(aplicarOrganizacion(lista, { ocultas: new Set(), movidas: { c: -1 } }))).toEqual(['a', 'c', 'b', 'd'])
    expect(ids(aplicarOrganizacion(lista, { ocultas: new Set(), movidas: { a: 2 } }))).toEqual(['b', 'c', 'a', 'd'])
  })
  it('mover más allá del borde se queda en el borde', () => {
    expect(ids(aplicarOrganizacion(lista, { ocultas: new Set(), movidas: { b: -20 } }))).toEqual(['b', 'a', 'c', 'd'])
    expect(ids(aplicarOrganizacion(lista, { ocultas: new Set(), movidas: { b: 20 } }))).toEqual(['a', 'c', 'd', 'b'])
  })
  it('lo de otra pantalla no influye', () => {
    expect(ids(aplicarOrganizacion(lista, { ocultas: new Set(['z']), movidas: { z: -3 } }))).toEqual(['a', 'b', 'c', 'd'])
  })
})
