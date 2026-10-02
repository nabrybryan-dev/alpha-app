// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contextoDeCorpus } from './contexto-corpus.ts'

interface Caso { id: string; area: string; contexto: string; frase: string; esperado: string }
const corpus: Caso[] = JSON.parse(readFileSync(new URL('./corpus.json', import.meta.url), 'utf8'))
const caso = (id: string): Caso => corpus.find((c) => c.id === id)!
const ctx = (id: string) => contextoDeCorpus(caso(id).contexto)
const ej = (id: string, ejId: string) => ctx(id).sesiones.flatMap((s) => s.ejercicios).find((e) => e.id === ejId)!

describe('corpus.json', () => {
  it('trae 240 casos con id único', () => {
    expect(corpus).toHaveLength(240)
    expect(new Set(corpus.map((c) => c.id)).size).toBe(240)
  })
  it('los 80 CE traen un esperado que es JSON', () => {
    for (const c of corpus.filter((x) => x.id.startsWith('CE-'))) expect(() => JSON.parse(c.esperado), c.id).not.toThrow()
  })
})

describe('contextoDeCorpus', () => {
  it('CE-001: sesión de hoy, cinco ejercicios y su pauta', () => {
    const c = ctx('CE-001')
    expect(c.sesionHoyId).toBe('S1')
    expect(c.sesiones[0].ejercicios.map((e) => e.id)).toEqual(['pa1', 'pa2', 'pa3', 'pa4', 'pa5'])
    expect(ej('CE-001', 'pa1').seriesPrescritas?.map((s) => s.cargaKg)).toEqual([60, 65, 70, 70])
    expect(ej('CE-001', 'pa1').sets).toBe(4)
    expect(ej('CE-001', 'pa1').unidad).toBe('kg')
    expect(c.ahora).toBe('2026-09-28T18:40:00-05:00')
    expect(c.perfil.pesoBarraKg).toBeNull()
  })
  it('CE-002: pa1 completa y pa2 sin series', () => {
    expect(ej('CE-002', 'pa1').series).toHaveLength(4)
    expect(ej('CE-002', 'pa2').series).toHaveLength(0)
  })
  it('CE-004: por_mano y pauta «en las 3»', () => {
    expect(ej('CE-004', 'pb2').unidad).toBe('por_mano')
    expect(ej('CE-004', 'pb2').seriesPrescritas).toHaveLength(3)
  })
  it('CE-007: barra del perfil', () => expect(ctx('CE-007').perfil.pesoBarraKg).toBe(20))
  it('CE-013: historial de la semana pasada', () => {
    expect(ctx('CE-013').semanaAnterior.pc1).toHaveLength(4)
    expect(ctx('CE-013').semanaAnterior.pc1[0].cargaKg).toBe(52.5)
  })
  it('CE-014 y CE-015: series con valor, último tocado y pantalla', () => {
    expect(ej('CE-014', 'pa1').series).toEqual([{ orden: 1, cargaKg: 40, reps: 12 }])
    expect(ctx('CE-014').ultimoTocado).toEqual({ ejercicioId: 'pa1', minutosAtras: 3 })
    expect(ctx('CE-014').pantalla.ejercicioId).toBe('pa1')
    expect(ej('CE-015', 'pa1').series).toHaveLength(2)
  })
  it('CE-028 y CE-029: pantalla abierta y sin pantalla', () => {
    expect(ctx('CE-028').pantalla.ejercicioId).toBe('pb3')
    expect(ctx('CE-029').pantalla.ejercicioId).toBeNull()
  })
  it('CE-030: el remo existe solo en S3', () => {
    const c = ctx('CE-030')
    expect(c.sesionHoyId).toBe('S2')
    expect(c.sesiones.find((s) => s.id === 'S3')?.ejercicios.map((e) => e.id)).toEqual(['pc1'])
    expect(c.sesiones.find((s) => s.id === 'S2')?.ejercicios).toHaveLength(6)
  })
  it('CE-045: tríceps completo con valores', () => {
    expect(ej('CE-045', 'pb5').series.map((s) => s.reps)).toEqual([12, 12, 10])
  })
  it('CE-050: sin sesión de hoy declarada', () => expect(ctx('CE-050').sesionHoyId).toBeNull())
  it('CE-051: microciclo vencido', () => expect(ctx('CE-051').microciclo?.vencido).toBe(true))
  it('CE-054/056: cronómetro', () => {
    expect(ctx('CE-054').cronometroMin).toBe(58)
    expect(ctx('CE-056').cronometroMin).toBeNull()
  })
  it('CE-057: bloque de cardio', () => expect(ctx('CE-057').sesiones[0].bloquesCardio?.[0].id).toBe('cd1'))
  it('V31: sesión estilo V con ejercicios por nombre', () => {
    const c = ctx('V31')
    expect(c.sesiones[0].ejercicios.map((e) => e.nombre)).toContain('SENTADILLA')
  })
  it('V10: hidratación previa', () => expect(ctx('V10').hidratacionHoyMl).toBe(500))
  it('V08: hora en formato «10:30 pm»', () => expect(ctx('V08').ahora).toBe('2026-10-02T22:30:00-05:00'))
})
