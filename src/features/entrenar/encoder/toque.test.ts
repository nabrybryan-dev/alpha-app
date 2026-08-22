import { describe, expect, it } from 'vitest'
import { puntoDeLaImagen } from './toque'

/**
 * La caja del visor es 4:3. Un teléfono en vertical entrega 9:16, así que la
 * imagen ocupa una franja estrecha en el centro con bandas negras a los lados.
 * Números del caso real: caja de 390 x 292, imagen de 640 x 1138 (el lienzo se
 * procesa a 640 de ancho).
 */
const CAJA_ANCHO = 390
const CAJA_ALTO = 292
const IMG_ANCHO = 640
const IMG_ALTO = 1138

/** Lo que hacía el código anterior: regla de tres sobre la caja entera. */
function comoAntes(xEnCaja: number, yEnCaja: number) {
  return {
    x: Math.round((xEnCaja / CAJA_ANCHO) * IMG_ANCHO),
    y: Math.round((yEnCaja / CAJA_ALTO) * IMG_ALTO),
  }
}

describe('puntoDeLaImagen', () => {
  it('el centro de la caja es el centro de la imagen', () => {
    const p = puntoDeLaImagen(CAJA_ANCHO / 2, CAJA_ALTO / 2, CAJA_ANCHO, CAJA_ALTO, IMG_ANCHO, IMG_ALTO)
    expect(p).toEqual({ x: IMG_ANCHO / 2, y: IMG_ALTO / 2 })
  })

  it('el centro era lo ÚNICO que acertaba antes, y por eso el fallo costó verlo', () => {
    expect(comoAntes(CAJA_ANCHO / 2, CAJA_ALTO / 2)).toEqual({ x: IMG_ANCHO / 2, y: IMG_ALTO / 2 })
  })

  it('un toque en el borde izquierdo de la IMAGEN da la columna 0, no un punto de dentro', () => {
    // La imagen mide 292 * 9/16 = 164,25 px de ancho en pantalla, centrada:
    // empieza en (390 - 164,25) / 2 = 112,875.
    const bordeIzq = (CAJA_ANCHO - CAJA_ALTO * (IMG_ANCHO / IMG_ALTO)) / 2
    expect(puntoDeLaImagen(bordeIzq, CAJA_ALTO / 2, CAJA_ANCHO, CAJA_ALTO, IMG_ANCHO, IMG_ALTO)?.x).toBe(0)
    // Antes ese mismo toque devolvía un punto muy adentro de la imagen.
    expect(comoAntes(bordeIzq, CAJA_ALTO / 2).x).toBeGreaterThan(180)
  })

  it('tocar el disco a un cuarto de la imagen caía FUERA con la cuenta vieja', () => {
    const bordeIzq = (CAJA_ANCHO - CAJA_ALTO * (IMG_ANCHO / IMG_ALTO)) / 2
    const anchoEnPantalla = CAJA_ANCHO - bordeIzq * 2
    const unCuarto = bordeIzq + anchoEnPantalla * 0.25

    expect(puntoDeLaImagen(unCuarto, CAJA_ALTO / 2, CAJA_ANCHO, CAJA_ALTO, IMG_ANCHO, IMG_ALTO)?.x).toBe(160)
    // La cuenta vieja apuntaba 93 px a la derecha: pasado el centro de la
    // imagen, cuando el dedo estaba en el primer cuarto. Un disco de 100 px de
    // radio no sobrevive a ese desplazamiento.
    expect(comoAntes(unCuarto, CAJA_ALTO / 2).x).toBe(253)
  })

  it('la banda negra no es imagen: devuelve null en vez de fijar un punto inventado', () => {
    expect(puntoDeLaImagen(5, CAJA_ALTO / 2, CAJA_ANCHO, CAJA_ALTO, IMG_ANCHO, IMG_ALTO)).toBeNull()
    expect(puntoDeLaImagen(CAJA_ANCHO - 5, CAJA_ALTO / 2, CAJA_ANCHO, CAJA_ALTO, IMG_ANCHO, IMG_ALTO)).toBeNull()
  })

  it('con la imagen apaisada las bandas se van arriba y abajo, y la cuenta sigue', () => {
    // 16:9 dentro de la misma caja 4:3: llena el ancho, sobra alto.
    const alto = (CAJA_ANCHO * 720) / 1280
    const margen = (CAJA_ALTO - alto) / 2
    expect(puntoDeLaImagen(CAJA_ANCHO / 2, margen, CAJA_ANCHO, CAJA_ALTO, 1280, 720)?.y).toBe(0)
    expect(puntoDeLaImagen(CAJA_ANCHO / 2, 2, CAJA_ANCHO, CAJA_ALTO, 1280, 720)).toBeNull()
  })

  it('si la imagen llena la caja exacta, el toque se traduce sin margen', () => {
    expect(puntoDeLaImagen(0, 0, 400, 300, 800, 600)).toEqual({ x: 0, y: 0 })
    expect(puntoDeLaImagen(400, 300, 400, 300, 800, 600)).toBeNull() // el borde ya no es píxel
    expect(puntoDeLaImagen(200, 150, 400, 300, 800, 600)).toEqual({ x: 400, y: 300 })
  })

  it('una caja sin medidas todavía no puede responder', () => {
    expect(puntoDeLaImagen(10, 10, 0, 0, IMG_ANCHO, IMG_ALTO)).toBeNull()
    expect(puntoDeLaImagen(10, 10, CAJA_ANCHO, CAJA_ALTO, 0, 0)).toBeNull()
  })
})
