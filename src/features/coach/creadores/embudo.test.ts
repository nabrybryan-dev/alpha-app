import { describe, expect, it } from 'vitest'
import type { Candidato, Carril } from '../../../data/consola/creadores'
import { embudoDe } from './embudo'

const en = (carril: Carril, n = 1): Candidato[] =>
  Array.from({ length: n }, (_, i) => ({
    creadorId: `ig:${carril}-${i}`,
    usuarioIg: `${carril}${i}`,
    seguidores: null,
    segmento: carril === 'entrenador' ? 'entrenador' : 'aliado',
    carril,
    motivos: [],
    notaA: null,
    versionRubrica: null,
    metricas: {},
    senalColombia: null,
    fechaDato: '2026-09-28T00:00:00Z',
    fechaRecepcion: '2026-09-28T00:00:00Z',
    actualizadoEn: '2026-09-28T00:00:00Z',
  }))

describe('embudoDe', () => {
  it('cuenta cada paso con los carriles reales y deja fuera a los recién descubiertos', () => {
    const lista = [
      ...en('descubierto', 4),
      ...en('etapa1', 5),
      ...en('etapa2', 3),
      ...en('tambaleando', 2),
      ...en('mensaje_enviado'),
      ...en('microprueba'),
      ...en('descartado', 2),
      ...en('entrenador', 7),
    ]
    expect(embudoDe(lista)).toEqual({
      evaluados: 21,
      esperanVideo: 3,
      tambaleando: 2,
      contactados: 2,
      entrenadores: 7,
    })
  })

  it('sin candidatos, todo a cero', () => {
    expect(embudoDe([])).toEqual({ evaluados: 0, esperanVideo: 0, tambaleando: 0, contactados: 0, entrenadores: 0 })
  })
})
