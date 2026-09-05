import { describe, expect, it } from 'vitest'
import {
  CUANTO_DOMINA_LO_HORIZONTAL,
  duenoDelGesto,
  ejercicioTrasBarrido,
  ejerciciosQueAvanza,
  PIXELES_POR_EJERCICIO,
  PIXELES_QUE_DECIDEN,
} from './gestoHorizontal'

describe('de quién es el gesto', () => {
  it('mientras no se ha movido lo bastante, no es de nadie', () => {
    expect(duenoDelGesto(0, 0)).toBe('sin-decidir')
    expect(duenoDelGesto(PIXELES_QUE_DECIDEN - 1, 4)).toBe('sin-decidir')
  })

  /** Lo que Bryan no podía hacer: deslizar de lado y pasar de ejercicio, sin trucos. */
  it('un deslizamiento horizontal es un barrido, sin tener que hundir el dedo antes', () => {
    expect(duenoDelGesto(40, 6)).toBe('barrido')
    expect(duenoDelGesto(-40, -6)).toBe('barrido')
  })

  it('lo vertical y la diagonal ambigua no son barrido', () => {
    expect(duenoDelGesto(4, 40)).toBe('no-es-barrido')
    expect(duenoDelGesto(30, 30)).toBe('no-es-barrido')
  })

  it('la frontera es la que dice la constante, no un número suelto', () => {
    const dy = 20
    expect(duenoDelGesto(dy * CUANTO_DOMINA_LO_HORIZONTAL + 1, dy)).toBe('barrido')
    expect(duenoDelGesto(dy * CUANTO_DOMINA_LO_HORIZONTAL - 1, dy)).toBe('no-es-barrido')
  })

  /**
   * EL BLOQUEO DE DIRECCIÓN, contado como lo vive el dedo: una vez decidido, quien llama
   * no vuelve a preguntar. Aquí se comprueba lo único que puede decir esta función pura —
   * que el mismo recorrido siempre contesta lo mismo—; que no se vuelva a preguntar es del
   * manejador, y lo prueba `salon.test.tsx`.
   */
  it('el mismo recorrido siempre contesta lo mismo', () => {
    expect(duenoDelGesto(50, 10)).toBe(duenoDelGesto(50, 10))
  })
})

describe('cuántos ejercicios avanza', () => {
  it('por debajo del paso no avanza nada', () => {
    expect(ejerciciosQueAvanza(PIXELES_POR_EJERCICIO - 1)).toBe(0)
    expect(ejerciciosQueAvanza(-(PIXELES_POR_EJERCICIO - 1))).toBe(0)
  })

  it('hacia la izquierda pasa al siguiente, como pasar página', () => {
    expect(ejerciciosQueAvanza(-PIXELES_POR_EJERCICIO)).toBe(1)
    expect(ejerciciosQueAvanza(-400)).toBe(1)
  })

  it('hacia la derecha vuelve al anterior', () => {
    expect(ejerciciosQueAvanza(PIXELES_POR_EJERCICIO)).toBe(-1)
  })

  /** Un arrastre largo no atropella tres ejercicios: cada salto cuesta un paso entero. */
  it('un arrastre de media pantalla avanza UNO, no tres', () => {
    expect(ejerciciosQueAvanza(-390)).toBe(1)
  })
})

describe('a qué ejercicio se llega', () => {
  it('avanza y retrocede dentro de la sesión', () => {
    expect(ejercicioTrasBarrido(0, 1, 5)).toBe(1)
    expect(ejercicioTrasBarrido(3, -1, 5)).toBe(2)
  })

  it('da la vuelta por los dos extremos', () => {
    expect(ejercicioTrasBarrido(4, 1, 5)).toBe(0)
    // Y el que se rompía con un módulo ingenuo: retroceder desde el primero da −1.
    expect(ejercicioTrasBarrido(0, -1, 5)).toBe(4)
  })

  it('con una sesión vacía no revienta', () => {
    expect(ejercicioTrasBarrido(0, 1, 0)).toBe(0)
  })
})
