import { describe, expect, it } from 'vitest'
import type { Area } from './enrutador'
import { FUENTES_POR_AREA, leerPorArea } from './fuentesPorArea'
import type { LoQuePraxisVe } from './plan/listaBlanca'

const AREAS: readonly Area[] = ['entrenar', 'nutricion', 'plan', 'hoy', 'progreso', 'bienestar', 'relacion', 'avisos', 'chat']

const vista = (extra: Partial<LoQuePraxisVe> = {}): LoQuePraxisVe => ({
  activo: { numero: 3, fechaInicio: '2026-10-05', cadenciaDias: 7, sesiones: [] },
  cerrados: [{ numero: 2, fechaInicio: '2026-09-28', cadenciaDias: 7, sesiones: [] }],
  perfil: { objetivos: 'fuerza' },
  checkins: [{ fecha: '2026-10-20', horasSueno: 7 }],
  adherencias: [{ fecha: '2026-10-20', estado: 'cumplida' as never }],
  hidratacionHoyMl: 500,
  comida: { verCifras: true, menus: [], equivalencias: [], seccionesEspeciales: [], listaCompras: [] },
  falta: [],
  ...extra,
})

const CLAVES_DE_DATOS = ['activo', 'cerrados', 'perfil', 'checkins', 'adherencias', 'hidratacionHoyMl', 'comida'] as const

describe('leerPorArea (paso 2 del diseño operativo: mapa área -> fuentes de lectura)', () => {
  it('cada área devuelve solo las claves de datos que su mapa declara', () => {
    for (const area of AREAS) {
      const r = leerPorArea(area, vista())
      const conDatos = CLAVES_DE_DATOS.filter((k) => k in r)
      expect([...conDatos].sort()).toEqual([...FUENTES_POR_AREA[area]].sort())
    }
  })

  it('entrenar no ve comida, checkins ni perfil; nutricion no ve el plan de entreno', () => {
    expect(leerPorArea('entrenar', vista())).not.toHaveProperty('comida')
    expect(leerPorArea('entrenar', vista())).not.toHaveProperty('checkins')
    expect(leerPorArea('entrenar', vista())).not.toHaveProperty('perfil')
    expect(leerPorArea('nutricion', vista())).not.toHaveProperty('activo')
    expect(leerPorArea('nutricion', vista())).not.toHaveProperty('cerrados')
  })

  it('avisos y chat no leen ningún dato de la persona', () => {
    for (const area of ['avisos', 'chat'] as const) {
      const r = leerPorArea(area, vista({ falta: ['plan_activo'] }))
      expect(CLAVES_DE_DATOS.filter((k) => k in r)).toEqual([])
      expect(r.falta).toEqual([])
    }
  })

  it('«falta» solo dice lo que falta en ESA área', () => {
    const v = vista({ activo: null, comida: null, falta: ['plan_activo', 'plan_de_comida'] })
    expect(leerPorArea('entrenar', v).falta).toEqual(['plan_activo'])
    expect(leerPorArea('nutricion', v).falta).toEqual(['plan_de_comida'])
    expect(leerPorArea('bienestar', v).falta).toEqual([])
  })

  it('el mapa solo nombra claves que existen en lo que Praxis ve (la lista blanca)', () => {
    const claves = Object.keys(vista())
    for (const area of AREAS) for (const k of FUENTES_POR_AREA[area]) expect(claves).toContain(k)
  })

  it('nunca expone cribado, medidas ni notas del staff: ninguna clave del mapa los nombra', () => {
    const prohibidas = /cribado|medida|peso|analisis|nota|visibilidad|clinic/i
    for (const area of AREAS) for (const k of FUENTES_POR_AREA[area]) expect(k).not.toMatch(prohibidas)
  })

  it('no muta la vista que recibe', () => {
    const v = vista({ falta: ['perfil'] })
    const copia = JSON.parse(JSON.stringify(v))
    for (const area of AREAS) leerPorArea(area, v)
    expect(v).toEqual(copia)
  })
})
