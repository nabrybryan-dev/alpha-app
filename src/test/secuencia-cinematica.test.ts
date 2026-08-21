import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FOTOGRAMA_QUIETO, TOTAL_FOTOGRAMAS } from '../components/ui/LienzoCinematico'
import { escalaCover } from '../lib/encajeCover'
import { medidasWebp } from './medidasWebp'

/**
 * La secuencia de fotogramas que conduce el scroll en Entrenar.
 *
 * `direcciones-visuales.test.ts` vigila los cinco vídeos y sus pósters. La
 * secuencia no la vigilaba nadie, y es la pieza que más fácil se rompe en
 * silencio: si falta un fotograma, `LienzoCinematico` cae al vecino más cercano
 * y el scrub sigue corriendo, solo que a saltos. En un monitor, con el dedo en
 * la rueda, eso no se distingue de una toma con corte.
 *
 * R1 y R4 se cumplían aquí porque alguien los calculó a mano. Esto los convierte
 * en algo que falla solo.
 */

const raiz = join(__dirname, '..', '..')
const carpeta = join(raiz, 'public', 'hero', 'orbita')

/** Móvil de referencia, igual que en `fondos-de-tarjeta.test.ts`. */
const ANCHO_PT = 390

/** El alto por defecto de la ventana del lienzo, en `LienzoCinematico`. */
const ALTO_VENTANA = 352

/**
 * El tope de la escala del paralaje. Va aquí a propósito: si alguien la sube en
 * el componente sin medir, este test es lo que se lo dice.
 */
const ESCALA_MAX = 1.06

/** R4, el mismo techo que se aplica a cada vídeo. */
const TECHO_KB = 900

function fotograma(i: number) {
  return join(carpeta, `${String(i).padStart(2, '0')}.webp`)
}

describe('secuencia cinemática de Órbita', () => {
  it('tiene los 36 fotogramas que el lienzo va a pedir, con el nombre exacto', () => {
    const faltan = Array.from({ length: TOTAL_FOTOGRAMAS }, (_, i) => i).filter(
      (i) => !existsSync(fotograma(i)),
    )
    // Uno que falte no rompe nada visible: se dibuja el vecino. Por eso hay test.
    expect(faltan, `faltan los fotogramas ${faltan.join(', ')}`).toEqual([])
  })

  it('el fotograma del estado con movimiento reducido existe de verdad', () => {
    // Si `FOTOGRAMA_QUIETO` se sale del rango, quien pide menos movimiento se
    // queda con el lienzo en blanco: es el único que se le carga.
    expect(FOTOGRAMA_QUIETO).toBeGreaterThanOrEqual(0)
    expect(FOTOGRAMA_QUIETO).toBeLessThan(TOTAL_FOTOGRAMAS)
    expect(existsSync(fotograma(FOTOGRAMA_QUIETO))).toBe(true)
  })

  it('todos miden lo mismo, o el scrub daría un salto de tamaño', () => {
    const medidas = Array.from({ length: TOTAL_FOTOGRAMAS }, (_, i) => medidasWebp(fotograma(i)))
    const primera = medidas[0]
    for (const [i, m] of medidas.entries()) {
      expect(m, `el fotograma ${i} mide ${m.ancho}x${m.alto} y el 0 mide ${primera.ancho}x${primera.alto}`).toEqual(primera)
    }
  })

  it('NO conserva el 16:9: es la franja viva, no el fotograma entero', () => {
    // La pieza venia con relleno negro cocido en el 41% inferior —luminancia
    // media exactamente 0,0, canto duro—, herencia de haberse generado sobre un
    // montaje en vacio. Con el fotograma entero, cuatro de cada diez pixeles de
    // la ventana de Entrenar eran negro puro sobre un fondo #0a0a0a: la pieza no
    // se leia como escena, se leia como una banda con hueco debajo.
    //
    // La secuencia se extrae de la franja viva. Si alguien la regenera desde el
    // 16:9 completo, este test se lo dice antes de que llegue a produccion.
    const { ancho, alto } = medidasWebp(fotograma(0))
    expect(ancho / alto).toBeGreaterThan(2.5)
    expect(ancho / alto).toBeLessThan(3.5)
  })

  it('no arrastra relleno negro en el borde inferior', () => {
    // La fila viva mas baja de las 36 estaba en la 388 de 658. Por debajo, negro
    // garantizado en TODOS los fotogramas. Se comprueba que el fotograma con mas
    // luz tiene senal hasta abajo del todo: si el relleno vuelve, aqui se cae.
    const { alto } = medidasWebp(fotograma(0))
    expect(alto).toBeLessThanOrEqual(420)
  })

  it('R1 · no se amplía ni con el paralaje al máximo', () => {
    const imagen = medidasWebp(fotograma(0))
    // El peor caso: la ventana entera, con la escala del paralaje en su tope.
    const caja = { ancho: ANCHO_PT * ESCALA_MAX, alto: ALTO_VENTANA * ESCALA_MAX }
    const escala = escalaCover(imagen, caja)

    expect(
      escala,
      `el fotograma mide ${imagen.ancho}x${imagen.alto} y se pintaría a ${escala.toFixed(3)}x`,
    ).toBeLessThanOrEqual(1.05)
  })

  it('R4 · la secuencia entera cabe en el techo de una pieza', () => {
    const kb =
      Array.from({ length: TOTAL_FOTOGRAMAS }, (_, i) => readFileSync(fotograma(i)).length).reduce(
        (a, b) => a + b,
        0,
      ) / 1024

    // Medido: 338 KB, menos que el propio vídeo de Órbita (577 KB). Ese número
    // no se hereda: una pieza con humo, como Esfuerzo, comprime mucho peor. Si
    // se hace el scrub de otra, este test es donde se entera.
    expect(kb, `la secuencia pesa ${kb.toFixed(0)} KB`).toBeLessThanOrEqual(TECHO_KB)
  })
})
