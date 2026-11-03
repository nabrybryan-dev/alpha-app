import { describe, expect, it } from 'vitest'
import { caraQueSeVe, destinoDeLaVuelta, etiquetaDeLaVuelta } from './vueltaDelCuerpo'

describe('dar la vuelta: de frente a espalda y al revés', () => {
  it('cerca de 0 grados se ve el frente; cerca de 180, la espalda (también con vueltas de más)', () => {
    expect(caraQueSeVe(0)).toBe('frente')
    expect(caraQueSeVe(80)).toBe('frente')
    expect(caraQueSeVe(100)).toBe('espalda')
    expect(caraQueSeVe(-170)).toBe('espalda')
    expect(caraQueSeVe(350)).toBe('frente')
    expect(caraQueSeVe(540)).toBe('espalda')
  })
  it('el destino es la cara contraria a la que se ve ahora, la más cercana en sentido contrario', () => {
    expect(destinoDeLaVuelta(0)).toBe(180)
    expect(destinoDeLaVuelta(30)).toBe(180)
    expect(destinoDeLaVuelta(170)).toBe(0)
    expect(destinoDeLaVuelta(-100)).toBe(0)
  })
  it('el destino de una espalda ya girada de más se queda cerca del ángulo actual (no da una vuelta entera)', () => {
    expect(destinoDeLaVuelta(400)).toBe(540)
    expect(destinoDeLaVuelta(500)).toBe(360)
  })
  it('la etiqueta dice qué se ve ahora y a dónde lleva', () => {
    expect(etiquetaDeLaVuelta(0)).toBe('Dar la vuelta: ahora se ve el frente, pasa a la espalda')
    expect(etiquetaDeLaVuelta(180)).toBe('Dar la vuelta: ahora se ve la espalda, pasa al frente')
  })
})
