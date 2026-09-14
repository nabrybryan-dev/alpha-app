import { describe, expect, it } from 'vitest'
import { esMuerta, esViva, hoyBogota, sinCheckinHoy } from './seleccion'

describe('hoyBogota', () => {
  it('formatea en America/Bogota', () => {
    expect(hoyBogota(new Date('2026-09-13T05:00:00Z'))).toBe('2026-09-13')
    expect(hoyBogota(new Date('2026-09-13T04:59:00Z'))).toBe('2026-09-12')
  })
})

describe('esViva', () => {
  it('viva = dijo_si + endpoint/p256dh/auth', () => {
    expect(esViva({ usuario_id: 'a', dijo_si: true, endpoint: 'https://x', p256dh: 'p', auth: 'a', vivo_en: null })).toBe(true)
    expect(esViva({ usuario_id: 'a', dijo_si: false, endpoint: 'https://x', p256dh: 'p', auth: 'a', vivo_en: null })).toBe(false)
    expect(esViva({ usuario_id: 'a', dijo_si: true, endpoint: null, p256dh: 'p', auth: 'a', vivo_en: null })).toBe(false)
  })
})

describe('sinCheckinHoy', () => {
  it('solo sin check-in hoy y vivas', () => {
    const permisos = [
      { usuario_id: 'a', dijo_si: true, endpoint: 'https://a', p256dh: 'p', auth: 'a', vivo_en: null },
      { usuario_id: 'b', dijo_si: true, endpoint: 'https://b', p256dh: 'p', auth: 'a', vivo_en: null },
      { usuario_id: 'c', dijo_si: false, endpoint: 'https://c', p256dh: 'p', auth: 'a', vivo_en: null },
    ]
    const checkins = [{ usuario_id: 'a', fecha: '2026-09-13' }]
    expect(sinCheckinHoy(permisos, checkins).map((o) => o.usuario_id)).toEqual(['b'])
  })
})

describe('esMuerta', () => {
  it('404 y 410 son muertas, resto no', () => {
    expect(esMuerta(404)).toBe(true)
    expect(esMuerta(410)).toBe(true)
    expect(esMuerta(400)).toBe(false)
    expect(esMuerta(201)).toBe(false)
  })
})
