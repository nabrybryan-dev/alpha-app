import { describe, expect, it } from 'vitest'
import { PATRON_POR_ID } from '../../../domain/patrones/catalogo'
import { esqueletoEnFase } from '../../../domain/patrones/escena'
import {
  capaDeMomentos,
  INCERTIDUMBRE_DE_EJEMPLO,
  SUJETO_DE_EJEMPLO,
  type CapaDeMomentos,
} from '../../../domain/sujeto/capaDeMomentos'
import {
  ALFA_DE_LA_BANDA,
  ALFA_DEL_VALOR,
  enLaPoseDelCalculo,
  mallasDeMomentos,
  poseDelEsqueleto,
  TOLERANCIA_DE_POSE,
} from './dibujarMomentos'

// En el rig, fase 0 es abajo y fase 1 de pie. Medido: fase 0,25 tiene tibia 0,54 y muslo -1,41 rad,
// casi la pose del ejemplo (tibia 0,45, muslo -1,45); fase 0,6 y fase 1 no.
const enLaPose = esqueletoEnFase(PATRON_POR_ID.sentadilla, 0.25)
const dePie = esqueletoEnFase(PATRON_POR_ID.sentadilla, 1)
const ctx = { categoria: 'SENTADILLA', nombre: 'Sentadilla con barra', sujetoDeEjemplo: true }
const capaReal = capaDeMomentos(SUJETO_DE_EJEMPLO, INCERTIDUMBRE_DE_EJEMPLO, ctx, { muestras: 300 })
const POSE = { tibia: 0.45, muslo: -1.45 }

const un = (estado: 'calculado' | 'estimado', banda: { inf: number; sup: number } | null): CapaDeMomentos => ({
  elementos: [{ articulacion: 'rodilla', estado, fraccion: 0.5, banda }],
  lineas: [],
  escala: 400,
  poseDelCalculo: POSE,
})

describe('la pose del esqueleto', () => {
  it('lee los ángulos con la convención del cálculo: distal a proximal, positivos hacia +z', () => {
    const p = poseDelEsqueleto(dePie)!
    // De pie, el muslo y la tibia están verticales.
    expect(Math.abs(p.muslo)).toBeLessThan(0.05)
    expect(Math.abs(p.tibia)).toBeLessThan(0.2)
    const abajo = poseDelEsqueleto(enLaPose)!
    // Agachado el muslo apunta de la rodilla hacia atrás y arriba (< 0) y la tibia hacia delante (> 0).
    expect(abajo.muslo).toBeLessThan(-1.2)
    expect(abajo.tibia).toBeGreaterThan(0.3)
  })
  it('está en la pose del cálculo en la fase 0,25 y no de pie', () => {
    expect(enLaPoseDelCalculo(enLaPose, POSE)).toBe(true)
    expect(enLaPoseDelCalculo(dePie, POSE)).toBe(false)
    expect(enLaPoseDelCalculo(esqueletoEnFase(PATRON_POR_ID.sentadilla, 0.6), POSE)).toBe(false)
  })
  it('la tolerancia es de verdad un borde: con 0 de tolerancia casi nunca coincide', () => {
    expect(enLaPoseDelCalculo(enLaPose, POSE, 0)).toBe(false)
    expect(TOLERANCIA_DE_POSE).toBeGreaterThan(0)
  })
})

describe('los momentos articulares, en malla', () => {
  it('en la pose del cálculo: arco del valor y banda, con vértices', () => {
    const [calculados, estimados, banda] = mallasDeMomentos(capaReal, enLaPose)
    expect(calculados.vertices).toBe(0) // nada de lo que sale de la tabla poblacional es calculado
    expect(estimados.vertices).toBeGreaterThan(0)
    expect(banda.vertices).toBeGreaterThan(0)
  })

  it('C-3: de pie, o en cualquier otra fase, no se dibuja nada', () => {
    for (const m of mallasDeMomentos(capaReal, dePie)) expect(m.vertices).toBe(0)
    for (const m of mallasDeMomentos(capaReal, esqueletoEnFase(PATRON_POR_ID.sentadilla, 0.6))) expect(m.vertices).toBe(0)
  })

  it('sólido solo para lo calculado; lo estimado y su banda, translúcidos y encima del cuerpo', () => {
    const [calculados, estimados, banda] = mallasDeMomentos(capaReal, enLaPose)
    expect(calculados.alfa).toBe(1)
    expect(estimados.alfa).toBe(ALFA_DEL_VALOR)
    expect(banda.alfa).toBe(ALFA_DE_LA_BANDA)
    expect(estimados.alfa).toBeLessThan(1)
    expect(banda.alfa).toBeLessThan(estimados.alfa)
    for (const m of [calculados, estimados, banda]) expect(m.encima).toBe(true)
  })

  it('un momento calculado va a la malla sólida y no a la translúcida', () => {
    const [calculados, estimados] = mallasDeMomentos(un('calculado', null), enLaPose)
    expect(calculados.vertices).toBeGreaterThan(0)
    expect(estimados.vertices).toBe(0)
  })

  it('fuera de la pose NO se crean mallas nuevas: es siempre el mismo trio, y dentro de ella uno nuevo cada vez', () => {
    const a = mallasDeMomentos(capaReal, dePie)
    const b = mallasDeMomentos(capaReal, esqueletoEnFase(PATRON_POR_ID.sentadilla, 0.6))
    expect(b[0]).toBe(a[0])
    expect(b[1]).toBe(a[1])
    expect(b[2]).toBe(a[2])
    const c = mallasDeMomentos(un('estimado', null), dePie) // otra capa, misma pose fuera: sigue el mismo trio
    expect(c[1]).toBe(a[1])
    expect(mallasDeMomentos(capaReal, enLaPose)[1]).not.toBe(mallasDeMomentos(capaReal, enLaPose)[1])
    expect(mallasDeMomentos(capaReal, enLaPose)[1]).not.toBe(a[1])
  })

  it('el trio compartido conserva su estado (alfa, encima) y nunca acumula vertices', () => {
    for (let i = 0; i < 5; i++) mallasDeMomentos(capaReal, dePie)
    const [c, e, b] = mallasDeMomentos(capaReal, dePie)
    expect([c.vertices, e.vertices, b.vertices]).toEqual([0, 0, 0])
    expect([c.alfa, e.alfa, b.alfa]).toEqual([1, ALFA_DEL_VALOR, ALFA_DE_LA_BANDA])
    expect([c.encima, e.encima, b.encima]).toEqual([true, true, true])
  })

  it('una capa vacía (no_afirmable) no sube ni un vértice', () => {
    const vacia: CapaDeMomentos = { elementos: [], lineas: ['Cadera: no se dibuja. carga ausente'], escala: 0, poseDelCalculo: null }
    for (const m of mallasDeMomentos(vacia, enLaPose)) expect(m.vertices).toBe(0)
  })

  it('un momento sin banda dibuja el arco del valor y nada de banda', () => {
    const [, estimados, banda] = mallasDeMomentos(un('estimado', null), enLaPose)
    expect(estimados.vertices).toBeGreaterThan(0)
    expect(banda.vertices).toBe(0)
  })

  it('con banda, la banda añade geometría; más articulaciones, más geometría', () => {
    const sin = mallasDeMomentos(un('estimado', null), enLaPose)
    const con = mallasDeMomentos(un('estimado', { inf: 0.4, sup: 0.6 }), enLaPose)
    expect(con[2].vertices).toBeGreaterThan(0)
    expect(con[1].vertices).toBe(sin[1].vertices)
    const uno = mallasDeMomentos(un('estimado', null), enLaPose)[1].vertices
    expect(mallasDeMomentos(capaReal, enLaPose)[1].vertices).toBe(uno * 3)
  })

  it('una fracción de cero no dibuja un arco degenerado', () => {
    const cero: CapaDeMomentos = { ...un('estimado', null), elementos: [{ articulacion: 'tobillo', estado: 'estimado', fraccion: 0, banda: null }] }
    expect(mallasDeMomentos(cero, enLaPose)[1].vertices).toBe(0)
  })

  it('una banda sin ancho (inf = sup) no dibuja un arco degenerado', () => {
    expect(mallasDeMomentos(un('estimado', { inf: 0.5, sup: 0.5 }), enLaPose)[2].vertices).toBe(0)
  })
})
