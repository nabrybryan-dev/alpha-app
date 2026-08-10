import { describe, expect, it } from 'vitest'
import { LARGO_TITULAR, titular } from './titular'

/**
 * El caso real que obligó a escribir esto: los `cues` de producción son manuales
 * con secciones —«IMPLEMENTO: … MONTAJE: … POSICIÓN: …»—, de 102 caracteres de
 * media y hasta 718 (medido el 2026-08-09 sobre los 506 ejercicios activos). En
 * la ventana del gabinete va el titular; el texto entero sigue en su desplegable.
 */
describe('titular', () => {
  it('deja intacto lo que ya cabe', () => {
    expect(titular('Cadera atrás, espalda neutra')).toBe('Cadera atrás, espalda neutra')
  })

  it('corta por palabra y nunca parte una a la mitad', () => {
    const largo =
      'IMPLEMENTO: polea BAJA, la más cerca del suelo, con tobillera. MONTAJE: la tobillera justo encima del tobillo.'
    const t = titular(largo)
    expect(t.length).toBeLessThanOrEqual(LARGO_TITULAR + 1) // +1: los puntos suspensivos
    expect(t.endsWith('…')).toBe(true)
    // Lo que queda son palabras enteras del original, en su orden.
    expect(largo.startsWith(t.slice(0, -1))).toBe(true)
  })

  it('no deja un signo de puntuación colgando antes de los puntos suspensivos', () => {
    const t = titular(
      'ES NUEVO ESTA SEMANA, Y ES TU EJERCICIO MÁS EXIGENTE TÉCNICAMENTE. IMPLEMENTO: una mancuerna.',
    )
    expect(t).not.toMatch(/[\s.,;:·—-]…$/)
  })

  it('aplasta los saltos de línea y los espacios dobles', () => {
    expect(titular('  Cadera   atrás,\n espalda  neutra ')).toBe('Cadera atrás, espalda neutra')
  })

  it('una sola palabra larguísima se corta igual, aunque no haya dónde', () => {
    const t = titular('A'.repeat(120))
    expect(t).toBe(`${'A'.repeat(LARGO_TITULAR)}…`)
  })

  it('el largo se puede ajustar por si otro sitio tiene menos hueco', () => {
    expect(titular('uno dos tres cuatro cinco', 12)).toBe('uno dos…')
  })
})
