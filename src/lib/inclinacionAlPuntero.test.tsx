import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useInclinacionAlPuntero } from './inclinacionAlPuntero'

function pedirMenosMovimiento() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
}

afterEach(() => vi.unstubAllGlobals())

/** Caja de 200x100 en el origen, para que la aritmética del test sea legible. */
function Caja({
  maxGrados,
  alMoverse,
}: {
  maxGrados?: number
  alMoverse?: (px: number, py: number) => void
}) {
  const { ref, alMover, alSalir } = useInclinacionAlPuntero<HTMLDivElement>({ maxGrados, alMoverse })
  return (
    <div
      ref={ref}
      data-testid="caja"
      onPointerMove={alMover}
      onPointerLeave={alSalir}
      style={{ width: 200, height: 100 }}
    />
  )
}

/**
 * jsdom no hace layout: `getBoundingClientRect` devuelve ceros y el hook se
 * plantaría por su propia guarda. Se le da una caja real.
 */
/**
 * `fireEvent.pointerMove` no sirve aquí: jsdom no implementa `PointerEvent`, así
 * que testing-library cae a un `Event` genérico y `clientX`/`clientY` se pierden
 * por el camino — el hook recibía `undefined` y escribía `NaN`. Un `MouseEvent`
 * con nombre `pointermove` sí lleva coordenadas y React lo entrega igual.
 */
function mover(el: HTMLElement, x: number, y: number) {
  fireEvent(el, new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true }))
}

function conCaja(el: HTMLElement) {
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0 }) as DOMRect
}

/**
 * La inclinación de la ficha coleccionable, ya extraída.
 *
 * Este comportamiento vivía dentro de `FichaPanini` y **nunca tuvo test**. Se
 * cubre aquí, al sacarlo, porque desde ahora lo consumen tres superficies: la
 * ficha, la bandeja del microciclo y el fotograma del rollo de marca. Un fallo
 * silencioso se multiplicaría por tres.
 */
describe('useInclinacionAlPuntero', () => {
  it('inclina siguiendo al puntero, con el signo correcto en cada eje', () => {
    const { getByTestId } = render(<Caja />)
    const caja = getByTestId('caja')
    conCaja(caja)

    // Esquina superior derecha: rotateY positivo (gira hacia la derecha) y
    // rotateX positivo (el borde de arriba se aleja).
    mover(caja, 200, 0)
    expect(caja.style.transform).toBe('rotateX(12.00deg) rotateY(12.00deg)')

    // Esquina inferior izquierda: los dos signos se invierten.
    mover(caja, 0, 100)
    expect(caja.style.transform).toBe('rotateX(-12.00deg) rotateY(-12.00deg)')
  })

  it('en el centro exacto deja el elemento plano', () => {
    const { getByTestId } = render(<Caja />)
    const caja = getByTestId('caja')
    conCaja(caja)
    mover(caja, 100, 50)
    // `(-0).toFixed(2)` devuelve "0.00", sin signo: el cero negativo no sobrevive.
    expect(caja.style.transform).toBe('rotateX(0.00deg) rotateY(0.00deg)')
  })

  it('respeta el tope de grados que le pidan', () => {
    const { getByTestId } = render(<Caja maxGrados={6} />)
    const caja = getByTestId('caja')
    conCaja(caja)
    mover(caja, 200, 0)
    expect(caja.style.transform).toBe('rotateX(6.00deg) rotateY(6.00deg)')
  })

  it('devuelve la posición normalizada, que es de lo que vive el brillo de la ficha', () => {
    const visto: [number, number][] = []
    const { getByTestId } = render(<Caja alMoverse={(px, py) => visto.push([px, py])} />)
    const caja = getByTestId('caja')
    conCaja(caja)
    mover(caja, 50, 25)
    expect(visto).toEqual([[0.25, 0.25]])
  })

  it('al salir vuelve a plano', () => {
    const { getByTestId } = render(<Caja />)
    const caja = getByTestId('caja')
    conCaja(caja)
    mover(caja, 200, 0)
    expect(caja.style.transform).not.toBe('rotateX(0deg) rotateY(0deg)')
    fireEvent.pointerLeave(caja)
    expect(caja.style.transform).toBe('rotateX(0deg) rotateY(0deg)')
  })

  it('con movimiento reducido NO inclina, y tampoco avisa del movimiento', () => {
    pedirMenosMovimiento()
    const visto: [number, number][] = []
    const { getByTestId } = render(<Caja alMoverse={(px, py) => visto.push([px, py])} />)
    const caja = getByTestId('caja')
    conCaja(caja)
    mover(caja, 200, 0)
    expect(caja.style.transform).toBe('')
    expect(visto).toEqual([])
  })
})
