import { describe, expect, it } from 'vitest'
import { comoTextoPlano, esNegrita, sinAsteriscos, tramosDeNegrita } from './negritasFicha'

describe('comoTextoPlano', () => {
  it('quita los asteriscos de la vista previa', () => {
    // El bug real: la barra del coach en Hoy enseñaba los asteriscos crudos,
    // mientras el hilo del chat pintaba la misma frase en negrita.
    expect(
      comoTextoPlano('Depende de dónde duela. **Si duele la articulación** para y avísame.'),
    ).toBe('Depende de dónde duela. Si duele la articulación para y avísame.')
  })

  it('deja intacto el texto sin marcas', () => {
    expect(comoTextoPlano('Buenos días, ¿cómo amaneciste?')).toBe('Buenos días, ¿cómo amaneciste?')
  })

  it('resuelve varias negritas en la misma frase', () => {
    expect(comoTextoPlano('**Una** cosa y **otra** más')).toBe('Una cosa y otra más')
  })

  it('no toca los asteriscos sueltos ni los pares vacíos', () => {
    expect(comoTextoPlano('3 * 4 = 12')).toBe('3 * 4 = 12')
    expect(comoTextoPlano('mira esto ** y esto')).toBe('mira esto ** y esto')
    expect(comoTextoPlano('****')).toBe('****')
  })

  it('no cruza saltos de línea', () => {
    // Un asterisco abierto en una línea no debe comerse la siguiente.
    expect(comoTextoPlano('primera **linea\nsegunda** linea')).toBe('primera **linea\nsegunda** linea')
  })
})

describe('tramosDeNegrita', () => {
  it('parte el texto conservando todo el contenido', () => {
    const original = 'antes **dentro** después'
    const tramos = tramosDeNegrita(original)
    expect(tramos.join('')).toBe(original)
    expect(tramos.filter(esNegrita)).toEqual(['**dentro**'])
  })
})

describe('sinAsteriscos', () => {
  it('desenvuelve solo lo que es negrita', () => {
    expect(sinAsteriscos('**hola**')).toBe('hola')
    expect(sinAsteriscos('hola')).toBe('hola')
    expect(sinAsteriscos('****')).toBe('****')
  })
})
