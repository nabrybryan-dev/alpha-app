// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { liberarContextoWebGL, comprobarElCuadreDeLaTanda, comprobarQueLaCapaAporto, mallasDelPeorCaso, VERTICES_POR_FOTOGRAMA_PEOR_CASO } from './medir-fotograma-guarda.mjs'
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

describe('el cuadre de la tanda: vertices = fotogramas × 912', () => {
  it('cuadra con 190 fotogramas y 173.280 vertices (la tanda real de 15 + 80, dos pasadas)', () => {
    expect(() => comprobarElCuadreDeLaTanda(true, 173280, 190)).not.toThrow()
  })
  it('falla si falta un solo fotograma de vertices o si sobra uno', () => {
    expect(() => comprobarElCuadreDeLaTanda(true, 173280 - 912, 190)).toThrow(/no cuadra/)
    expect(() => comprobarElCuadreDeLaTanda(true, 173280 + 1, 190)).toThrow(/no cuadra/)
  })
  it('falla si la capa solo dibujo en parte de los fotogramas (el salon real, no el peor caso)', () => {
    expect(() => comprobarElCuadreDeLaTanda(true, 912 * 40, 190)).toThrow(/no cuadra/)
  })
  it('un numero de fotogramas invalido o cero falla en vez de cuadrar 0 = 0', () => {
    expect(() => comprobarElCuadreDeLaTanda(true, 0, 0)).toThrow(/invalido/)
    expect(() => comprobarElCuadreDeLaTanda(true, 0, NaN)).toThrow(/invalido/)
  })
  it('sin capa no exige nada', () => {
    expect(() => comprobarElCuadreDeLaTanda(false, 0, 190)).not.toThrow()
  })
  it('la constante es de verdad lo que la capa del ejemplo construye por fotograma en el peor caso', () => {
    for (const fase of [0, 0.25, 0.6, 1]) {
      const esq = esqueletoEnFase(patron, fase)
      expect(vertices(mallasDelPeorCaso(capa, mallasDeMomentos, poseDelEsqueleto, esq))).toBe(VERTICES_POR_FOTOGRAMA_PEOR_CASO)
    }
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

describe('el contexto WebGL de la medida se suelta', () => {
  it('pide la perdida del contexto cuando la extension existe', () => {
    let llamadas = 0
    const gl = { getExtension: (n) => (n === 'WEBGL_lose_context' ? { loseContext: () => llamadas++ } : null) }
    expect(liberarContextoWebGL(gl)).toBe(true)
    expect(llamadas).toBe(1)
  })
  it('sin extension, sin gl o con un gl raro no revienta y dice que no pudo', () => {
    expect(liberarContextoWebGL({ getExtension: () => null })).toBe(false)
    expect(liberarContextoWebGL(null)).toBe(false)
    expect(liberarContextoWebGL({})).toBe(false)
  })
})
