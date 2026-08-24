import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FOTOGRAMA_QUIETO, LienzoCinematico, TOTAL_FOTOGRAMAS } from './LienzoCinematico'

/**
 * R5 · CON MENOS MOVIMIENTO NO SE PIDEN LOS OTROS 35.
 *
 * El spec del 20-08-2026 dejó esto anotado como lo único que faltaba cubrir del
 * componente: su aritmética la protege `encajeCover` y su material
 * `secuencia-cinematica`, pero nadie comprobaba la carga.
 *
 * El modo de fallo es silencioso y caro. Si la guarda de `movimientoReducido`
 * desaparece del efecto, quien pidió menos movimiento **ve exactamente lo mismo**
 * —la pieza sigue congelada en el 14, porque eso lo decide `dibujar`— y aun así
 * se descargan y decodifican 35 WebP que no va a mirar nadie. No hay error, no
 * hay diferencia visible: solo 338 KB y el trabajo de decodificarlos, en un móvil
 * de gimnasio con mala cobertura.
 *
 * Se espía `Image` porque es la única forma de ver lo que NO se pide. jsdom no
 * descarga nada, así que asignar `src` es todo el rastro que existe.
 */

let pedidos: string[] = []

/** Sustituye `Image` por una que apunta lo que se le pide y se da por cargada. */
function espiarImagenes() {
  pedidos = []
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      decoding = 'async'
      width = 1280
      height = 720
      private ruta = ''

      set src(valor: string) {
        this.ruta = valor
        pedidos.push(valor)
        // El componente encadena los 35 restantes con `.then()`: cada uno solo
        // arranca cuando el anterior resuelve. Resolver en una microtarea imita
        // esa cadena sin esperar a la red.
        queueMicrotask(() => this.onload?.())
      }

      get src() {
        return this.ruta
      }
    },
  )
}

/** Movimiento normal salvo que se pida lo contrario. */
function conMovimiento(reducido: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: reducido,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
}

/** Vacía la cola de microtareas, que es por donde viaja la carga encadenada. */
async function asentar(vueltas = 400) {
  for (let i = 0; i < vueltas; i++) await Promise.resolve()
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('LienzoCinematico', () => {
  it('con movimiento reducido pide un solo fotograma, el quieto', async () => {
    espiarImagenes()
    conMovimiento(true)

    render(<LienzoCinematico secuencia="orbita" altura={352} />)
    await asentar()

    expect(pedidos).toEqual([`/hero/orbita/${String(FOTOGRAMA_QUIETO).padStart(2, '0')}.webp`])
  })

  it('con movimiento normal acaba pidiendo los 36, y el quieto primero', async () => {
    espiarImagenes()
    conMovimiento(false)

    render(<LienzoCinematico secuencia="orbita" altura={352} />)

    // El quieto va delante a propósito: es lo que se ve si la red se corta a
    // mitad. Se comprueba antes de esperar al resto.
    await waitFor(() => expect(pedidos.length).toBeGreaterThan(0))
    expect(pedidos[0]).toBe(`/hero/orbita/${String(FOTOGRAMA_QUIETO).padStart(2, '0')}.webp`)

    await waitFor(() => expect(pedidos).toHaveLength(TOTAL_FOTOGRAMAS))
    expect(new Set(pedidos).size).toBe(TOTAL_FOTOGRAMAS)
  })

  it('la ruta la manda la secuencia, no una constante escrita a mano', async () => {
    espiarImagenes()
    conMovimiento(true)

    render(<LienzoCinematico secuencia="despiece" altura={352} />)
    await asentar()

    expect(pedidos[0]).toBe(`/hero/despiece/${String(FOTOGRAMA_QUIETO).padStart(2, '0')}.webp`)
  })
})
