import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IconoCorazon, IconoCubiertos, IconoPesa } from '../../components/ui/Icono'
import type { Racha } from '../../domain/gamification'
import { direccion } from '../../lib/direccionesVisuales'
import { TiraDeRachas, type CeldaDeRacha } from './TiraDeRachas'

/**
 * La tira de rachas de Logros: tres ventanas a la misma calle.
 *
 * Lo que se comprueba aquí no es cómo se ve —eso hay que mirarlo en un móvil—
 * sino lo que falla **en silencio**: tres vídeos donde debería haber uno no se
 * ve como un fallo, se ve como que el móvil va lento; y una pieza que se
 * descarga con las tres celdas tapadas no se ve en absoluto, solo se paga.
 *
 * La aritmética de cuánto se descubre vive en `domain/gamification.ts` y se
 * comprueba allí. Aquí solo se comprueba que llega a la pantalla.
 */

/** Movimiento normal salvo que se pida lo contrario. Mismo patrón que el rollo. */
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

function celdas(...rachas: Racha[]): CeldaDeRacha[] {
  const iconos = [IconoCorazon, IconoPesa, IconoCubiertos]
  const nombres = ['Bienestar', 'Entrenamiento', 'Nutrición']
  return rachas.map((racha, i) => ({ nombre: nombres[i], racha, Icono: iconos[i] }))
}

/** Las cortinas de tinta, en el orden de las celdas. */
function descubierto(contenedor: HTMLElement): number[] {
  return Array.from(contenedor.querySelectorAll('[data-descubierto]')).map((nodo) =>
    Number(nodo.getAttribute('data-descubierto')),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TiraDeRachas', () => {
  it('cada celda descubre su propia fracción', () => {
    conMovimiento(false)
    const { container } = render(
      <TiraDeRachas
        celdas={celdas({ actual: 3, record: 6 }, { actual: 4, record: 4 }, { actual: 0, record: 5 })}
      />,
    )

    expect(descubierto(container)).toEqual([0.5, 1, 0])
  })

  it('la cortina tapa lo que NO se ha recorrido', () => {
    conMovimiento(false)
    const { container } = render(<TiraDeRachas celdas={celdas({ actual: 1, record: 4 })} />)

    // Descubierto un cuarto, así que la tinta ocupa los otros tres.
    const cortina = container.querySelector('[data-descubierto]') as HTMLElement
    expect(cortina.style.width).toBe('75%')
  })

  it('hay UN vídeo para las tres celdas, no tres', () => {
    conMovimiento(false)
    const { container } = render(
      <TiraDeRachas
        celdas={celdas({ actual: 3, record: 6 }, { actual: 4, record: 4 }, { actual: 2, record: 9 })}
      />,
    )

    expect(container.querySelectorAll('video')).toHaveLength(1)
    expect(container.querySelector('video')?.getAttribute('src')).toBe(direccion('F').video)
  })

  it('sin ninguna racha que enseñar no se pide la pieza', () => {
    conMovimiento(false)
    const { container } = render(
      <TiraDeRachas
        celdas={celdas({ actual: 0, record: 0 }, { actual: 0, record: 0 }, { actual: 0, record: 0 })}
      />,
    )

    // Ni vídeo ni póster: la calle está tapada al 100% en las tres celdas, así
    // que descargarla sería pagar por lo que nadie ve.
    expect(container.querySelectorAll('video')).toHaveLength(0)
    expect(container.querySelectorAll('img')).toHaveLength(0)
  })

  it('con movimiento reducido queda el póster y ni un vídeo', () => {
    conMovimiento(true)
    const { container } = render(<TiraDeRachas celdas={celdas({ actual: 2, record: 4 })} />)

    expect(container.querySelectorAll('video')).toHaveLength(0)
    expect(container.querySelector('img')?.getAttribute('src')).toBe(direccion('F').poster)
  })

  it('sigue diciendo la cifra y el récord de cada racha', () => {
    conMovimiento(false)
    render(<TiraDeRachas celdas={celdas({ actual: 3, record: 6 })} />)

    // La pieza es el fondo, no el contenido: si al montarla se perdiera el dato,
    // el cambio habría sido decorar en vez de diseñar.
    expect(screen.getByText('Bienestar')).toBeInTheDocument()
    expect(screen.getByText('Récord: 6')).toBeInTheDocument()
  })
})
