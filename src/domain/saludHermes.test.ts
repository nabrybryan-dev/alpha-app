import { describe, expect, it } from 'vitest'
import { MINUTOS_SIN_SENAL, veredictoDeSalud, type FilaSaludHermes } from './saludHermes'

const AHORA = Date.parse('2026-10-30T12:00:00Z')
const hace = (min: number) => new Date(AHORA - min * 60_000).toISOString()
const fila = (pieza: string, estado: string, min: number): FilaSaludHermes => ({ pieza, estado, vistoEn: hace(min) })
const todoBien = (min = 5) => [fila('puerta', 'arriba', min), fila('hermes', 'arriba', min), fila('custodio', 'arriba', min)]

describe('la salud de Hermes: la hora manda', () => {
  it('sin filas: SIN SEÑAL (el minipc nunca ha escrito)', () => {
    expect(veredictoDeSalud([], AHORA)).toEqual({ tipo: 'sin_senal', motivo: 'sin_filas', minutos: null })
  })

  it('todo «arriba» pero de hace más de 45 minutos: SIN SEÑAL, no «todo bien»', () => {
    const v = veredictoDeSalud(todoBien(MINUTOS_SIN_SENAL + 1), AHORA)
    expect(v).toEqual({ tipo: 'sin_senal', motivo: 'vieja', minutos: MINUTOS_SIN_SENAL + 1 })
  })

  it('basta UNA pieza vieja para que no haya señal', () => {
    const filas = [fila('puerta', 'arriba', 5), fila('hermes', 'arriba', 5), fila('custodio', 'arriba', 90)]
    expect(veredictoDeSalud(filas, AHORA).tipo).toBe('sin_senal')
  })

  it('exactamente 45 minutos todavía cuenta como reciente', () => {
    expect(veredictoDeSalud(todoBien(MINUTOS_SIN_SENAL), AHORA).tipo).toBe('todo_bien')
  })

  it('una hora del futuro no se toma por reciente; un reloj apenas adelantado sí vale', () => {
    expect(veredictoDeSalud(todoBien(-600), AHORA).tipo).toBe('sin_senal')
    expect(veredictoDeSalud(todoBien(-5), AHORA).tipo).toBe('todo_bien')
  })

  it('una hora ilegible no se toma por reciente', () => {
    const filas = [{ pieza: 'puerta', estado: 'arriba', vistoEn: 'ayer' }, ...todoBien().slice(1)]
    expect(veredictoDeSalud(filas, AHORA).tipo).toBe('sin_senal')
  })

  it('todo arriba y reciente: todo bien', () => {
    expect(veredictoDeSalud(todoBien(7), AHORA)).toEqual({ tipo: 'todo_bien', minutos: 7 })
  })

  it('reciente con una pieza caída: la nombra y dice qué hacer', () => {
    const filas = [fila('puerta', 'arriba', 3), fila('hermes', 'caido', 3), fila('custodio', 'arriba', 3)]
    const v = veredictoDeSalud(filas, AHORA)
    expect(v.tipo).toBe('pieza_caida')
    if (v.tipo !== 'pieza_caida') return
    expect(v.piezas).toHaveLength(1)
    expect(v.piezas[0]).toMatchObject({ pieza: 'hermes', estado: 'caido' })
    expect(v.piezas[0].queHacer).toContain('config-hermes-1')
  })

  it('desconocido o pieza ausente no cuenta como arriba', () => {
    const filas = [fila('puerta', 'desconocido', 3), fila('hermes', 'arriba', 3)]
    const v = veredictoDeSalud(filas, AHORA)
    expect(v.tipo).toBe('pieza_caida')
    if (v.tipo !== 'pieza_caida') return
    expect(v.piezas.map((p) => p.pieza)).toEqual(['puerta', 'custodio'])
    expect(v.piezas.every((p) => p.estado === 'desconocido')).toBe(true)
  })
})
