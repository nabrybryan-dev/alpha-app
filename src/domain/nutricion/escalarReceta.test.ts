import { describe, expect, it } from 'vitest'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import { escalarReceta, type IngredienteDelReel } from './escalarReceta'
import { recetaAlRegistro } from './recetaAlRegistro'
import type { Receta } from '../../data/recetas'

const porId = (id: string) => catalogoRepo.porId(id)

const BROWNIE: IngredienteDelReel[] = [
  { nombre: 'Avena', enElReel: '200 g', alimentoId: 'avena-en-hojuelas-peso-en-seco', gramosTotales: 200, estado: 'seco' },
  { nombre: 'Cacao', enElReel: '40 g', alimentoId: 'cacao-tostado-y-molido', gramosTotales: 40, estado: 'seco' },
  { nombre: 'Mantequilla de maní', enElReel: '60 g', alimentoId: 'mantequilla-de-mani', gramosTotales: 60, estado: 'listo' },
]

describe('escalarReceta', () => {
  it('divide cada cantidad entre las porciones', () => {
    const r = escalarReceta(BROWNIE, 9, porId)
    expect(r.ingredientes.map((i) => i.gramosParaTi)).toEqual([22, 4, 7])
  })

  /** Nadie pesa 4,7 g de cacao: una ficha con decimales finge precisión. */
  it('redondea a gramo entero', () => {
    const r = escalarReceta(BROWNIE, 9, porId)
    expect(r.ingredientes.every((i) => Number.isInteger(i.gramosParaTi))).toBe(true)
    expect(r.ingredientes[0].paraTi).toBe('22 g')
  })

  it('conserva la cantidad del reel para poder enseñar la traducción', () => {
    const r = escalarReceta(BROWNIE, 9, porId)
    expect(r.ingredientes[0].enElReel).toBe('200 g')
  })

  it('calcula los macros de UNA porción, no de la receta entera', () => {
    const una = escalarReceta(BROWNIE, 9, porId)
    const entera = escalarReceta(BROWNIE, 1, porId)
    expect(una.kcal).toBeGreaterThan(0)
    expect(una.kcal).toBeLessThan(entera.kcal / 5)
  })

  /**
   * Es el punto del módulo: la ficha y el registro tienen que dar lo mismo.
   * Si la ficha dijera 180 y el registro sumara 240, el asesorado vería una
   * cifra al abrir y otra al agregar, sin saber cuál es la buena.
   */
  it('las kcal de la ficha son las mismas que luego suma el día', () => {
    const escalada = escalarReceta(BROWNIE, 9, porId)
    const receta = {
      id: 'r', handle: '@x', nombre: 'Brownie', categoria: 'Postre',
      media: { thumbnail: '', duracion: '0:47' },
      social: { views: '—', likes: '—', guardados: '—' },
      ajuste: { porcion: '1', porcionNota: '', kcal: escalada.kcal, prot: escalada.prot, carb: escalada.carb, grasa: escalada.grasa, notas: [] },
      ingredientes: escalada.ingredientes,
    } satisfies Receta

    const plan = recetaAlRegistro(receta, '2026-08-16T17:00:00')
    if (!plan.puede) throw new Error(plan.motivo)

    const sumadas = plan.items.reduce((total, item) => {
      const alimento = porId(item.alimentoId)
      return total + ((alimento?.por100g.kcal ?? 0) * item.gramos) / 100
    }, 0)
    expect(Math.round(sumadas)).toBe(escalada.kcal)
  })

  it('lo que sale de aquí ya es registrable', () => {
    const escalada = escalarReceta(BROWNIE, 9, porId)
    expect(escalada.ingredientes.every((i) => i.alimentoId && i.gramosParaTi !== undefined)).toBe(true)
  })

  describe('ingredientes que no están en el catálogo', () => {
    const conFantasma = [...BROWNIE, { nombre: 'Panela raspada', enElReel: '120 g', alimentoId: 'no-existe', gramosTotales: 120 }]

    /** Sumar cero por lo que falta daría una ficha con pinta de completa. */
    it('los nombra en vez de sumarlos como cero', () => {
      const r = escalarReceta(conFantasma, 9, porId)
      expect(r.sinCatalogo).toEqual(['Panela raspada'])
    })

    it('no los cuenta en los macros', () => {
      expect(escalarReceta(conFantasma, 9, porId).kcal).toBe(escalarReceta(BROWNIE, 9, porId).kcal)
    })

    it('aun así los pinta, para que el asesorado sepa qué lleva', () => {
      expect(escalarReceta(conFantasma, 9, porId).ingredientes).toHaveLength(4)
    })
  })

  describe('porciones inválidas', () => {
    it.each([0, -3, NaN, Infinity])('%s revienta en vez de inventar cantidades', (porciones) => {
      expect(() => escalarReceta(BROWNIE, porciones, porId)).toThrow(/porciones/)
    })
  })

  it('mantiene la marca de sustitución del coach', () => {
    const r = escalarReceta(
      [{ nombre: 'Miel', enElReel: '120 g de panela', alimentoId: 'miel-de-abejas', gramosTotales: 120, cambiado: true }],
      9,
      porId,
    )
    expect(r.ingredientes[0].cambiado).toBe(true)
  })
})

/**
 * Marcar lo estimado es lo que separa «el creador dijo 100 g» de «lo puse yo
 * porque el reel no lo decía». Sin la marca las dos cifras se leen igual de
 * ciertas, y a los tres meses nadie sabe cuál era cuál.
 */
describe('cantidades estimadas', () => {
  const conEstimado: IngredienteDelReel[] = [
    { nombre: 'Mozzarella', enElReel: '100 g', alimentoId: 'queso-fresco-semiduro-semigraso-tipo-mozzarella', gramosTotales: 100 },
    { nombre: 'Jamón', enElReel: 'sin cantidad', alimentoId: 'jamon-tipo-york-precocido', gramosTotales: 40, estimado: true },
  ]

  it('la marca viaja hasta la ficha', () => {
    const r = escalarReceta(conEstimado, 2, porId)
    expect(r.ingredientes[1].estimado).toBe(true)
  })

  it('lo que sí dijo el creador NO se marca', () => {
    const r = escalarReceta(conEstimado, 2, porId)
    expect(r.ingredientes[0].estimado).toBeUndefined()
  })

  /** Estimar la cantidad no la excluye del cálculo: sigue siendo comida. */
  it('lo estimado cuenta en los macros igual que lo demás', () => {
    const con = escalarReceta(conEstimado, 2, porId)
    const sin = escalarReceta([conEstimado[0]], 2, porId)
    expect(con.kcal).toBeGreaterThan(sin.kcal)
  })
})
