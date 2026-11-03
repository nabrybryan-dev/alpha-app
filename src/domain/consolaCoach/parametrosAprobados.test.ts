import { describe, expect, it } from 'vitest'
import {
  canonizarParametros,
  estadoDeAprobacionDeParametros,
  parametrosDeContenido,
  parametrosIguales,
} from './parametrosAprobados'

const DIEZ = {
  frecuencia_semanal: 4,
  series_por_grupo: 12,
  rir_objetivo: '2',
  descanso_s: 120,
  deficit_kcal: 300,
  proteina_g_kg: 2,
  pasos_dia: 8000,
  sueno_h: 7.5,
  cardio_min_semana: 90,
  deload_cada_semanas: 6,
}

describe('canonizarParametros', () => {
  it('ordena las claves, tambien en lo anidado', () => {
    const c = canonizarParametros({ b: 1, a: { z: 1, y: 2 } })
    expect(Object.keys(c)).toEqual(['a', 'b'])
    expect(Object.keys(c.a as object)).toEqual(['y', 'z'])
  })

  it('quita lo undefined (en objetos y dentro de listas anidadas)', () => {
    const c = canonizarParametros({ a: 1, b: undefined, c: [{ x: undefined, y: 2 }] })
    expect('b' in c).toBe(false)
    expect(c.c).toEqual([{ y: 2 }])
  })

  it('no toca el orden de las listas: el orden de una lista si es informacion', () => {
    expect(canonizarParametros({ a: [2, 1] }).a).toEqual([2, 1])
  })
})

describe('parametrosIguales', () => {
  it('claves en otro orden son lo mismo', () => {
    const al_reves = Object.fromEntries(Object.entries(DIEZ).reverse())
    expect(parametrosIguales(DIEZ, al_reves)).toBe(true)
  })

  it('un valor distinto no es lo mismo', () => {
    expect(parametrosIguales(DIEZ, { ...DIEZ, pasos_dia: 8001 })).toBe(false)
  })

  it('un 4 y un "4" no son lo mismo: el tipo tambien cuenta', () => {
    expect(parametrosIguales({ a: 4 }, { a: '4' })).toBe(false)
  })

  it('una clave de mas o de menos no es lo mismo', () => {
    expect(parametrosIguales(DIEZ, { ...DIEZ, extra: 1 })).toBe(false)
    const nueve: Record<string, unknown> = { ...DIEZ }
    delete nueve.sueno_h
    expect(parametrosIguales(DIEZ, nueve)).toBe(false)
  })

  it('undefined no cuenta como valor', () => {
    expect(parametrosIguales({ a: 1, b: undefined }, { a: 1 })).toBe(true)
  })

  it('lo anidado se compara a fondo', () => {
    expect(parametrosIguales({ a: { x: 1, y: [1, 2] } }, { a: { y: [1, 2], x: 1 } })).toBe(true)
    expect(parametrosIguales({ a: { x: 1, y: [1, 2] } }, { a: { x: 1, y: [2, 1] } })).toBe(false)
  })
})

describe('estadoDeAprobacionDeParametros', () => {
  it('sin fila aprobada: sin_aprobar', () => {
    expect(estadoDeAprobacionDeParametros(null, DIEZ)).toBe('sin_aprobar')
    expect(estadoDeAprobacionDeParametros(undefined, DIEZ)).toBe('sin_aprobar')
  })

  it('mismo valor: vigente', () => {
    expect(estadoDeAprobacionDeParametros({ ...DIEZ }, DIEZ)).toBe('vigente')
  })

  it('mismas claves en otro orden: vigente', () => {
    const al_reves = Object.fromEntries(Object.entries(DIEZ).reverse())
    expect(estadoDeAprobacionDeParametros(al_reves, DIEZ)).toBe('vigente')
  })

  it('cambia cualquiera de los diez valores: vencida', () => {
    for (const clave of Object.keys(DIEZ)) {
      const cambiado = { ...DIEZ, [clave]: 'otro valor' }
      expect(estadoDeAprobacionDeParametros(DIEZ, cambiado), clave).toBe('vencida')
    }
  })

  it('el plan ya no trae la seccion y habia aprobacion: vencida', () => {
    expect(estadoDeAprobacionDeParametros(DIEZ, undefined)).toBe('vencida')
  })

  it('sin aprobacion y sin seccion: sin_aprobar', () => {
    expect(estadoDeAprobacionDeParametros(null, undefined)).toBe('sin_aprobar')
  })
})

describe('parametrosDeContenido', () => {
  it('toma la seccion sin la clave aprobacion y en forma canonica', () => {
    const p = parametrosDeContenido({
      parametros_para_decidir: { z: 1, a: 2, aprobacion: { estado: 'pendiente' } },
    })
    expect(p).toEqual({ a: 2, z: 1 })
    expect(Object.keys(p ?? {})).toEqual(['a', 'z'])
  })

  it('que la aprobacion del contenido cambie no cambia los parametros', () => {
    const a = parametrosDeContenido({ parametros_para_decidir: { a: 1, aprobacion: { estado: 'pendiente' } } })
    const b = parametrosDeContenido({ parametros_para_decidir: { a: 1, aprobacion: { estado: 'aprobada' } } })
    expect(parametrosIguales(a ?? {}, b ?? {})).toBe(true)
  })

  it('sin seccion, o con una seccion que no es objeto: undefined', () => {
    expect(parametrosDeContenido({})).toBeUndefined()
    expect(parametrosDeContenido(null)).toBeUndefined()
    expect(parametrosDeContenido({ parametros_para_decidir: [1] })).toBeUndefined()
    expect(parametrosDeContenido({ parametros_para_decidir: 'x' })).toBeUndefined()
  })
})
