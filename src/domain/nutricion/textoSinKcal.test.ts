import { describe, expect, it } from 'vitest'
import { sinCifrasDeKcal } from './textoSinKcal'

/**
 * El interruptor de kcal también manda sobre la prosa del coach.
 *
 * Lo que se comprueba es que la cifra desaparece sin que el texto empiece a
 * decir cosas que nadie firmó: se borra la frase que habla de kcal y se conserva
 * el resto tal cual. «Cifra» incluye las formas que se colaban antes: la unidad
 * pegada al número, «calorías» escrito con todas las letras, un TDEE y la cifra
 * suelta que continúa una frase de energía («te quedas cerca de 380»).
 */
describe('sinCifrasDeKcal', () => {
  it('quita la frase del análisis que lleva kcal y deja el objetivo intacto', () => {
    const analisis =
      'TDEE estimado en 2050 kcal con NEAT medio (9-10k pasos). Objetivo: recomposición con déficit ligero ondulado.'
    expect(sinCifrasDeKcal(analisis)).toBe(
      'Objetivo: recomposición con déficit ligero ondulado.',
    )
  })

  it('en una nota de receta quita la frase de kcal y también la cifra suelta que la continúa', () => {
    const nota =
      'La mozzarella sola son 148 de las 445 kcal. Bájala a 30 g y te quedas cerca de 380 sin tocar el atún.'
    expect(sinCifrasDeKcal(nota)).toBe('')
  })

  it('también reconoce «kilocalorías» escrito con todas las letras', () => {
    expect(sinCifrasDeKcal('Aporta 120 kilocalorías. Llévalo al desayuno.')).toBe(
      'Llévalo al desayuno.',
    )
  })

  it('reconoce la cifra de «calorías» con todas las letras', () => {
    expect(sinCifrasDeKcal('El plan trae 1.800 calorías al día. Sube la proteína.')).toBe(
      'Sube la proteína.',
    )
  })

  it('reconoce la unidad pegada al número: «2100kcal»', () => {
    expect(sinCifrasDeKcal('Son 2100kcal. Bebe agua.')).toBe('Bebe agua.')
  })

  it('reconoce el TDEE aunque no diga kcal', () => {
    expect(sinCifrasDeKcal('TDEE ~2.050 con NEAT medio. Objetivo: recomposición.')).toBe(
      'Objetivo: recomposición.',
    )
  })

  it('reconoce la abreviatura «cal» después de una cifra', () => {
    expect(sinCifrasDeKcal('Un extra de ~450 cal. Llévalo al desayuno.')).toBe(
      'Llévalo al desayuno.',
    )
  })

  it('quita la cifra sin unidad cuando la frase anterior ya hablaba de energía', () => {
    const texto = 'Esa ración son 430 kcal. Si la dejas en 380 sigues cubriendo la proteína.'
    expect(sinCifrasDeKcal(texto)).toBe('')
  })

  it('un texto sin kcal no se toca', () => {
    const texto = 'Sube la proteína a 1,9 g/kg y camina 9.000 pasos.'
    expect(sinCifrasDeKcal(texto)).toBe(texto)
  })

  it('no confunde gramos, minutos, series, porciones ni pasos con calorías', () => {
    const texto = '150 g de pollo, 20 min al horno, 3 series de 12, 2 porciones y 9.000 pasos.'
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

  it('conserva las frases de los lados de una elipsis', () => {
    const texto = '¿Hambre? No pasa nada, son 200 kcal extra… Sigue.'
    expect(sinCifrasDeKcal(texto)).toBe('¿Hambre? Sigue.')
  })

  it('conserva los saltos de línea de una lista al quitar una de sus líneas', () => {
    const texto = 'Desayuno: avena 70 g\nAlmuerzo: 450 kcal aprox\nCena: pollo 150 g…'
    expect(sinCifrasDeKcal(texto)).toBe('Desayuno: avena 70 g\nCena: pollo 150 g…')
  })

  it('una lista sin kcal conserva sus saltos de línea tal cual', () => {
    const texto = 'Desayuno: avena 70 g\nAlmuerzo: pollo 150 g\nCena: 3 claras'
    expect(sinCifrasDeKcal(texto)).toBe(texto)
  })

  it('también parte por punto y coma', () => {
    expect(sinCifrasDeKcal('Avena 70 g; 450 kcal; pollo 150 g')).toBe('Avena 70 g; pollo 150 g')
  })
})
