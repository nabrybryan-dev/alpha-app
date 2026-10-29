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
