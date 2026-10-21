// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { comprobarQueLaCapaAporto, mallasDelPeorCaso } from './medir-fotograma-guarda.mjs'
import { capaDeMomentos, INCERTIDUMBRE_DE_EJEMPLO, SUJETO_DE_EJEMPLO } from '../src/domain/sujeto/capaDeMomentos'
import { enLaPoseDelCalculo, mallasDeMomentos, poseDelEsqueleto } from '../src/features/entrenar/escena/dibujarMomentos'
import { PATRON_POR_ID } from '../src/domain/patrones/catalogo'
import { esqueletoEnFase } from '../src/domain/patrones/escena'

const capa = capaDeMomentos(
  SUJETO_DE_EJEMPLO,
  INCERTIDUMBRE_DE_EJEMPLO,
  { categoria: 'SENTADILLA', nombre: 'Sentadilla con barra', sujetoDeEjemplo: true },
  { muestras: 100 },
)
const vertices = (mallas) => mallas.reduce((s, m) => s + m.vertices, 0)
const patron = PATRON_POR_ID.sentadilla

describe('la guarda de la medida cuenta la tanda entera', () => {
  it('con la capa encendida y cero vertices en toda la tanda, falla', () => {
    expect(() => comprobarQueLaCapaAporto(true, 0)).toThrow(/no aporto ni un vertice/)
  })
  it('un solo fotograma con vertices en la tanda basta, aunque el ultimo no tenga', () => {
    // Antes de C-3 la guarda miraba solo el ultimo fotograma: este caso (912 en la tanda) debe pasar.
    expect(() => comprobarQueLaCapaAporto(true, 912)).not.toThrow()
  })
  it('con la capa apagada no exige nada', () => {
    expect(() => comprobarQueLaCapaAporto(false, 0)).not.toThrow()
  })
  it('un conteo no numerico tambien falla', () => {
    expect(() => comprobarQueLaCapaAporto(true, NaN)).toThrow()
  })
})

describe('la medida del peor caso', () => {
  const de = (esq) => mallasDelPeorCaso(capa, mallasDeMomentos, poseDelEsqueleto, esq)

  it('el salon real NO dibuja de pie, y el peor caso SI: por eso el medidor viejo fallaba', () => {
    const dePie = esqueletoEnFase(patron, 1)
    expect(enLaPoseDelCalculo(dePie, capa.poseDelCalculo)).toBe(false)
    expect(vertices(mallasDeMomentos(capa, dePie))).toBe(0)
    expect(vertices(de(dePie))).toBeGreaterThan(0)
  })
  it('construye arcos en TODAS las fases, no solo en la pose del calculo', () => {
    for (const fase of [0, 0.25, 0.5, 0.75, 1]) expect(vertices(de(esqueletoEnFase(patron, fase)))).toBeGreaterThan(0)
  })
  it('es cota superior: nunca menos vertices que el salon real', () => {
    for (const fase of [0, 0.25, 0.6, 1]) {
      const esq = esqueletoEnFase(patron, fase)
      expect(vertices(de(esq))).toBeGreaterThanOrEqual(vertices(mallasDeMomentos(capa, esq)))
    }
  })
  it('una capa vacia sigue sin dibujar nada, tambien en el peor caso', () => {
    const vacia = { elementos: [], lineas: [], escala: 0, poseDelCalculo: null }
    expect(vertices(mallasDelPeorCaso(vacia, mallasDeMomentos, poseDelEsqueleto, esqueletoEnFase(patron, 0.25)))).toBe(0)
  })
  it('sin pose legible del esqueleto no devuelve nada', () => {
    expect(mallasDelPeorCaso(capa, mallasDeMomentos, () => undefined, esqueletoEnFase(patron, 0.25))).toEqual([])
  })
})
