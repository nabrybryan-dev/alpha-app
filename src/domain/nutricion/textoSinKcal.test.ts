import { describe, expect, it } from 'vitest'
import { sinCifrasDeKcal } from './textoSinKcal'

/**
 * El interruptor de kcal también manda sobre la prosa del coach.
 *
 * Lo que se comprueba es que la cifra desaparece sin que el texto empiece a
 * decir cosas que nadie firmó: se borra la frase que habla de kcal y se conserva
 * el resto tal cual.
 */
describe('sinCifrasDeKcal', () => {
  it('quita la frase del análisis que lleva kcal y deja el objetivo intacto', () => {
    const analisis =
      'TDEE estimado en 2050 kcal con NEAT medio (9-10k pasos). Objetivo: recomposición con déficit ligero ondulado.'
    expect(sinCifrasDeKcal(analisis)).toBe(
      'Objetivo: recomposición con déficit ligero ondulado.',
    )
  })

  it('en una nota de receta borra solo la frase de las kcal', () => {
    const nota =
      'La mozzarella sola son 148 de las 445 kcal. Bájala a 30 g y te quedas cerca de 380 sin tocar el atún.'
    expect(sinCifrasDeKcal(nota)).toBe(
      'Bájala a 30 g y te quedas cerca de 380 sin tocar el atún.',
    )
  })

  it('también reconoce «kilocalorías» escrito con todas las letras', () => {
    expect(sinCifrasDeKcal('Aporta 120 kilocalorías. Llévalo al desayuno.')).toBe(
      'Llévalo al desayuno.',
    )
  })

  it('un texto sin kcal no se toca', () => {
    const texto = 'Sube la proteína a 1,9 g/kg y camina 9.000 pasos.'
    expect(sinCifrasDeKcal(texto)).toBe(texto)
  })

  it('si todo el texto era de kcal, devuelve vacío para que no se pinte', () => {
    expect(sinCifrasDeKcal('Es la más pesada de las seis: 569 kcal.')).toBe('')
  })

  it('no confunde los gramos ni los porcentajes con calorías', () => {
    const texto = '30 g de proteína, 8 % de grasa y 2 g de sal.'
    expect(sinCifrasDeKcal(texto)).toBe(texto)
  })

  it('no parte un decimal por el punto: 30.5 g sigue siendo una sola frase', () => {
    const texto = 'Baja a 30.5 g la mozzarella. Son 120 kcal menos.'
    expect(sinCifrasDeKcal(texto)).toBe('Baja a 30.5 g la mozzarella.')
  })
})
