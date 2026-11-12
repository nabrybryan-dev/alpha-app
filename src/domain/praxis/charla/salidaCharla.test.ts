import { describe, expect, it } from 'vitest'
import type { PiezaDeLaBiblioteca } from './pedidoCharla.ts'
import { conTope, decidirSalida, lecturaDesdeNivel, respaldoSinModelo, SIN_PIEZA_PROVISIONAL } from './salidaCharla.ts'

describe('decisión de salida: falla cerrado', () => {
  it('solo «sin riesgo» explícito deja pasar al modelo', () => {
    expect(decidirSalida({ tipo: 'sin_riesgo' })).toEqual({ salida: 'modelo' })
  })
  it('riesgo, falla del lector y lector lento van al coach', () => {
    expect(decidirSalida({ tipo: 'riesgo', nivel: 'DERIVAR' })).toEqual({ salida: 'coach', motivo: 'riesgo' })
    expect(decidirSalida({ tipo: 'falla' })).toEqual({ salida: 'coach', motivo: 'lector_falla' })
    expect(decidirSalida({ tipo: 'tarda' })).toEqual({ salida: 'coach', motivo: 'lector_tarda' })
  })
  it('sin lectura o con algo desconocido también va al coach', () => {
    expect(decidirSalida(null).salida).toBe('coach')
    expect(decidirSalida(undefined).salida).toBe('coach')
    expect(decidirSalida({ tipo: 'quizas' } as never).salida).toBe('coach')
  })
  it('del nivel del lector: NINGUNO es sin riesgo; cualquier otro o vacío no', () => {
    expect(lecturaDesdeNivel('NINGUNO')).toEqual({ tipo: 'sin_riesgo' })
    expect(lecturaDesdeNivel('DERIVAR').tipo).toBe('riesgo')
    expect(lecturaDesdeNivel('ninguno').tipo).toBe('riesgo')
    expect(lecturaDesdeNivel(null).tipo).toBe('falla')
    expect(lecturaDesdeNivel('').tipo).toBe('falla')
  })
})

describe('conTope', () => {
  it('devuelve el valor si llega a tiempo', async () => {
    expect(await conTope(async () => 7, 200)).toEqual({ ok: true, valor: 7 })
  })
  it('tarda si pasa el tope', async () => {
    expect(await conTope(() => new Promise<number>((r) => setTimeout(() => r(1), 300)), 20)).toEqual({ ok: false, motivo: 'tarda' })
  })
  it('falla si lanza, sin lanzar', async () => {
    expect(await conTope(async () => { throw new Error('x') }, 200)).toEqual({ ok: false, motivo: 'falla' })
  })
})

describe('respaldo sin modelo', () => {
  const A: PiezaDeLaBiblioteca = { id: 'a', respuesta: 'Texto firmado A', estudios: 'Est A', criterio_de_practica: 'Crit A' }
  const B: PiezaDeLaBiblioteca = { id: 'b', respuesta: 'Texto B', estudios: '', criterio_de_practica: 'Crit B' }
  it('devuelve la pieza tal cual, con los bloques separados', () => {
    const r = respaldoSinModelo([A, B])
    expect(r.respuesta).toBe('Texto firmado A')
    expect(r.origen).toBe('respaldo')
    expect(r.piezas).toEqual([
      { id: 'a', estudios: 'Est A', criterio_de_practica: 'Crit A' },
      { id: 'b', estudios: null, criterio_de_practica: 'Crit B' },
    ])
  })
  it('nunca vacío: sin piezas devuelve la frase fija', () => {
    const r = respaldoSinModelo([])
    expect(r.respuesta).toBe(SIN_PIEZA_PROVISIONAL)
    expect(r.respuesta.length).toBeGreaterThan(0)
    expect(r.piezas).toEqual([])
  })
})
