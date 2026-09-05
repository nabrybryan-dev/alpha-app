import { describe, expect, it } from 'vitest'
import { sinEmoji } from './sinEmoji'
import { frasePorSerie } from '../../frasesMotivacionales'

/**
 * LA SALA NO LLEVA EMOJI, PROBADO.
 *
 * Y la prueba que de verdad importa es la última: se corre sobre las frases DE VERDAD, no
 * sobre ejemplos escritos aquí. Una lista de casos inventados se queda verde el día que
 * alguien añada una frase con un emoji de un bloque que no está en el filtro.
 */

describe('sinEmoji', () => {
  it('quita el pictograma y deja la frase entera', () => {
    expect(sinEmoji('Vas como un crack 🔥')).toBe('Vas como un crack')
    expect(sinEmoji('¡Bien hecho! 💪')).toBe('¡Bien hecho!')
  })

  it('no toca acentos, signos ni mayúsculas: la frase es española', () => {
    expect(sinEmoji('¡Otra menos! 🎯')).toBe('¡Otra menos!')
    expect(sinEmoji('Disciplina Alpha 🖤')).toBe('Disciplina Alpha')
    expect(sinEmoji('Constancia = resultados')).toBe('Constancia = resultados')
  })

  it('NO se come los dígitos, que es el fallo clásico de filtrar por `\\p{Emoji}`', () => {
    // La propiedad `Emoji` casa con 0-9 y con la almohadilla, porque llevan `Emoji=Yes`
    // por los teclados. Filtrando por ahí, «Serie 3 de 4» se queda en «Serie de».
    expect(sinEmoji('Serie 3 de 4 · 80 kg')).toBe('Serie 3 de 4 · 80 kg')
    expect(sinEmoji('#1')).toBe('#1')
  })

  it('deja un solo espacio donde había uno, y no deja cola', () => {
    expect(sinEmoji('Máquina 🦅')).toBe('Máquina')
    expect(sinEmoji('🔥 Arriba 🔥')).toBe('Arriba')
  })

  it('ninguna frase REAL del repo llega con pictograma a la sala', () => {
    // Se recorren las que existen, no ejemplos: si mañana entra una frase con un emoji de
    // otro bloque, esta prueba lo dice y no la pantalla de Bryan.
    for (let i = 0; i < 40; i++) {
      const limpia = sinEmoji(frasePorSerie(i))
      expect(limpia, `«${frasePorSerie(i)}» deja pictograma`).toMatch(/^[^\p{Extended_Pictographic}]*$/u)
      expect(limpia.length, `«${frasePorSerie(i)}» se queda sin texto`).toBeGreaterThan(3)
    }
  })
})
