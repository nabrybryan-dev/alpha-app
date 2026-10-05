import { describe, expect, it } from 'vitest'
import type { LoQuePraxisVe } from '../../../domain/praxis/plan/listaBlanca'
import { fuenteReal } from './fuenteReal'

/**
 * La fuente REAL de la escena: los días de la persona con sesión, armados desde lo que
 * Praxis ve (lista blanca). Un día sin check-in es un hueco, no un día inventado.
 */
const ve: LoQuePraxisVe = {
  activo: null, cerrados: [], perfil: null, adherencias: [], hidratacionHoyMl: 0, comida: null, falta: [],
  checkins: [
    { fecha: '2026-09-20', horasSueno: 8, calidadSueno: 'BUENA' },
    { fecha: '2026-09-29', horasSueno: 6, calidadSueno: 'MALA', estres: 'MUCHO', comentarios: 'semana pesada' },
    { fecha: '2026-10-01', horasSueno: 7.5, calidadSueno: 'BUENA', dolor: 0 },
  ],
}

describe('fuenteReal', () => {
  const f = fuenteReal(ve, 'u-real', '2026-10-01')

  it('no es de ejemplo y lleva el usuario y la fecha de verdad', () => {
    expect(f.ejemplo).toBe(false)
    expect(f.usuario).toBe('u-real')
    expect(f.hoy).toEqual({ fecha: '2026-10-01', dia: 'jueves', corto: 'JUE 1 OCT' })
  })

  it('la semana son los siete días que acaban hoy, con su rótulo', () => {
    expect(f.semana.map((d) => d.fecha)).toEqual(['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'])
    expect(f.semana.map((d) => d.rot)).toEqual(['VIE 25', 'SÁB 26', 'DOM 27', 'LUN 28', 'MAR 29', 'MIÉ 30', 'JUE 1'])
    expect(f.semana[6].hoy).toBe(true)
    expect(f.semana.filter((d) => d.hoy)).toHaveLength(1)
    expect(f.rango).toBe('25 SEP – 1 OCT')
  })

  it('cada día trae el check-in de ESE día, y sin check-in queda vacío', () => {
    expect(f.semana[4].d).toEqual({ horasSueno: 6, calidadSueno: 'MALA', estres: 'MUCHO', comentarios: 'semana pesada' })
    expect(f.semana[6].d).toEqual({ horasSueno: 7.5, calidadSueno: 'BUENA', dolor: 0 })
    expect(f.semana[5].d).toBeNull()
    expect(f.semana[0].d).toBeNull()
  })

  it('los siete días anteriores también salen, con sus huecos', () => {
    expect(f.antes?.map((d) => d.fecha)).toEqual(['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'])
    expect(f.antes?.[2].d).toEqual({ horasSueno: 8, calidadSueno: 'BUENA' })
    expect(f.antes?.filter((d) => d.d).length).toBe(1)
  })

  it('cuenta las firmas que conoce, sin la de hoy', () => {
    expect(f.firmasPrevias).toBe(2)
  })

  it('lo que la base no tiene no se inventa: ni idea de ayer ni último peso', () => {
    expect(f.ideaAyer).toBeNull()
    expect(f.ultimoPeso).toBeNull()
    expect(JSON.stringify(f)).not.toMatch(/celular|64[.,]2|ejemplo-01/)
  })

  it('sin ningún check-in, toda la semana es un hueco', () => {
    const vacia = fuenteReal({ ...ve, checkins: [] }, 'u-real', '2026-10-01')
    expect(vacia.semana.every((d) => d.d === null)).toBe(true)
    expect(vacia.firmasPrevias).toBe(0)
  })
})
