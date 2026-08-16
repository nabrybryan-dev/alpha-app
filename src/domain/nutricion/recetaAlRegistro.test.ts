import { describe, expect, it } from 'vitest'
import type { Receta } from '../../data/recetas'
import { recetaAlRegistro } from './recetaAlRegistro'

function receta(parcial: Partial<Receta> = {}): Receta {
  return {
    id: 'r1',
    handle: '@ejemplo.cocina',
    nombre: 'Brownie de avena',
    categoria: 'Postre',
    media: { thumbnail: 'x', duracion: '0:47' },
    social: { views: '—', likes: '—', guardados: '—' },
    ajuste: {
      porcion: '1 porción de 60 g',
      porcionNota: 'de las 9 del molde',
      kcal: 180, prot: 7, carb: 24, grasa: 6,
      notas: [],
    },
    ingredientes: [
      { nombre: 'Avena', enElReel: '200 g', paraTi: '22 g', alimentoId: 'avena-en-hojuelas-peso-en-seco', gramosParaTi: 22, estado: 'seco' },
      { nombre: 'Clara', enElReel: '3 unidades', paraTi: '33 g', alimentoId: 'clara-de-huevo-cruda', gramosParaTi: 33 },
    ],
    ...parcial,
  }
}

const CUANDO = '2026-08-16T17:30:00.000Z'

describe('recetaAlRegistro', () => {
  it('convierte cada ingrediente en un ítem con su alimento y sus gramos', () => {
    const r = recetaAlRegistro(receta(), CUANDO)
    expect(r.puede).toBe(true)
    if (!r.puede) return
    expect(r.items).toEqual([
      { alimentoId: 'avena-en-hojuelas-peso-en-seco', gramos: 22, fuePesado: false, estadoAsumido: 'seco' },
      { alimentoId: 'clara-de-huevo-cruda', gramos: 33, fuePesado: false, estadoAsumido: 'crudo' },
    ])
  })

  /**
   * Se registran los INGREDIENTES, no un bloque con las kcal de la ficha.
   *
   * Es lo que hace que el total del día cuadre: `resumenDelDia` deriva los
   * macros del catálogo por `alimentoId`, así que un ítem sin correspondencia
   * se salta y la receta no movería ni una kcal. Además, el día que se corrija
   * un valor del catálogo, esta comida se corrige sola.
   */
  it('los ítems apuntan al catálogo, que es de donde salen los macros', () => {
    const r = recetaAlRegistro(receta(), CUANDO)
    if (!r.puede) throw new Error('debería poder')
    expect(r.items.every((i) => i.alimentoId.length > 0)).toBe(true)
  })

  it('la porción del reel no entra: entra la que le toca a esta persona', () => {
    const r = recetaAlRegistro(receta(), CUANDO)
    if (!r.puede) throw new Error('debería poder')
    // «200 g» es lo del reel; 22 es lo suyo.
    expect(r.items[0].gramos).toBe(22)
  })

  it('nada se marca como pesado: una receta se sirve, no se pesa', () => {
    const r = recetaAlRegistro(receta(), CUANDO)
    if (!r.puede) throw new Error('debería poder')
    expect(r.items.every((i) => i.fuePesado === false)).toBe(true)
    expect(r.comida.confianza).toBe('estimado')
  })

  describe('a qué comida del día va', () => {
    it.each([
      ['Desayuno', 'desayuno'],
      ['Almuerzo', 'almuerzo'],
      ['Cena', 'cena'],
      ['Snack', 'snack'],
      ['Postre', 'snack'],
    ] as const)('%s va a %s', (categoria, esperado) => {
      const r = recetaAlRegistro(receta({ categoria }), CUANDO)
      if (!r.puede) throw new Error('debería poder')
      expect(r.comida.comida).toBe(esperado)
    })
  })

  it('conserva la hora en que se agregó, que es la que ordena el día', () => {
    const r = recetaAlRegistro(receta(), CUANDO)
    if (!r.puede) throw new Error('debería poder')
    expect(r.comida.momentoIso).toBe(CUANDO)
  })

  /**
   * No se pregunta por aceite ni sal: quien sigue una receta ajena no sabe
   * cuánto llevaba. `null` es «no se preguntó», que no es cero.
   */
  it('deja aceite y sal sin preguntar, no en cero', () => {
    const r = recetaAlRegistro(receta(), CUANDO)
    if (!r.puede) throw new Error('debería poder')
    expect(r.comida.aceiteG).toBeNull()
    expect(r.comida.salG).toBeNull()
  })

  describe('cuando no se puede registrar', () => {
    /**
     * Registrar solo los ingredientes mapeados dejaría el día CORTO sin avisar:
     * el brownie sumaría la avena y no el maní. Un total que se queda corto en
     * silencio es peor que un botón que dice que no puede.
     */
    it('si un ingrediente no está mapeado, no registra media receta', () => {
      const r = recetaAlRegistro(
        receta({
          ingredientes: [
            { nombre: 'Avena', enElReel: '200 g', paraTi: '22 g', alimentoId: 'avena-en-hojuelas-peso-en-seco', gramosParaTi: 22 },
            { nombre: 'Panela', enElReel: '120 g', paraTi: '6 g' },
          ],
        }),
        CUANDO,
      )
      expect(r.puede).toBe(false)
      if (r.puede) return
      expect(r.motivo).toContain('Panela')
    })

    it('sin lista de ingredientes tampoco inventa', () => {
      const r = recetaAlRegistro(receta({ ingredientes: undefined }), CUANDO)
      expect(r.puede).toBe(false)
    })

    it('un ingrediente con alimento pero sin gramos no cuela', () => {
      const r = recetaAlRegistro(
        receta({
          ingredientes: [{ nombre: 'Avena', enElReel: '200 g', paraTi: 'al gusto', alimentoId: 'avena-en-hojuelas-peso-en-seco' }],
        }),
        CUANDO,
      )
      expect(r.puede).toBe(false)
      if (r.puede) return
      expect(r.motivo).toContain('Avena')
    })

    it('nombra TODOS los que faltan, no solo el primero', () => {
      const r = recetaAlRegistro(
        receta({
          ingredientes: [
            { nombre: 'Panela', enElReel: '120 g', paraTi: '6 g' },
            { nombre: 'Cacao', enElReel: '40 g', paraTi: '4 g' },
          ],
        }),
        CUANDO,
      )
      if (r.puede) throw new Error('no debería poder')
      expect(r.motivo).toContain('Panela')
      expect(r.motivo).toContain('Cacao')
    })
  })
})
