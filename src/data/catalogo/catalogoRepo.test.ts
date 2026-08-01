import { describe, expect, it } from 'vitest'
import { catalogoRepo } from './catalogoRepo'

/**
 * Estos tests corren contra el índice REAL que se empaqueta con la app, no
 * contra un montaje. Sirven de doble comprobación: si alguien regenera
 * `alimentos.json` y el script pierde una columna o se come los alimentos de un
 * grupo, aquí se ve. Un buscador que no encuentra el arroz no lo nota ningún
 * test de unidad con datos inventados.
 */

describe('catalogoRepo', () => {
  it('trae el catálogo entero', () => {
    expect(catalogoRepo.total()).toBe(1195)
  })

  it('encuentra el arroz', () => {
    expect(catalogoRepo.buscar('arroz').length).toBeGreaterThan(0)
  })

  it('encuentra el plátano sin escribir la tilde', () => {
    const nombres = catalogoRepo.buscar('platano').map((a) => a.nombre)
    expect(nombres.some((n) => n.toLowerCase().includes('plátano'))).toBe(true)
  })

  it('todos los grupos tienen alimentos', () => {
    for (const grupo of catalogoRepo.grupos()) {
      expect(catalogoRepo.buscar('', { grupo }).length).toBeGreaterThan(0)
    }
  })

  it('porId devuelve el mismo alimento que la búsqueda', () => {
    const [primero] = catalogoRepo.buscar('arroz')
    expect(catalogoRepo.porId(primero.id)?.nombre).toBe(primero.nombre)
  })

  it('un id que no existe devuelve undefined, no revienta', () => {
    expect(catalogoRepo.porId('no-existe')).toBeUndefined()
  })

  it('todos traen las cuatro cifras que se pintan al buscar', () => {
    // `null` es legítimo -significa "no se midió"-, pero la clave tiene que
    // estar: si el script deja de emitirla, la app pinta `undefined`.
    const claves = ['kcal', 'proteina_g', 'carbos_g', 'grasa_g'] as const
    for (const alimento of catalogoRepo.buscar('', {}, 1195)) {
      for (const clave of claves) {
        expect(alimento.por100g).toHaveProperty(clave)
      }
    }
  })

  it('ningún alimento se quedó sin nombre ni sin grupo', () => {
    const rotos = catalogoRepo.buscar('', {}, 1195).filter((a) => !a.nombre || !a.grupo)
    expect(rotos).toEqual([])
  })
})
