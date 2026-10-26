import { describe, expect, it } from 'vitest'
import {
  anotar,
  completarComidasViejas,
  desanotar,
  distintas,
  rachaDeRecetas,
  type HuellaDeReceta,
  type RecetaProbada,
} from './recetasProbadas'
import type { RegistroComida } from './types'

const HOY = '2026-08-16'

describe('recetasProbadas', () => {
  it('anota una receta cocinada', () => {
    expect(anotar([], 'r1', HOY)).toEqual([{ recetaId: 'r1', fecha: HOY }])
  })

  /** Cocinar el mismo brownie dos veces el martes sigue siendo un martes. */
  it('la misma receta el mismo día no cuenta dos veces', () => {
    const una = anotar([], 'r1', HOY)
    expect(anotar(una, 'r1', HOY)).toHaveLength(1)
  })

  /**
   * La racha no cuenta dos veces, pero cada comida registrada sí es una
   * cocinada: si se hizo dos veces, la lista las enseña las dos.
   */
  it('guarda cada comida registrada de la misma receta', () => {
    const una = anotar([], 'r1', HOY, 'c1')
    const dos = anotar(una, 'r1', HOY, 'c2')

    expect(dos).toEqual([{ recetaId: 'r1', fecha: HOY, comidas: ['c1', 'c2'] }])
    expect(desanotar(dos, 'r1', HOY, 'c2')).toEqual([
      { recetaId: 'r1', fecha: HOY, comidas: ['c1'] },
    ])
    expect(desanotar(dos, 'r1', HOY, 'c1')).toEqual([
      { recetaId: 'r1', fecha: HOY, comidas: ['c2'] },
    ])
  })

  it('la misma receta otro día sí cuenta', () => {
    const una = anotar([], 'r1', '2026-08-15')
    expect(anotar(una, 'r1', HOY)).toHaveLength(2)
  })

  it('no muta la lista que recibe', () => {
    const original: RecetaProbada[] = [{ recetaId: 'r1', fecha: HOY }]
    anotar(original, 'r2', HOY)
    desanotar(original, 'r1', HOY)
    expect(original).toEqual([{ recetaId: 'r1', fecha: HOY }])
  })

  /**
   * La mitad que suele faltar. Sin desanotar, deshacer devolvería las kcal al
   * día pero dejaría la racha subida: diría que cocinó algo que ya no está
   * registrado en ninguna parte.
   */
  describe('desanotar', () => {
    it('quita la anotación de ese día', () => {
      const una = anotar([], 'r1', HOY)
      expect(desanotar(una, 'r1', HOY)).toEqual([])
    })

    it('no toca la misma receta de otro día', () => {
      const dos = anotar(anotar([], 'r1', '2026-08-15'), 'r1', HOY)
      expect(desanotar(dos, 'r1', HOY)).toEqual([{ recetaId: 'r1', fecha: '2026-08-15' }])
    })

    it('deshacer devuelve la racha a donde estaba', () => {
      const antes: RecetaProbada[] = [{ recetaId: 'r0', fecha: '2026-08-15' }]
      const conNueva = anotar(antes, 'r1', HOY)
      expect(rachaDeRecetas(conNueva, HOY).actual).toBe(2)
      expect(rachaDeRecetas(desanotar(conNueva, 'r1', HOY), HOY).actual).toBe(
        rachaDeRecetas(antes, HOY).actual,
      )
    })
  })

  describe('distintas', () => {
    it('cuenta recetas, no veces', () => {
      const l = anotar(anotar(anotar([], 'r1', '2026-08-14'), 'r1', '2026-08-15'), 'r2', HOY)
      expect(distintas(l)).toBe(2)
    })

    it('sin nada cocinado es cero', () => {
      expect(distintas([])).toBe(0)
    })
  })

  describe('racha', () => {
    it('días seguidos cuentan', () => {
      const l: RecetaProbada[] = [
        { recetaId: 'a', fecha: '2026-08-14' },
        { recetaId: 'b', fecha: '2026-08-15' },
        { recetaId: 'c', fecha: HOY },
      ]
      expect(rachaDeRecetas(l, HOY).actual).toBe(3)
    })

    it('un hueco la corta', () => {
      const l: RecetaProbada[] = [
        { recetaId: 'a', fecha: '2026-08-10' },
        { recetaId: 'c', fecha: HOY },
      ]
      expect(rachaDeRecetas(l, HOY).actual).toBe(1)
    })

    /** Cocinar ayer y todavía no hoy no rompe la racha: el día no ha acabado. */
    it('ayer todavía cuenta', () => {
      expect(rachaDeRecetas([{ recetaId: 'a', fecha: '2026-08-15' }], HOY).actual).toBe(1)
    })

    it('sin nada cocinado no hay racha', () => {
      expect(rachaDeRecetas([], HOY)).toEqual({ actual: 0, record: 0 })
    })
  })
})

/**
 * Las anotaciones de antes de `comidas` no salían en «cocinadas hoy». Bryan
 * decidió el 25-oct pasarlas al formato nuevo reconociendo la comida por su
 * huella; si no aparece, se quedan como estaban.
 */
describe('completarComidasViejas', () => {
  const huella: HuellaDeReceta = {
    comida: 'snack',
    items: [
      { alimentoId: 'avena', gramos: 15 },
      { alimentoId: 'cacao', gramos: 7 },
    ],
  }
  const comida = (id: string, cambios: Partial<RegistroComida> = {}): RegistroComida => ({
    id,
    usuarioId: 'u-valentina',
    momentoIso: `${HOY}T16:05:00`,
    comida: 'snack',
    cocinadoPorEl: true,
    aceiteG: null,
    salG: null,
    confianza: 'estimado',
    items: [
      { alimentoId: 'cacao', gramos: 7, fuePesado: false, estadoAsumido: 'crudo' },
      { alimentoId: 'avena', gramos: 15, fuePesado: false, estadoAsumido: 'crudo' },
    ],
    ...cambios,
  })
  const huellaDe = (id: string) => (id === 'r1' ? huella : null)

  it('le pone a la vieja la comida que encaja con su receta', () => {
    const dia = [comida('c1'), comida('c2', { comida: 'almuerzo' })]
    const nuevas = completarComidasViejas([{ recetaId: 'r1', fecha: HOY }], huellaDe, () => dia)
    expect(nuevas).toEqual([{ recetaId: 'r1', fecha: HOY, comidas: ['c1'] }])
  })

  it('no reconoce una comida con otros gramos, otros ítems o que no cocinó él', () => {
    const dia = [
      comida('c1', { items: [{ alimentoId: 'avena', gramos: 15, fuePesado: false, estadoAsumido: 'crudo' }] }),
      comida('c2', { cocinadoPorEl: false }),
      comida('c3', {
        items: [
          { alimentoId: 'cacao', gramos: 8, fuePesado: false, estadoAsumido: 'crudo' },
          { alimentoId: 'avena', gramos: 15, fuePesado: false, estadoAsumido: 'crudo' },
        ],
      }),
    ]
    const vieja = { recetaId: 'r1', fecha: HOY }
    expect(completarComidasViejas([vieja], huellaDe, () => dia)).toEqual([vieja])
  })

  it('no le quita a otra anotación una comida que ya es suya, ni toca las nuevas', () => {
    const nueva = { recetaId: 'r1', fecha: HOY, comidas: ['c1'] }
    const vieja = { recetaId: 'r1', fecha: '2026-08-15' }
    const nuevas = completarComidasViejas([nueva, vieja], huellaDe, () => [comida('c1')])
    expect(nuevas).toEqual([nueva, vieja])
  })

  it('sin receta conocida deja la anotación como estaba', () => {
    const vieja = { recetaId: 'borrada', fecha: HOY }
    expect(completarComidasViejas([vieja], huellaDe, () => [comida('c1')])).toEqual([vieja])
  })
})
