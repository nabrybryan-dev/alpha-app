import { act, fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GraficaBrazo } from './GraficaBrazo'
import type { FotogramaBrazo } from './medidaDePalancas'

/**
 * EL EXCEDENTE ELÁSTICO SE QUEDABA FUERA DEL TOPE, y solo a partir del SEGUNDO
 * arrastre. Este test documenta ese fallo en rojo.
 *
 * La órbita tiene fricción en el borde en vez de pared: pasado ±25° el dedo sigue
 * obteniendo respuesta, cada vez más amortiguada, hasta `TOPE_GRADOS +
 * GIRO_ELASTICO`. Al soltar, ese excedente se devuelve al tope.
 *
 * Lo devolvía React, y React no siempre pasa por ahí. El arrastre escribe el
 * `transform` DIRECTO en el nodo —para no re-renderizar el SVG entero en cada
 * `pointermove`— y al soltar sube el valor a estado UNA vez. Pero `setGrados` con el
 * valor que ya estaba **no provoca render**: React corta antes. Y `grados` vale
 * exactamente el tope siempre que el arrastre anterior terminó pasado de él.
 *
 * O sea: primer arrastre elástico, vuelve bien (0 → 25, el estado cambia). Segundo
 * arrastre elástico, y ya nadie reescribe el `transform`. El plano se queda clavado
 * fuera del tope, sin transición y sin volver — y nada se pone rojo, porque el
 * estado es correcto: es solo el DOM el que quedó por delante.
 *
 * Se ve al medir dos veces seguidas girando fuerte, que es exactamente lo que hace
 * quien está descubriendo que la escena se puede orbitar.
 */

function fotogramasDe(mm: number): FotogramaBrazo[] {
  return [0, 1, 2].map((i) => ({
    t: i * 0.1,
    ok: true,
    brazos: { cadera: { mm: mm + i, derivado: false } },
  })) as unknown as FotogramaBrazo[]
}

/** El ángulo que el plano tiene puesto AHORA, leído del `transform` en línea. */
function anguloDelPlano(contenedor: HTMLElement): number {
  const plano = contenedor.querySelector<HTMLElement>('[style*="preserve-3d"]')
  if (!plano) throw new Error('no se encontró el plano de la escena')
  const m = /rotateY\((-?[\d.]+)deg\)/.exec(plano.style.transform)
  if (!m) throw new Error(`transform sin rotateY: "${plano.style.transform}"`)
  return Number(m[1])
}

/** Un arrastre entero: apoyar, empujar MUY lejos —hasta la zona elástica— y soltar. */
async function arrastrarLejosYSoltar(contenedor: HTMLElement) {
  const escena = contenedor.querySelector('.touch-pan-y')
  if (!escena) throw new Error('no se encontró la escena')
  // Apoyar y mover van en `act` SEPARADOS a propósito. `pointerdown` sube
  // `gestoActivo` a estado y es el efecto que corre DESPUÉS de ese render el que ata
  // los listeners de `window`. En un solo `act` el movimiento llega antes de que
  // exista quien lo escuche, y el test pasaba a verde sin haber arrastrado nada.
  await act(async () => {
    fireEvent.pointerDown(escena, { clientX: 0, pointerId: 1 })
  })
  // 900 px son 144° de giro crudo: muy dentro de la zona elástica, que empieza a 25°.
  await act(async () => {
    fireEvent.pointerMove(window, { clientX: 900, pointerId: 1 })
  })
  const enElastico = anguloDelPlano(contenedor)
  await act(async () => {
    fireEvent.pointerUp(window, { clientX: 900, pointerId: 1 })
    // El excedente se devuelve en el frame siguiente, con la transición ya de vuelta.
    await new Promise((listo) => requestAnimationFrame(() => listo(null)))
  })
  return enElastico
}

/**
 * jsdom no trae `PointerEvent`. Sin esto, `fireEvent.pointerDown` degrada a un
 * `Event` pelado y **`clientX` se pierde por el camino**: el componente calculaba
 * `undefined - undefined` y escribía `rotateY(NaNdeg)`.
 *
 * Que haya que declararlo aquí dice algo: hasta hoy **ningún test arrastraba**. El
 * gesto entero —fricción, tope, multitáctil— estaba sin cubrir, que es exactamente
 * donde estaba el fallo.
 */
class PunteroDePrueba extends MouseEvent {
  readonly pointerId: number
  constructor(tipo: string, init: PointerEventInit = {}) {
    super(tipo, init)
    this.pointerId = init.pointerId ?? 0
  }
}

beforeEach(() => {
  vi.stubGlobal('PointerEvent', PunteroDePrueba)
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

describe('GraficaBrazo — el excedente elástico vuelve al tope', () => {
  it('el primer arrastre pasa del tope y vuelve', async () => {
    const { container } = render(
      <GraficaBrazo fotogramas={fotogramasDe(100)} ejeObjetivo="cadera" sigmaBrazoMm={4} />,
    )

    const enElastico = await arrastrarLejosYSoltar(container)

    // Que de verdad se metió en la zona elástica: si no, el test no prueba nada.
    expect(enElastico).toBeGreaterThan(25)
    expect(Math.abs(anguloDelPlano(container))).toBeLessThanOrEqual(25)
  })

  it('Y EL SEGUNDO TAMBIÉN, que es el que se quedaba fuera', async () => {
    const { container } = render(
      <GraficaBrazo fotogramas={fotogramasDe(100)} ejeObjetivo="cadera" sigmaBrazoMm={4} />,
    )

    await arrastrarLejosYSoltar(container)
    // Aquí `grados` ya vale 25. El segundo `setGrados(25)` no provoca render, así que
    // si nadie más escribe el `transform`, el plano se queda en la zona elástica.
    const enElastico = await arrastrarLejosYSoltar(container)

    expect(enElastico).toBeGreaterThan(25)
    expect(Math.abs(anguloDelPlano(container))).toBeLessThanOrEqual(25)
  })
})
