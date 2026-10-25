import { describe, expect, it } from 'vitest'
import { Malla } from '../../../domain/patrones/malla'
import { nombreDeParte } from '../visor/cargaDelAtlas'
import { mallasDelCuerpo, type AlmacenDeCapas } from './cuerpoEnEscena'
import type { Paleta } from './pintura'
import { tinteDelCuerpo } from './tinte'

const PALETA: Paleta = { base: [0.2, 0.2, 0.2], luz: [1, 1, 1], rojo: [1, 0, 0], tendon: [0.9, 0.9, 0.9] }

function malla(): Malla {
  const m = new Malla()
  for (const [x, y] of [[0, 0], [1, 0], [0, 1]]) m.verticeSuelto(x, y, 0, 0, 0, 1, [0.5, 0.2, 0.2], 0)
  m.triangulo(0, 1, 2)
  return m
}

function almacen(conTodo = true): { a: AlmacenDeCapas; piel: Malla; hueso: Malla; musculo: Malla } {
  const piel = malla()
  const hueso = malla()
  const musculo = malla()
  const mapa = new Map<string, Malla[]>(conTodo ? [['piel', [piel]], ['esqueleto', [hueso]], ['musculos', [musculo]]] : [])
  return { a: { get: (c) => mapa.get(c) }, piel, hueso, musculo }
}
const tinte = tinteDelCuerpo({ dors: 2 }, [])

describe('que mallas se suben en cada capa del cuerpo', () => {
  it('Musculo: solo los musculos (copias, opacos)', () => {
    const { a, musculo } = almacen()
    const r = mallasDelCuerpo(a, 'musculo', tinte, PALETA)
    expect(r.mallas).toHaveLength(1)
    expect(r.mallas[0]).not.toBe(musculo)
    expect(r.mallas[0].alfa).toBe(1)
  })

  it('Hueso: el esqueleto (copia, de pie) y los musculos translucidos', () => {
    const { a, hueso } = almacen()
    const r = mallasDelCuerpo(a, 'hueso', tinte, PALETA)
    expect(r.mallas).not.toContain(hueso)
    expect(r.mallas.filter((m) => m.alfa === 1)).toHaveLength(1)
    expect(r.mallas.filter((m) => m.alfa === 0.3)).toHaveLength(1)
    expect(r.mallas).toHaveLength(2)
  })

  it('Piel: la piel translucida (para que el dolor se vea debajo) y los musculos', () => {
    const { a, piel } = almacen()
    const r = mallasDelCuerpo(a, 'piel', tinte, PALETA)
    expect(r.mallas).toHaveLength(2)
    const pielEnEscena = r.mallas.find((m) => m.alfa < 1 && m.alfa > 0.3)
    expect(pielEnEscena, 'la piel no es translucida').toBeDefined()
    expect(pielEnEscena).not.toBe(piel)
    expect(piel.alfa).toBe(1)
  })

  it('lo que aun no llego no se inventa: sin piezas, lista vacia', () => {
    const { a } = almacen(false)
    expect(mallasDelCuerpo(a, 'musculo', tinte, PALETA).mallas).toEqual([])
  })

  it('el nombre de cada musculo viaja a la copia para poder tenerla por region', () => {
    const { a, musculo } = almacen()
    expect(nombreDeParte(musculo)).toBeUndefined()
    const r = mallasDelCuerpo(a, 'musculo', tinte, PALETA)
    expect(r.mallas).toHaveLength(1)
  })

  it('la misma pieza no se clona dos veces: el segundo pedido reutiliza las copias', () => {
    const { a } = almacen()
    const uno = mallasDelCuerpo(a, 'musculo', tinte, PALETA).mallas[0]
    const dos = mallasDelCuerpo(a, 'musculo', tinteDelCuerpo({ dors: 1 }, []), PALETA).mallas[0]
    expect(dos).toBe(uno)
  })

  it('la firma cambia con la capa, el tinte y lo que ha llegado', () => {
    const { a } = almacen()
    const f = (c: 'piel' | 'musculo' | 'hueso', t = tinte) => mallasDelCuerpo(a, c, t, PALETA).firma
    expect(f('musculo')).toBe(f('musculo'))
    expect(f('hueso')).not.toBe(f('musculo'))
    expect(f('musculo', tinteDelCuerpo({ dors: 2 }, ['dors']))).not.toBe(f('musculo'))
    expect(mallasDelCuerpo(almacen(false).a, 'musculo', tinte, PALETA).firma).not.toBe(f('musculo'))
  })
})
