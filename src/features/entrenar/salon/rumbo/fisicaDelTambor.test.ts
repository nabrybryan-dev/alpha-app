import { describe, expect, it } from 'vitest'
import {
  diaEnLectura,
  DIAS_DEL_TAMBOR,
  encajar,
  giroDelDia,
  inercia,
  PASO,
  VELOCIDAD_MINIMA,
} from './fisicaDelTambor'

/**
 * LA FÍSICA DEL TAMBOR, PROBADA.
 *
 * Lo que se vigila es que el tambor no pueda quedarse entre dos días —ni al soltar, ni al
 * dar varias vueltas, ni al girar hacia arriba—, porque un tambor que para a medio camino
 * abre la sesión del día equivocado sin que nadie lo note.
 */

describe('diaEnLectura', () => {
  it('cada día queda en su fila, ida y vuelta', () => {
    for (let dia = 0; dia < DIAS_DEL_TAMBOR; dia++) {
      expect(diaEnLectura(giroDelDia(dia)), `el día ${dia}`).toBe(dia)
    }
  })

  it('con el tambor girado hacia ARRIBA sigue dando un día real', () => {
    // El resto de un negativo en JavaScript es negativo: `-8 % 7` da `-1`, y un índice de
    // día en −1 no es ningún día. Girando varias vueltas hacia arriba se rompía.
    for (let vueltas = 1; vueltas <= 3; vueltas++) {
      const giro = giroDelDia(2) + 360 * vueltas
      const dia = diaEnLectura(giro)
      expect(dia, `${vueltas} vueltas arriba`).toBe(2)
      expect(dia).toBeGreaterThanOrEqual(0)
    }
  })

  it('varias vueltas hacia abajo devuelven el mismo día', () => {
    expect(diaEnLectura(giroDelDia(5) - 360 * 4)).toBe(5)
  })

  it('a medio camino entre dos filas se queda con la más cercana', () => {
    expect(diaEnLectura(giroDelDia(3) - PASO * 0.4)).toBe(3)
    expect(diaEnLectura(giroDelDia(3) - PASO * 0.6)).toBe(4)
  })
})

describe('encajar', () => {
  it('deja el tambor SIEMPRE en una fila, nunca entre dos', () => {
    for (const suelto of [0, 12.3, -51.7, 180.4, -359.9, 721.2]) {
      const puesto = encajar(suelto)
      expect(Math.abs(puesto / PASO - Math.round(puesto / PASO)), `soltado en ${suelto}`).toBeLessThan(1e-9)
    }
  })

  it('no se va a la fila de al lado por un pelo', () => {
    expect(encajar(giroDelDia(2) + 1)).toBeCloseTo(giroDelDia(2), 6)
  })
})

describe('inercia', () => {
  it('frena y acaba parando, siempre', () => {
    let giro = 0
    let v = 40
    let pasos = 0
    for (;;) {
      const siguiente = inercia(giro, v)
      if (!siguiente) break
      giro = siguiente.giro
      v = siguiente.velocidad
      pasos += 1
      // Sin techo, un rozamiento mal puesto colgaría el bucle de animación del navegador.
      expect(pasos, 'la inercia no para').toBeLessThan(500)
    }
    expect(Math.abs(v)).toBeLessThan(VELOCIDAD_MINIMA)
  })

  it('un soltar sin velocidad no mueve nada', () => {
    expect(inercia(120, 0)).toBeNull()
    expect(inercia(120, VELOCIDAD_MINIMA / 2)).toBeNull()
  })

  it('gira en el sentido en que se tiró', () => {
    expect(inercia(0, 10)?.giro).toBeGreaterThan(0)
    expect(inercia(0, -10)?.giro).toBeLessThan(0)
  })
})
