import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acusarToque } from './acusarToque'

/**
 * El anillo es un adorno, y por eso lo que hay que probar no es cómo se ve: es
 * que **no se meta en la ruta de medida**.
 *
 * Esta pantalla es la que fija el disco de la barra, o sea de donde sale la
 * escala en milímetros de toda la medición. Un adorno pintado dentro del lienzo
 * sería ruido en la imagen que el bucle lee; un adorno que se queda clavado
 * taparía justo lo que hay que mirar.
 */

function escena() {
  const caja = document.createElement('div')
  const lienzo = document.createElement('canvas')
  caja.appendChild(lienzo)
  document.body.appendChild(caja)
  // jsdom no maqueta: la caja del lienzo es todo ceros si no se finge.
  lienzo.getBoundingClientRect = () =>
    ({ left: 100, top: 50, width: 400, height: 300 }) as DOMRect
  return { caja, lienzo }
}

describe('el acuse del toque', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('el anillo es HERMANO del lienzo, nunca va dentro', () => {
    // Lo que se pinta en el lienzo lo lee el bucle de captura. Un adorno ahí
    // dentro es ruido en la imagen que se mide.
    const { caja, lienzo } = escena()
    acusarToque(lienzo, 300, 200)
    const anillo = caja.querySelector('span[aria-hidden]')
    expect(anillo).toBeTruthy()
    expect(anillo?.parentElement).toBe(caja)
  })

  it('se coloca con las coordenadas CRUDAS del evento', () => {
    // Y no con la salida de `puntoDeLaImagen`: el adorno no toca la conversión
    // de coordenadas ni la necesita, así que no puede desplazarla.
    // 300 - 100 (left) - 22 (medio anillo) = 178.
    const { caja, lienzo } = escena()
    acusarToque(lienzo, 300, 200)
    const anillo = caja.querySelector('span[aria-hidden]') as HTMLElement
    expect(anillo.style.left).toBe('178px')
    expect(anillo.style.top).toBe('128px')
  })

  it('no intercepta el toque siguiente', () => {
    // Se monta encima del lienzo que recibe el toque de fijar el disco. Si se lo
    // comiera, el segundo toque no llegaría y nadie sabría por qué.
    const { caja, lienzo } = escena()
    acusarToque(lienzo, 300, 200)
    const anillo = caja.querySelector('span[aria-hidden]') as HTMLElement
    expect(anillo.style.pointerEvents).toBe('none')
  })

  it('se retira solo, y por RELOJ', () => {
    // No encadenando `.finished`: esa promesa puede no resolver nunca —una
    // pestaña en segundo plano, un navegador sin la API— y el anillo se quedaría
    // clavado sobre la imagen que hay que medir.
    const { caja, lienzo } = escena()
    acusarToque(lienzo, 300, 200)
    expect(caja.querySelectorAll('span[aria-hidden]')).toHaveLength(1)
    vi.advanceTimersByTime(200)
    expect(caja.querySelectorAll('span[aria-hidden]')).toHaveLength(0)
  })

  it('se retira IGUAL si el navegador no sabe animar', () => {
    const original = Element.prototype.animate
    // @ts-expect-error se retira a propósito para simular ese navegador
    delete Element.prototype.animate
    try {
      const { caja, lienzo } = escena()
      acusarToque(lienzo, 300, 200)
      vi.advanceTimersByTime(200)
      expect(caja.querySelectorAll('span[aria-hidden]')).toHaveLength(0)
    } finally {
      Element.prototype.animate = original
    }
  })

  it('varios toques seguidos no se apilan en pantalla', () => {
    const { caja, lienzo } = escena()
    acusarToque(lienzo, 300, 200)
    acusarToque(lienzo, 310, 210)
    acusarToque(lienzo, 320, 220)
    expect(caja.querySelectorAll('span[aria-hidden]')).toHaveLength(3)
    vi.advanceTimersByTime(200)
    expect(caja.querySelectorAll('span[aria-hidden]')).toHaveLength(0)
  })
})
