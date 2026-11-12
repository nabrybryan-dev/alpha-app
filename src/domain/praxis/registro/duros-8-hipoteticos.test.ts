/** Grupo 8 de «duros» (8-nov-2026): deseos, futuro y metas no se anotan, aunque el extractor los haya citado. */
import { describe, expect, it } from 'vitest'
import { aguaMl, correr, parche, visible } from './duros-ayuda.ts'

describe('hipotéticos: defensa de segunda línea', () => {
  it.each([
    ['quiero dormir 8 horas', { sueno_horas: '8 horas' }, 'horasSueno'],
    ['ojalá pueda dormir 7 horas', { sueno_horas: '7 horas' }, 'horasSueno'],
    ['mañana camino 10 mil', { pasos: '10 mil' }, 'pasos'],
    ['me faltan 3 mil pasos para la meta', { pasos: '3 mil pasos' }, 'pasos'],
    ['mañana me levanto a las 5', { hora_levantarse: 'a las 5' }, 'horaLevantarse'],
  ] as const)('«%s»', (frase, ext, clave) => {
    const r = correr(ext, frase)
    expect(parche(r)[clave]).toBeUndefined()
    expect(visible(r)).toBe(true)
  })
  it.each(['mi meta es tomar 3 litros', 'hoy voy a tomar 3 litros'])('agua «%s»', (frase) => {
    const r = correr({ agua: { cantidad: '3', medida: 'litros' } }, frase)
    expect(aguaMl(r)).toBe(0)
    expect(visible(r)).toBe(true)
  })
  it('lo que sí pasó en la misma frase se conserva', () => {
    expect(parche(correr({ sueno_horas: '7 horas' }, 'dormí 7 horas pero mañana quiero dormir 8')).horasSueno).toBe(7)
    expect(parche(correr({ sueno_horas: '7 horas' }, 'dormí 7 horas')).horasSueno).toBe(7)
    expect(aguaMl(correr({ agua: { cantidad: 'dos litros, mi meta era 3', medida: null } }, 'dos litros, mi meta era 3'))).toBe(2000)
  })
})
