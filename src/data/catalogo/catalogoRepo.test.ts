import { describe, expect, it } from 'vitest'
import { catalogoRepo } from './catalogoRepo'
import { resumenDelDia } from '../../domain/nutricion/resumen'
import type { RegistroComida } from '../../domain/types'

/**
 * Estos tests corren contra el índice REAL que se empaqueta con la app, no
 * contra un montaje. Sirven de doble comprobación: si alguien regenera
 * `alimentos.json` y el script pierde una columna o se come los alimentos de un
 * grupo, aquí se ve. Un buscador que no encuentra el arroz no lo nota ningún
 * test de unidad con datos inventados.
 */

describe('catalogoRepo', () => {
  it('trae el catálogo entero', () => {
    expect(catalogoRepo.total()).toBe(1200)
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
    for (const alimento of catalogoRepo.buscar('', {}, 1200)) {
      for (const clave of claves) {
        expect(alimento.por100g).toHaveProperty(clave)
      }
    }
  })

  it('ningún alimento se quedó sin nombre ni sin grupo', () => {
    const rotos = catalogoRepo.buscar('', {}, 1200).filter((a) => !a.nombre || !a.grupo)
    expect(rotos).toEqual([])
  })

  describe('los datos que no se sostienen no salen del catálogo', () => {
    // De punta a punta: contra el índice REAL empaquetado, no contra un
    // montaje. Es lo que prueba que la tabla del Cerebro llegó hasta la app.

    it('la piña india sale sin potasio', () => {
      // El índice trae 2.445 mg/100 g de la TCAC; 150 g le anotaban 3.667 mg al
      // día, más que la ingesta diaria entera.
      expect(catalogoRepo.porId('pina-india-cruda')?.por100g.potasio_mg).toBeNull()
    })

    it('pero conserva sus kcal y su vitamina C', () => {
      const pina = catalogoRepo.porId('pina-india-cruda')
      expect(pina?.por100g.kcal).toBeGreaterThan(0)
      expect(pina?.por100g.vitamina_c_mg).not.toBeNull()
    })

    it('la oca sale sin vitamina C y con lo demás intacto', () => {
      // Su hierro no sirve para comprobar esto: la TCAC nunca lo midió y ya
      // venía nulo de origen. Las kcal sí, y no están cuestionadas.
      const oca = catalogoRepo.porId('oca-o-ibia-sin-cascara-cruda')
      expect(oca?.por100g.vitamina_c_mg).toBeNull()
      expect(oca?.por100g.kcal).toBeGreaterThan(0)
    })

    it('el arroz no pierde nada', () => {
      const arroz = catalogoRepo.porId('arroz-blanco-pulido-cocido-sin-sal')
      expect(arroz?.por100g.kcal).toBeGreaterThan(0)
      expect(arroz?.por100g.potasio_mg).not.toBeNull()
    })

    it('EL DÍA QUEDA PARCIAL EN POTASIO, no con una cifra falsa', () => {
      // Lo que de verdad importa, y lo que ve el asesorado: registrar una tajada
      // de piña india ya no le anota 3.667 mg de potasio. El día se declara
      // incompleto en ese nutriente, que es el "≥" del panel de micros.
      const comida: RegistroComida = {
        id: 'c-1',
        usuarioId: 'u-1',
        momentoIso: '2026-08-04T13:00',
        comida: 'almuerzo',
        cocinadoPorEl: true,
        aceiteG: null,
        salG: null,
        confianza: 'pesado',
        items: [
          {
            id: 'it-1',
            alimentoId: 'pina-india-cruda',
            gramos: 150,
            fuePesado: true,
            estadoAsumido: 'crudo',
          },
        ],
      }

      const total = resumenDelDia([comida], (id) => catalogoRepo.porId(id))
      expect(total.porDia.potasio_mg).toBeUndefined()
      expect(total.parciales.has('potasio_mg')).toBe(true)
      // Y las kcal de esa misma tajada sí se cuentan.
      expect(total.porDia.kcal).toBeGreaterThan(0)
    })
  })
})
