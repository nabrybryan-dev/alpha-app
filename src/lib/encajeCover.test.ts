import { describe, expect, it } from 'vitest'
import { encajeCover, escalaCover } from './encajeCover'

/** La ventana de Entrenar en el móvil de referencia, en píxeles CSS. */
const VENTANA_ENTRENAR = { ancho: 390, alto: 352 }

/** Un fotograma de la secuencia de Órbita: 1280x720 reescalado a 1170. */
const FOTOGRAMA = { ancho: 1170, alto: 658 }

describe('encajeCover', () => {
  it('cubre la ventana de Entrenar sin dejar banda negra', () => {
    const { ancho, alto } = encajeCover(FOTOGRAMA, VENTANA_ENTRENAR)

    // Este es el test que faltaba. La versión con la condición invertida daba
    // 390x219 y dejaba 66 px de negro arriba y abajo: la banda 16:9 que este
    // trabajo elimina, reaparecida por un signo.
    expect(ancho).toBeGreaterThanOrEqual(VENTANA_ENTRENAR.ancho)
    expect(alto).toBeGreaterThanOrEqual(VENTANA_ENTRENAR.alto)
  })

  it('recorta por los lados cuando la pieza es más ancha que la ventana', () => {
    const { ancho, alto } = encajeCover(FOTOGRAMA, VENTANA_ENTRENAR)
    expect(alto).toBeCloseTo(352, 0)
    expect(ancho).toBeCloseTo(626, 0)
  })

  it('recorta por arriba y por abajo cuando la ventana es más ancha que la pieza', () => {
    // Un móvil en horizontal, o la misma pieza en una ventana apaisada.
    const { ancho, alto } = encajeCover(FOTOGRAMA, { ancho: 844, alto: 390 })
    expect(ancho).toBeCloseTo(844, 0)
    expect(alto).toBeCloseTo(475, 0)
  })

  it('no deforma: las dos medidas salen de la misma escala', () => {
    const encajado = encajeCover(FOTOGRAMA, VENTANA_ENTRENAR)
    const razonOriginal = FOTOGRAMA.ancho / FOTOGRAMA.alto
    expect(encajado.ancho / encajado.alto).toBeCloseTo(razonOriginal, 6)
  })

  it('devuelve la imagen tal cual cuando ya encaja exacta', () => {
    expect(encajeCover(FOTOGRAMA, FOTOGRAMA)).toEqual(FOTOGRAMA)
  })
})

describe('escalaCover', () => {
  it('no amplía el fotograma en la ventana de Entrenar', () => {
    // 0,535: la pieza se reduce, no se estira. R1 se cumple con margen de sobra.
    expect(escalaCover(FOTOGRAMA, VENTANA_ENTRENAR)).toBeLessThanOrEqual(1.05)
  })

  it('delata una ampliación', () => {
    // La tarjeta casi cuadrada de Sesión, en píxeles CSS: aquí la pieza se
    // estiraría, y por eso las piezas no van en esas tarjetas.
    expect(escalaCover(FOTOGRAMA, { ancho: 358, alto: 334 })).toBeGreaterThan(0.5)
    expect(escalaCover({ ancho: 341, alto: 512 }, { ancho: 390, alto: 844 })).toBeGreaterThan(1.05)
  })
})
