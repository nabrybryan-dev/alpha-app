import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GraficaBrazo } from './GraficaBrazo'
import type { FotogramaBrazo } from './medidaDePalancas'

/**
 * El guiño de órbita: una vez por MEDIDA, no una por sesión.
 *
 * A 0° no hay forma de ver que la escena es tridimensional — la órbita se anuncia
 * con texto y con nada más—, así que al montar da un giro corto de ida y vuelta.
 *
 * EL FALLO QUE CIERRA ESTE TEST: `GraficaBrazo` **no se remonta** al abrir una
 * segunda medición. `PanelPalancas` la pinta con props nuevas y sin `key`, así que
 * con las dependencias del efecto en `[reducido]` a secas el guiño corría una sola
 * vez en toda la sesión: quien medía dos veces ya no lo veía la segunda. Se arregla
 * dependiendo también de `fotogramas`, que cambia con la medida y no en un
 * re-render suelto.
 *
 * OJO CON LO QUE ESTE TEST PRUEBA Y LO QUE NO. `Element.prototype.animate` **no
 * existe en este jsdom**: se declara aquí como espía. O sea que se comprueba que la
 * animación **se pide**, con sus valores, nunca que se ejecute. Que el giro se vea
 * bien es cosa de mirarlo en un móvil.
 */

const animar = vi.fn(() => ({ cancel: vi.fn(), finished: Promise.resolve() }))

function fotogramasDe(mm: number): FotogramaBrazo[] {
  return [0, 1, 2].map((i) => ({
    t: i * 0.1,
    ok: true,
    brazos: { cadera: { mm: mm + i, derivado: false } },
  })) as unknown as FotogramaBrazo[]
}

let reducido = false

beforeEach(() => {
  reducido = false
  animar.mockClear()
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: reducido && consulta.includes('prefers-reduced-motion'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  // jsdom no implementa la Web Animations API. Sin esta línea el componente sale por
  // su guarda y no hay guiño — que es justo lo que pasa en los tests de verdad.
  Element.prototype.animate = animar as unknown as Element['animate']
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete (Element.prototype as { animate?: unknown }).animate
})

describe('GraficaBrazo — el guiño de órbita', () => {
  it('al montar pide el giro con los valores del sistema', () => {
    render(<GraficaBrazo fotogramas={fotogramasDe(100)} ejeObjetivo="cadera" sigmaBrazoMm={4} />)

    expect(animar).toHaveBeenCalledTimes(1)
    const [fotogramasAnim, opciones] = animar.mock.calls[0] as unknown as [
      Array<Record<string, string>>,
      Record<string, unknown>,
    ]
    // Ida y vuelta a la vista canónica: empieza y acaba a 0°, que es donde se lee.
    expect(fotogramasAnim[0].transform).toBe('rotateY(0deg)')
    expect(fotogramasAnim[fotogramasAnim.length - 1].transform).toBe('rotateY(0deg)')
    // Y el pico va dentro del ±25° que la escena se fijó a sí misma.
    const pico = Number(/-?(\d+)deg/.exec(fotogramasAnim[1].transform)?.[1])
    expect(pico).toBeLessThanOrEqual(25)
    // 520 ms es `--dur-escena` y la curva es `--ease-salida`, escrita literal porque
    // la Web Animations API no resuelve `var()`.
    expect(opciones.duration).toBe(520)
    expect(opciones.easing).toBe('cubic-bezier(0.23, 1, 0.32, 1)')
  })

  it('con movimiento reducido no se pide ningún giro', () => {
    reducido = true
    render(<GraficaBrazo fotogramas={fotogramasDe(100)} ejeObjetivo="cadera" sigmaBrazoMm={4} />)
    expect(animar).not.toHaveBeenCalled()
  })

  it('un re-render con los MISMOS datos no repite el guiño', () => {
    const datos = fotogramasDe(100)
    const { rerender } = render(
      <GraficaBrazo fotogramas={datos} ejeObjetivo="cadera" sigmaBrazoMm={4} />,
    )
    expect(animar).toHaveBeenCalledTimes(1)

    rerender(<GraficaBrazo fotogramas={datos} ejeObjetivo="cadera" sigmaBrazoMm={5} />)
    expect(animar).toHaveBeenCalledTimes(1)
  })

  it('una MEDIDA NUEVA sí lo repite, aunque el componente no se remonte', () => {
    // Esta es la regresión: el componente no se remonta entre medidas, así que si el
    // efecto solo dependiera de `reducido`, la segunda medición no tendría guiño.
    const { rerender } = render(
      <GraficaBrazo fotogramas={fotogramasDe(100)} ejeObjetivo="cadera" sigmaBrazoMm={4} />,
    )
    expect(animar).toHaveBeenCalledTimes(1)

    rerender(<GraficaBrazo fotogramas={fotogramasDe(220)} ejeObjetivo="cadera" sigmaBrazoMm={4} />)
    expect(animar).toHaveBeenCalledTimes(2)
  })
})
