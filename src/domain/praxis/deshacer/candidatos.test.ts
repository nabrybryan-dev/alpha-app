import { describe, expect, it } from 'vitest'
import { candidatosParaDeshacer, diaLocal, minutosLocales } from './candidatos'
import { ZONA_BOGOTA, type RegistroLibro } from './tipos'

const reg = (id: string, creadoEn: string, extra: Partial<RegistroLibro> = {}): RegistroLibro => ({
  id,
  usuarioId: 'u1',
  tipo: 'hidratacion',
  descripcion: '+250 ml',
  creadoEn,
  deshechoEn: null,
  ...extra,
})

describe('hora de Bogotá, sin depender de la zona del proceso', () => {
  it('23:30 de Bogotá cae en el día de Bogotá, no en el de UTC', () => {
    expect(diaLocal('2026-11-05T04:30:00Z', ZONA_BOGOTA)).toBe('2026-11-04')
    expect(minutosLocales('2026-11-05T04:30:00Z', ZONA_BOGOTA)).toBe(23 * 60 + 30)
  })
})

describe('candidatosParaDeshacer', () => {
  const ahora = new Date('2026-11-04T19:00:00Z') // 14:00 en Bogotá

  it('ordena del más reciente al más viejo', () => {
    const libro = [reg('a', '2026-11-04T13:00:00Z'), reg('c', '2026-11-04T17:00:00Z'), reg('b', '2026-11-04T15:00:00Z')]
    expect(candidatosParaDeshacer(libro, ahora, ZONA_BOGOTA).map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })

  it('ofrece como máximo 3', () => {
    const libro = ['1', '2', '3', '4', '5'].map((n, i) => reg(n, `2026-11-04T1${i}:00:00Z`))
    const c = candidatosParaDeshacer(libro, ahora, ZONA_BOGOTA)
    expect(c).toHaveLength(3)
    expect(c.map((r) => r.id)).toEqual(['5', '4', '3'])
  })

  it('excluye lo ya deshecho y lo futuro', () => {
    const libro = [
      reg('hecho', '2026-11-04T17:00:00Z', { deshechoEn: '2026-11-04T17:05:00Z' }),
      reg('futuro', '2026-11-04T20:00:00Z'),
      reg('ok', '2026-11-04T16:00:00Z'),
    ]
    expect(candidatosParaDeshacer(libro, ahora, ZONA_BOGOTA).map((r) => r.id)).toEqual(['ok'])
  })

  it('borde 23:30 de Bogotá: a las 23:50 sigue siendo de hoy', () => {
    const libro = [reg('noche', '2026-11-05T04:30:00Z')] // 23:30 Bogotá del 4
    expect(candidatosParaDeshacer(libro, new Date('2026-11-05T04:50:00Z'), ZONA_BOGOTA)).toHaveLength(1)
  })

  it('borde de medianoche local: a las 00:10 de Bogotá ya es de ayer, aunque en UTC sea el mismo día', () => {
    const libro = [reg('noche', '2026-11-05T02:00:00Z')] // 21:00 Bogotá del 4 = 02:00Z del 5
    // 00:10 Bogotá del 5 = 05:10Z del 5: mismo día UTC, distinto día local
    expect(candidatosParaDeshacer(libro, new Date('2026-11-05T05:10:00Z'), ZONA_BOGOTA)).toEqual([])
    const tarde = [reg('noche', '2026-11-05T04:30:00Z')] // 23:30 Bogotá
    expect(candidatosParaDeshacer(tarde, new Date('2026-11-05T05:10:00Z'), ZONA_BOGOTA)).toEqual([])
  })

  it('una madrugada de hoy sigue dentro (23 h 40 min de edad)', () => {
    const libro = [reg('madrugada', '2026-11-04T05:10:00Z')] // 00:10 Bogotá
    expect(candidatosParaDeshacer(libro, new Date('2026-11-05T04:50:00Z'), ZONA_BOGOTA)).toHaveLength(1)
  })

  it('filtra por tipo y por hora dicha (±45 min)', () => {
    const libro = [
      reg('agua', '2026-11-04T15:05:00Z'),
      reg('c1', '2026-11-04T15:05:00Z', { tipo: 'comida' }), // 10:05
      reg('c2', '2026-11-04T17:40:00Z', { tipo: 'comida' }), // 12:40
    ]
    expect(candidatosParaDeshacer(libro, ahora, ZONA_BOGOTA, { tipo: 'comida', minutoDicho: 600 }).map((r) => r.id)).toEqual(['c1'])
    expect(candidatosParaDeshacer(libro, ahora, ZONA_BOGOTA, { tipo: 'hidratacion' }).map((r) => r.id)).toEqual(['agua'])
  })
})
