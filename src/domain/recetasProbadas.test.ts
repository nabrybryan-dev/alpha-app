import { describe, expect, it } from 'vitest'
import { anotar, desanotar, distintas, rachaDeRecetas, type RecetaProbada } from './recetasProbadas'

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
