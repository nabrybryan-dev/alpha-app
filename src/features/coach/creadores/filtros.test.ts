import { describe, expect, it } from 'vitest'
import type { Candidato } from '../../../data/consola/creadores'
import { criteriosAplicados, filtrarCandidatos, leerFiltros, SIN_FILTROS } from './filtros'

function c(parcial: Partial<Candidato>): Candidato {
  return {
    creadorId: 'ig:1', usuarioIg: 'cuenta_a', seguidores: 1, segmento: 'aliado', carril: 'etapa1', motivos: [],
    notaA: null, versionRubrica: null, metricas: {}, senalColombia: null,
    fechaDato: '2026-09-28T00:00:00Z', fechaRecepcion: '2026-09-28T00:00:00Z', actualizadoEn: '2026-09-28T00:00:00Z',
    ...parcial,
  }
}

const todos = [
  c({ creadorId: 'ig:1', usuarioIg: 'Fit_Sintetica', carril: 'tambaleando' }),
  c({ creadorId: 'ig:2', usuarioIg: 'otra.cuenta', carril: 'etapa1' }),
  c({ creadorId: 'ig:3', usuarioIg: 'fit_dos', carril: 'etapa2' }),
]

describe('filtrarCandidatos', () => {
  it('sin filtros devuelve todos', () => {
    expect(filtrarCandidatos(todos, SIN_FILTROS)).toHaveLength(3)
  })
  it('busca por cuenta sin importar mayúsculas ni la arroba', () => {
    const r = filtrarCandidatos(todos, { ...SIN_FILTROS, q: ' @FIT_' })
    expect(r.map((x) => x.creadorId)).toEqual(['ig:1', 'ig:3'])
  })
  it('filtra por carril', () => {
    expect(filtrarCandidatos(todos, { ...SIN_FILTROS, carril: 'etapa1' }).map((x) => x.creadorId)).toEqual(['ig:2'])
  })
  it('«espera desempate» deja solo a los tambaleantes y se combina con la búsqueda', () => {
    expect(filtrarCandidatos(todos, { ...SIN_FILTROS, desempate: true }).map((x) => x.creadorId)).toEqual(['ig:1'])
    expect(filtrarCandidatos(todos, { q: 'otra', carril: 'todos', desempate: true })).toEqual([])
  })
})

describe('leerFiltros y criteriosAplicados', () => {
  it('lee la URL y descarta un carril que la app no conoce', () => {
    expect(leerFiltros(new URLSearchParams('q=ana&carril=etapa2&desempate=1'))).toEqual({ q: 'ana', carril: 'etapa2', desempate: true })
    expect(leerFiltros(new URLSearchParams('carril=inventado')).carril).toBe('todos')
  })
  it('dice en palabras los criterios activos', () => {
    expect(criteriosAplicados(SIN_FILTROS)).toEqual([])
    expect(criteriosAplicados({ q: 'ana', carril: 'etapa2', desempate: true })).toEqual([
      'cuenta con «ana»',
      'carril: Etapa 2 · video',
      'espera desempate',
    ])
  })
})
