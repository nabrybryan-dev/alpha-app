import { describe, expect, it } from 'vitest'
import { PATRON_POR_ID } from '../../../domain/patrones/catalogo'
import { esqueletoEnFase } from '../../../domain/patrones/escena'
import {
  capaDeMomentos,
  INCERTIDUMBRE_DE_EJEMPLO,
  SUJETO_DE_EJEMPLO,
  type CapaDeMomentos,
} from '../../../domain/sujeto/capaDeMomentos'
import { ALFA_DE_LA_BANDA, mallasDeMomentos } from './dibujarMomentos'

const esq = esqueletoEnFase(PATRON_POR_ID.sentadilla, 0.6)
const ctx = { categoria: 'SENTADILLA', nombre: 'Sentadilla con barra', sujetoDeEjemplo: true }
const capaReal = capaDeMomentos(SUJETO_DE_EJEMPLO, INCERTIDUMBRE_DE_EJEMPLO, ctx, { muestras: 300 })

describe('los momentos articulares, en malla', () => {
  it('la capa del sujeto de ejemplo da una malla sólida y otra translúcida, las dos con vértices', () => {
    const [solida, banda] = mallasDeMomentos(capaReal, esq)
    expect(solida.vertices).toBeGreaterThan(0)
    expect(banda.vertices).toBeGreaterThan(0)
  })

  it('lo calculado es opaco y lo estimado translúcido, y las dos van encima del cuerpo', () => {
    const [solida, banda] = mallasDeMomentos(capaReal, esq)
    expect(solida.alfa).toBe(1)
    expect(banda.alfa).toBe(ALFA_DE_LA_BANDA)
    expect(banda.alfa).toBeLessThan(1)
    expect(solida.encima).toBe(true)
    expect(banda.encima).toBe(true)
  })

  it('una capa vacía (no_afirmable) no sube ni un vértice', () => {
    const vacia: CapaDeMomentos = { elementos: [], lineas: ['Cadera: no se dibuja. carga ausente'] }
    const [solida, banda] = mallasDeMomentos(vacia, esq)
    expect(solida.vertices).toBe(0)
    expect(banda.vertices).toBe(0)
  })

  it('un momento sin banda dibuja el arco sólido y nada translúcido', () => {
    const sinBanda: CapaDeMomentos = { elementos: [{ articulacion: 'rodilla', fraccion: 0.5, banda: null }], lineas: [] }
    const [solida, banda] = mallasDeMomentos(sinBanda, esq)
    expect(solida.vertices).toBeGreaterThan(0)
    expect(banda.vertices).toBe(0)
  })

  it('más articulaciones, más geometría; ninguna articulación aparece si no está en la capa', () => {
    const una: CapaDeMomentos = { elementos: [{ articulacion: 'cadera', fraccion: 0.4, banda: null }], lineas: [] }
    const tres = mallasDeMomentos(capaReal, esq)[0].vertices
    const solo = mallasDeMomentos(una, esq)[0].vertices
    expect(solo).toBeGreaterThan(0)
    expect(tres).toBe(solo * 3)
  })

  it('una fracción de cero no dibuja un arco degenerado', () => {
    const cero: CapaDeMomentos = { elementos: [{ articulacion: 'tobillo', fraccion: 0, banda: null }], lineas: [] }
    expect(mallasDeMomentos(cero, esq)[0].vertices).toBe(0)
  })

  it('los vértices son finitos', () => {
    const [solida, banda] = mallasDeMomentos(capaReal, esq)
    for (const m of [solida, banda]) expect(Number.isFinite(m.vertices)).toBe(true)
  })
})
