/**
 * Grupo 9 de «duros» (9-nov-2026): una COMA separa el hábito, la duda o el plan del dato del día.
 * `esHipotetico` cortaba cláusula solo con pero/aunque/luego/después/y; `normalizarTexto` borra las comas, así que
 * «suelo caminar 6 mil pasos, hoy llevo 9 mil» perdía los 9.000 por culpa del «suelo» de la otra mitad.
 */
import { describe, expect, it } from 'vitest'
import { aguaMl, correr, parche, visible } from './duros-ayuda.ts'

describe('la coma corta la cláusula: el dato del día se conserva', () => {
  it('«suelo caminar 6 mil pasos, hoy llevo 9 mil»', () => {
    expect(parche(correr({ pasos: '9 mil' }, 'suelo caminar 6 mil pasos, hoy llevo 9 mil')).pasos).toBe(9000)
  })
  it('«suelo tomar 3 litros, hoy tomé 1,5 litros»', () => {
    expect(aguaMl(correr({ agua: { cantidad: '1,5', medida: 'litros' } }, 'suelo tomar 3 litros, hoy tomé 1,5 litros'))).toBe(1500)
  })
  it('«no sé si dormí mucho, anoche dormí 8 horas»', () => {
    expect(parche(correr({ sueno_horas: '8 horas' }, 'no sé si dormí mucho, anoche dormí 8 horas')).horasSueno).toBe(8)
  })
  it('«no sé si fue bueno el sueño, dormí 7 horas y media»', () => {
    expect(parche(correr({ sueno_horas: '7 horas y media' }, 'no sé si fue bueno el sueño, dormí 7 horas y media')).horasSueno).toBe(7.5)
  })
  it('el dato primero y el plan después de la coma', () => {
    expect(parche(correr({ sueno_horas: '7 horas' }, 'dormí 7 horas, mañana quiero dormir 8')).horasSueno).toBe(7)
  })
})

describe('lo que ya se descartaba bien sigue descartándose', () => {
  it.each([
    ['normalmente duermo 7 horas', { sueno_horas: '7 horas' }, 'horasSueno'],
    ['siempre camino 10 mil pasos', { pasos: '10 mil pasos' }, 'pasos'],
    ['mañana quiero dormir 8 horas', { sueno_horas: '8 horas' }, 'horasSueno'],
    ['generalmente me acuesto a las 10', { hora_acostarse: 'a las 10' }, 'horaAcostarse'],
    ['suelo levantarme a las 5', { hora_levantarse: 'a las 5' }, 'horaLevantarse'],
    ['no sé si dormí 6 horas', { sueno_horas: '6 horas' }, 'horasSueno'],
    ['mañana camino 12 mil pasos', { pasos: '12 mil pasos' }, 'pasos'],
    ['normalmente me acuesto a las 11 de la noche', { hora_acostarse: 'a las 11 de la noche' }, 'horaAcostarse'],
    ['mi meta son 10 mil pasos', { pasos: '10 mil pasos' }, 'pasos'],
    ['usualmente duermo como 8 horas', { sueno_horas: '8 horas' }, 'horasSueno'],
  ] as const)('«%s»', (frase, ext, clave) => {
    const r = correr(ext, frase)
    expect(parche(r)[clave]).toBeUndefined()
    expect(visible(r)).toBe(true)
  })
  it.each(['siempre tomo 3 litros de agua', 'voy a tomar 2 litros hoy'])('agua «%s»', (frase) => {
    const r = correr({ agua: { cantidad: frase.includes('siempre') ? '3' : '2', medida: 'litros' } }, frase)
    expect(aguaMl(r)).toBe(0)
  })
  it('una coma sin dato propio no corta: «ni idea, 5 mil pasos» sigue igual', () => {
    expect(parche(correr({ pasos: '5 mil pasos' }, 'ni idea, 5 mil pasos')).pasos).toBe(5000)
  })
})
