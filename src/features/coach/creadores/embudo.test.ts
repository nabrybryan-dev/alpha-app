import { describe, expect, it } from 'vitest'
import type { Candidato, Carril, EventoCarril } from '../../../data/consola/creadores'
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
    expect(embudoDe(lista, [])).toEqual({
      enTablero: 25,
      esperanVideo: 3,
      tambaleando: 2,
      contactados: 2,
      entrenadores: 7,
    })
  })

  it('sin candidatos, todo a cero', () => {
    expect(embudoDe([], [])).toEqual({ enTablero: 0, esperanVideo: 0, tambaleando: 0, contactados: 0, entrenadores: 0 })
  })

  it('un entrenador cuenta por su segmento aunque su carril sea otro (E-05)', () => {
    const [pausado] = en('pausa')
    const e = embudoDe([{ ...pausado, segmento: 'entrenador' }, ...en('entrenador', 2)], [])
    expect(e.entrenadores).toBe(3)
  })

  it('«candidatos en el tablero» son todas las filas subidas, también las recién descubiertas (E-04)', () => {
    expect(embudoDe([...en('descubierto', 2), ...en('etapa1')], []).enTablero).toBe(3)
  })

  const evento = (creadorId: string, carrilNuevo: Carril): EventoCarril => ({
    id: `${creadorId}:${carrilNuevo}`,
    creadorId,
    carrilNuevo,
    fechaDato: '2026-09-20T00:00:00Z',
  })

  it('un contactado que después se descarta sigue contando: sale de la historia (E-05)', () => {
    const [descartado] = en('descartado')
    const e = embudoDe([descartado], [evento(descartado.creadorId, 'mensaje_enviado'), evento(descartado.creadorId, 'descartado')])
    expect(e.contactados).toBe(1)
  })

  it('cuenta personas, no eventos: tres pasos de la misma persona son un contactado', () => {
    const [resp] = en('respondio')
    const id = resp.creadorId
    const e = embudoDe([resp], [evento(id, 'mensaje_enviado'), evento(id, 'respondio'), evento(id, 'encuesta')])
    expect(e.contactados).toBe(1)
  })

  it('un evento previo al mensaje (etapa2, tambaleando) no es un contacto', () => {
    const [d] = en('descartado')
    expect(embudoDe([d], [evento(d.creadorId, 'etapa2'), evento(d.creadorId, 'tambaleando')]).contactados).toBe(0)
  })

  it('sin historia legible, «contactados» es desconocido, no el estado de hoy disfrazado', () => {
    expect(embudoDe(en('mensaje_enviado', 2), null).contactados).toBeNull()
  })
})
