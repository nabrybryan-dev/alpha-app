import { fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Malla } from '../../../../domain/patrones/malla'
import { REGIONES } from '../../sujeto/regiones'
import { UMBRAL_DE_TOQUE_PX, type CamaraParaElToque, type ParteDelCuerpo } from '../../sujeto/regionBajoElToque'
import { useToqueSobreElCuerpo } from './useToqueSobreElCuerpo'

/**
 * TOCAR EL CUERPO PARA ELEGIR UNA REGIÓN: el umbral entre «toque» y «arrastre» y lo que no
 * debe elegir nada. La geometría del rayo está probada aparte (`regionBajoElToque.test.ts`).
 */

// jsdom no trae PointerEvent: sin él `clientX` se pierde.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventDeprueba extends MouseEvent {
    pointerId: number
    constructor(tipo: string, init: PointerEventInit = {}) {
      super(tipo, init)
      this.pointerId = init.pointerId ?? 1
    }
  }
  Object.defineProperty(window, 'PointerEvent', { value: PointerEventDeprueba, configurable: true })
}

const A = REGIONES[0].id
const CAMARA: CamaraParaElToque = { azimut: 0, elevacion: 0, distancia: 3, centro: [0, 1, 0], campo: 0.6 }
// El lienzo mide 400x800 y el cuerpo ocupa su centro: el píxel (200, 400) mira al centro de la cámara.
const RECT = { left: 0, top: 0, width: 400, height: 800, right: 400, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }

function cuadroAlCentro(): Malla {
  const m = new Malla(8)
  for (const [x, y] of [[-0.4, 0.6], [0.4, 0.6], [0.4, 1.4], [-0.4, 1.4]]) m.vertice([x, y, 0], [0, 0, 1], [1, 1, 1], 0)
  m.cuadro(0, 1, 2, 3)
  return m
}
const PARTES: ParteDelCuerpo[] = [{ malla: cuadroAlCentro(), region: A }]

function Montaje({ activo = true, alTocar }: { activo?: boolean; alTocar: (r: string) => void }) {
  const ancla = useRef<HTMLDivElement>(null)
  useToqueSobreElCuerpo(ancla, CAMARA, activo, alTocar, () => PARTES)
  return (
    <div>
      <canvas data-testid="lienzo" />
      <div ref={ancla} data-testid="capa">
        <button type="button">Dorsal</button>
        <div data-no-orbita data-testid="aparte" />
      </div>
    </div>
  )
}

const montar = (activo = true) => {
  const alTocar = vi.fn()
  const r = render(<Montaje activo={activo} alTocar={alTocar} />)
  r.getByTestId('lienzo').getBoundingClientRect = () => RECT as DOMRect
  return { alTocar, ...r }
}
const dedo = (el: Element, de: [number, number], a: [number, number], id = 1) => {
  fireEvent.pointerDown(el, { clientX: de[0], clientY: de[1], pointerId: id })
  fireEvent.pointerUp(el, { clientX: a[0], clientY: a[1], pointerId: id })
}

describe('useToqueSobreElCuerpo', () => {
  it('un toque corto sobre el cuerpo elige la región bajo el dedo', () => {
    const { alTocar, getByTestId } = montar()
    dedo(getByTestId('capa'), [215, 380], [215, 380])
    expect(alTocar).toHaveBeenCalledWith(A)
  })

  it('un arrastre más allá del umbral no elige: sigue girando', () => {
    const { alTocar, getByTestId } = montar()
    dedo(getByTestId('capa'), [215, 380], [215 + UMBRAL_DE_TOQUE_PX + 4, 380])
    expect(alTocar).not.toHaveBeenCalled()
  })

  it('un toque que tiembla dentro del umbral sí elige', () => {
    const { alTocar, getByTestId } = montar()
    dedo(getByTestId('capa'), [215, 380], [219, 383])
    expect(alTocar).toHaveBeenCalledTimes(1)
  })

  it('fuera del cuerpo no inventa nada', () => {
    const { alTocar, getByTestId } = montar()
    dedo(getByTestId('capa'), [20, 40], [20, 40])
    expect(alTocar).not.toHaveBeenCalled()
  })

  it('un toque sobre un botón, o sobre una capa con data-no-orbita, es del botón y no del cuerpo', () => {
    const { alTocar, getByRole, getByTestId } = montar()
    dedo(getByRole('button', { name: 'Dorsal' }), [215, 380], [215, 380])
    dedo(getByTestId('aparte'), [215, 380], [215, 380])
    expect(alTocar).not.toHaveBeenCalled()
  })

  it('con un segundo dedo en medio es la cámara, no un toque', () => {
    const { alTocar, getByTestId } = montar()
    const capa = getByTestId('capa')
    fireEvent.pointerDown(capa, { clientX: 215, clientY: 380, pointerId: 1 })
    fireEvent.pointerDown(capa, { clientX: 100, clientY: 380, pointerId: 2 })
    fireEvent.pointerUp(capa, { clientX: 100, clientY: 380, pointerId: 2 })
    fireEvent.pointerUp(capa, { clientX: 215, clientY: 380, pointerId: 1 })
    expect(alTocar).not.toHaveBeenCalled()
  })

  it('un gesto cancelado no elige', () => {
    const { alTocar, getByTestId } = montar()
    const capa = getByTestId('capa')
    fireEvent.pointerDown(capa, { clientX: 215, clientY: 380, pointerId: 1 })
    fireEvent.pointerCancel(capa, { pointerId: 1 })
    fireEvent.pointerUp(capa, { clientX: 215, clientY: 380, pointerId: 1 })
    expect(alTocar).not.toHaveBeenCalled()
  })

  it('apagado (fuera de la vista de cuerpo) no escucha', () => {
    const { alTocar, getByTestId } = montar(false)
    dedo(getByTestId('capa'), [215, 380], [215, 380])
    expect(alTocar).not.toHaveBeenCalled()
  })

  it('no calcula nada mientras el dedo se mueve: solo al soltar', () => {
    const { alTocar, getByTestId } = montar()
    const capa = getByTestId('capa')
    fireEvent.pointerDown(capa, { clientX: 215, clientY: 380, pointerId: 1 })
    for (let y = 380; y < 420; y += 4) fireEvent.pointerMove(capa, { clientX: 215, clientY: y, pointerId: 1 })
    expect(alTocar).not.toHaveBeenCalled()
  })
})
