import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DIRECCIONES } from '../../lib/direccionesVisuales'
import { RolloDePelicula } from './RolloDePelicula'

/**
 * R6 · SOLO SUENA UNA. Es la regla que sostiene el rollo, y hasta ahora no la
 * comprobaba nadie: cinco vídeos de 1280x720 descomprimiendo a la vez en la
 * misma pantalla no se ve como un fallo —se ve como que el móvil va lento—.
 *
 * jsdom no trae `IntersectionObserver`, así que se sustituye por uno de mentira
 * que guarda la llamada. Eso permite decir «ahora la tercera cruza la línea
 * central» sin simular scroll, que en jsdom no existe.
 */

type Suscriptor = (entradas: { target: Element; isIntersecting: boolean }[]) => void

let avisar: Suscriptor | null = null
let observados: Element[] = []

function montarObservador() {
  avisar = null
  observados = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: Suscriptor) {
        avisar = cb
      }
      observe(nodo: Element) {
        observados.push(nodo)
      }
      disconnect() {}
      unobserve() {}
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

/** jsdom no implementa play/pause: los deja como métodos que lanzan. */
function espiarVideos() {
  const play = vi.fn(() => Promise.resolve())
  const pause = vi.fn()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause)
  return { play, pause }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('RolloDePelicula', () => {
  it('enseña las cinco piezas, cada una con su ficha', () => {
    montarObservador()
    conMovimiento(false)
    espiarVideos()
    render(<RolloDePelicula />)

    for (const d of DIRECCIONES) {
      expect(screen.getByText(d.nombre)).toBeInTheDocument()
      // La duración sale medida del archivo, no estimada: si alguien la
      // sustituye por un número redondo inventado, esto lo caza.
      expect(screen.getAllByText(`${d.duracionS.toFixed(1)} s`).length).toBeGreaterThan(0)
    }
  })

  it('observa las cinco, para saber cuál cruza la línea central', () => {
    montarObservador()
    conMovimiento(false)
    espiarVideos()
    render(<RolloDePelicula />)

    expect(observados).toHaveLength(DIRECCIONES.length)
  })

  it('R6 · al entrar la tercera en la ventana, las otras cuatro se pausan', () => {
    montarObservador()
    conMovimiento(false)
    const { play, pause } = espiarVideos()
    render(<RolloDePelicula />)

    play.mockClear()
    pause.mockClear()

    // La tercera cruza la línea de un píxel del centro del viewport. Va dentro
    // de `act` porque el aviso del observador cambia estado de React, y sin
    // envolverlo la aserción se leería antes de que el efecto se aplique.
    act(() => {
      avisar?.([{ target: observados[2], isIntersecting: true }])
    })

    expect(play, 'solo debería reproducir la centrada').toHaveBeenCalledTimes(1)
    expect(pause, 'las otras cuatro quedan en su póster').toHaveBeenCalledTimes(
      DIRECCIONES.length - 1,
    )
  })

  it('R5 · con movimiento reducido no hay ni un vídeo que pausar', () => {
    montarObservador()
    conMovimiento(true)
    espiarVideos()
    const { container } = render(<RolloDePelicula />)

    // `FondoLoop` no monta el elemento: se ven los cinco pósters y la ventana
    // sigue marcando cuál se mira. Se pierde el bucle, no la composición.
    expect(container.querySelectorAll('video')).toHaveLength(0)
    expect(screen.getByText(DIRECCIONES[0].nombre)).toBeInTheDocument()
  })
})
