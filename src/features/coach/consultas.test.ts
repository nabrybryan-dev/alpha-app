import { describe, expect, it } from 'vitest'
import { agrupar, estadoDe, type Consulta } from './consultas'

function consulta(p: Partial<Consulta> = {}): Consulta {
  return {
    id: 'c1', usuarioId: 'u1', mensaje: 'hola', fichaId: null, similitud: null,
    via: 'ficha', banderaRoja: false, revisado: false, corregido: false,
    creadoEn: '2026-07-26T10:00:00Z',
    ...p,
  }
}

describe('estadoDe', () => {
  it('bandera roja siempre requiere criterio, aunque haya enganchado ficha', () => {
    expect(estadoDe(consulta({ via: 'ficha', banderaRoja: true }))).toBe('criterio')
  })

  it('lo que no engancho requiere criterio', () => {
    expect(estadoDe(consulta({ via: 'escalado' }))).toBe('criterio')
    expect(estadoDe(consulta({ via: 'ia_vivo' }))).toBe('criterio')
  })

  it('la ficha tentativa queda con dudas', () => {
    expect(estadoDe(consulta({ via: 'ficha_tentativa' }))).toBe('dudas')
  })

  it('la ficha limpia queda resuelta', () => {
    expect(estadoDe(consulta({ via: 'ficha' }))).toBe('resuelto')
  })

  it('lo ya revisado pasa a resuelto aunque fuera bandera roja', () => {
    expect(estadoDe(consulta({ banderaRoja: true, revisado: true }))).toBe('resuelto')
  })
})

describe('agrupar', () => {
  it('separa en los tres estados', () => {
    const g = agrupar([
      consulta({ id: 'a', banderaRoja: true }),
      consulta({ id: 'b', via: 'ficha_tentativa' }),
      consulta({ id: 'c', via: 'ficha' }),
    ])
    expect(g.criterio.map((c) => c.id)).toEqual(['a'])
    expect(g.dudas.map((c) => c.id)).toEqual(['b'])
    expect(g.resuelto.map((c) => c.id)).toEqual(['c'])
  })

  it('dentro de cada grupo, lo mas reciente primero', () => {
    const g = agrupar([
      consulta({ id: 'vieja', creadoEn: '2026-07-26T08:00:00Z' }),
      consulta({ id: 'nueva', creadoEn: '2026-07-26T12:00:00Z' }),
    ])
    expect(g.resuelto.map((c) => c.id)).toEqual(['nueva', 'vieja'])
  })

  it('con la lista vacia devuelve los tres grupos vacios', () => {
    const g = agrupar([])
    expect(g).toEqual({ criterio: [], dudas: [], resuelto: [] })
  })
})
