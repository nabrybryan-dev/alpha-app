import { describe, expect, it } from 'vitest'
import { comprimirSiEsImagen } from './comprimirImagen'

/**
 * jsdom no dibuja en `canvas`, asi que aqui se prueba la DECISION -que se
 * comprime y que se deja pasar-, no el pixelado. El calculo de dimensiones tiene
 * sus propios tests en `domain/adjuntos.test.ts`.
 */
describe('comprimirSiEsImagen', () => {
  it('devuelve el video tal cual, sin tocarlo', async () => {
    const video = new File(['x'], 'v.mp4', { type: 'video/mp4' })
    expect(await comprimirSiEsImagen(video)).toBe(video)
  })

  /**
   * Perder la foto por no poder encogerla seria peor que subirla grande. Ante
   * cualquier fallo, gana el original.
   */
  it('devuelve el original si el navegador no puede dibujar', async () => {
    const foto = new File(['x'], 'f.jpg', { type: 'image/jpeg' })
    expect(await comprimirSiEsImagen(foto)).toBe(foto)
  })
})
