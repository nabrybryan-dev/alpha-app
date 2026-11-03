import { describe, expect, it } from 'vitest'
import { sinCifrasDeKcal } from './textoSinKcal'

/**
 * LA BATERÍA DEL REVISOR CIEGO (ronda 2 de la zona 7, 28-oct).
 *
 * El filtro pasaba sus propias pruebas y la de textos reales, pero un revisor
 * que escribió frases nuevas encontró fugas («Déficit de 500 al día»,
 * «450 cals», «Gasto de 2.300 al día») y borrados de más (la lista numerada que
 * se pegaba, «energía para 3 series», los mililitros tras una frase de kcal).
 * Cada caso va con su salida exacta: no basta con que «no quede kcal», tiene
 * que quedar todo lo demás.
 */
describe('sinCifrasDeKcal · fugas que no puede dejar pasar', () => {
  it.each([
    ['Déficit de 500 al día. Sube la proteína.', 'Sube la proteína.'],
    ['Un superávit de 300 diario. Sube la proteína.', 'Sube la proteína.'],
    ['Un extra de ~450cal. Sube la proteína.', 'Sube la proteína.'],
    ['Son 450 cals. Sube la proteína.', 'Sube la proteína.'],
    ['Plan hipocalórico de 1.500. Sube la proteína.', 'Sube la proteína.'],
    ['Plan calórico de 1500. Sube la proteína.', 'Sube la proteína.'],
    ['Gasto de 2.300 al día. Sube la proteína.', 'Sube la proteína.'],
    ['Ronda las 1.800 diarias. Sube la proteína.', 'Sube la proteína.'],
    ['Son 450 kcal. Te quedas en 380. Y luego 200 más. Sube la proteína.', 'Sube la proteína.'],
  ])('%s', (entrada, salida) => {
    expect(sinCifrasDeKcal(entrada)).toBe(salida)
  })
})

describe('sinCifrasDeKcal · lo que no puede borrar', () => {
  it.each([
    'Tienes energía para 3 series más.',
    'Bebe 500 ml de agua en 20 min.',
    'Toma 250 cc antes de dormir.',
    'Baja al 30 % de grasa.',
    'Si pasas de 38 °C, para.',
    'Mantén 140 lpm en el rodaje.',
    'Camina 8.800 pasos al día.',
  ])('%s', (texto) => {
    expect(sinCifrasDeKcal(texto)).toBe(texto)
  })

  it.each([
    ['Son 450 kcal. Bebe 500 ml de agua.', 'Bebe 500 ml de agua.'],
    ['Son 450 kcal. Baja al 30 % de grasa.', 'Baja al 30 % de grasa.'],
    ['Son 450 kcal. Si pasas de 38 °C, para.', 'Si pasas de 38 °C, para.'],
    ['Son 450 kcal. Mantén 140 lpm.', 'Mantén 140 lpm.'],
    ['Son 450 kcal. Toma 250 cc.', 'Toma 250 cc.'],
  ])('tras una frase de kcal: %s', (entrada, salida) => {
    expect(sinCifrasDeKcal(entrada)).toBe(salida)
  })

  it('una lista numerada pierde solo la línea de kcal y conserva su forma', () => {
    const texto = '1. Desayuno: 450 kcal\n2. Almuerzo: pollo 150 g\n3. Cena: 3 claras'
    expect(sinCifrasDeKcal(texto)).toBe('2. Almuerzo: pollo 150 g\n3. Cena: 3 claras')
  })

  it('una lista numerada sin kcal sale igual', () => {
    const texto = '1. Desayuno: avena 70 g\n2. Almuerzo: pollo 150 g'
    expect(sinCifrasDeKcal(texto)).toBe(texto)
  })
})

/**
 * Ronda 3 del revisor ciego: 73 frases nuevas, 18 fallaban. Van las que el
 * filtro tiene que resolver; la regla de borrar la frase entera («Almuerzo:
 * pollo 150 g (unas 600 kcal)» pierde también los gramos) es decisión ya tomada.
 */
describe('sinCifrasDeKcal · ronda 3, fugas', () => {
  it.each([
    ['Come 1.800 cada día. Bebe agua.', 'Bebe agua.'],
    ['Son 450 kJ. Bebe agua.', 'Bebe agua.'],
    ['Aporta 1.880 kilojulios. Bebe agua.', 'Bebe agua.'],
  ])('%s', (entrada, salida) => {
    expect(sinCifrasDeKcal(entrada)).toBe(salida)
  })
})

describe('sinCifrasDeKcal · ronda 3, lo que no puede borrar', () => {
  it.each([
    'Camina 10.000 al día.',
    'Tu gasto en pasos: 9.000 al día.',
    'Gasto en suplementos: 80.000 pesos.',
    'Corre a 150 bpm.',
    'Mantén 140 pulsaciones por minuto.',
    'Camina 60 segundos.',
    'Sesión 2 x 60 seg.',
    'Revisión el 2026-11-15.',
    'Nos vemos en 2027.',
    'Toma 1000 UI de vitamina D.',
    'Ahorra 20.000 pesos.',
  ])('%s', (texto) => {
    expect(sinCifrasDeKcal(texto)).toBe(texto)
  })

  it.each([
    ['Son 450 kcal. Corre a 150 bpm.', 'Corre a 150 bpm.'],
    ['Son 450 kcal. Camina 60 segundos.', 'Camina 60 segundos.'],
    ['Son 450 kcal. Mantén 140 pulsaciones.', 'Mantén 140 pulsaciones.'],
    ['Son 450 kcal. Llega al 2026 fuerte.', 'Llega al 2026 fuerte.'],
    ['Son 450 kcal. Toma 1000 UI.', 'Toma 1000 UI.'],
    ['Son 450 kcal. Ahorra 20.000 pesos.', 'Ahorra 20.000 pesos.'],
    ['Son 450 kcal.Bebe 500 ml', 'Bebe 500 ml'],
    ['Son aprox. 450 kcal. Bien.', 'Bien.'],
  ])('tras una frase de kcal: %s', (entrada, salida) => {
    expect(sinCifrasDeKcal(entrada)).toBe(salida)
  })

  it('una lista con líneas que terminan en punto no deja una línea en blanco', () => {
    const texto = '1. Desayuno: avena 70 g.\n2. Cena: 600 kcal.\n3. Agua 2 l.'
    expect(sinCifrasDeKcal(texto)).toBe('1. Desayuno: avena 70 g.\n3. Agua 2 l.')
  })

  it('quitar la línea de kcal no pega la línea de antes con la de después', () => {
    const texto = 'Comida 1: arroz. 450 kcal\n- Cena pollo 150 g'
    expect(sinCifrasDeKcal(texto)).toBe('Comida 1: arroz.\n- Cena pollo 150 g')
  })
})
