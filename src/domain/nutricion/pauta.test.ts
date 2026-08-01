import { describe, expect, it } from 'vitest'
import { esHora, leerPauta } from './pauta'

describe('leerPauta', () => {
  describe('cuando la línea dice el peso', () => {
    it('saca los gramos y el nombre', () => {
      expect(leerPauta('70 g avena')).toEqual([{ linea: '70 g avena', gramos: 70, busqueda: 'avena' }])
    })

    it('trata los mililitros como gramos', () => {
      const [pauta] = leerPauta('200 ml leche semidescremada')
      expect(pauta.gramos).toBe(200)
      expect(pauta.busqueda).toBe('leche semidescremada')
    })

    it('acepta decimales con coma, que es como se escribe en Colombia', () => {
      expect(leerPauta('1,5 g sal')[0].gramos).toBe(1.5)
    })

    it('se traga el "de" cuando lo lleva', () => {
      expect(leerPauta('10 g de mantequilla de maní')[0].busqueda).toBe('mantequilla de maní')
    })

    it('acepta "gr" y "gramos"', () => {
      expect(leerPauta('30 gr almendras')[0].gramos).toBe(30)
      expect(leerPauta('30 gramos almendras')[0].gramos).toBe(30)
    })
  })

  describe('cuando NO se puede saber el peso', () => {
    it('un banano no son gramos: devuelve null', () => {
      // Rellenarlo con 100 o 120 g daría un dato que se ve igual de firme que
      // uno pesado. Es preferible preguntar.
      expect(leerPauta('1 banano')).toEqual([{ linea: '1 banano', gramos: null, busqueda: 'banano' }])
    })

    it('un scoop tampoco', () => {
      const [pauta] = leerPauta('1 scoop proteína')
      expect(pauta.gramos).toBeNull()
      expect(pauta.busqueda).toBe('proteína')
    })

    it('deja el nombre buscable aunque no haya peso', () => {
      expect(leerPauta('3 huevos revueltos')[0].busqueda).toBe('huevos revueltos')
    })
  })

  describe('cuando hay dos alimentos en una línea', () => {
    it('los separa para poder pesarlos aparte', () => {
      const pautas = leerPauta('2 claras + 1 huevo')
      expect(pautas).toHaveLength(2)
      expect(pautas.map((p) => p.busqueda)).toEqual(['claras', 'huevo'])
    })

    it('cada trozo conserva la línea original, para poder enseñarla', () => {
      expect(leerPauta('2 claras + 1 huevo').every((p) => p.linea === '2 claras + 1 huevo')).toBe(
        true,
      )
    })

    it('mezcla pesos y cantidades sin confundirse', () => {
      const pautas = leerPauta('150 g pollo + 1 huevo')
      expect(pautas.map((p) => p.gramos)).toEqual([150, null])
    })
  })

  it('una línea vacía no da ninguna pauta', () => {
    expect(leerPauta('   ')).toEqual([])
  })
})

describe('esHora', () => {
  it('reconoce las horas del menú', () => {
    expect(esHora('13:00')).toBe(true)
    expect(esHora('6:30')).toBe(true)
  })

  it('un alimento no es una hora', () => {
    expect(esHora('70 g avena')).toBe(false)
    expect(esHora('60-90 min antes de entrenar')).toBe(false)
  })
})
