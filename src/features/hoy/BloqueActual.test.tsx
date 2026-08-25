import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Perfil } from '../../domain/types'
import { direccion } from '../../lib/direccionesVisuales'
import { BloqueActual } from './BloqueActual'

/**
 * El disco de la pieza A en «Tu bloque actual».
 *
 * Lo que se comprueba aquí es lo que **no daría error**: un encaje ajustado a ojo
 * que saca el brillo de la pieza fuera del disco, un `max-width` del reset de
 * Tailwind que anula el encaje entero en silencio, y un diámetro subido de 56 a
 * 80 que estira la imagen sin que nadie lo relacione. Ninguno de los tres se ve
 * desarrollando en un monitor: es el mismo punto ciego que documenta
 * `fondos-de-tarjeta.test.ts`.
 */

/** El mínimo con el que la tarjeta se pinta: sin prescripción no hay tarjeta. */
const PERFIL: Perfil = {
  usuarioId: 'u-valentina',
  objetivos: '',
  edad: 30,
  diasEntrenamiento: 4,
  tiempoSesionMin: 60,
  somatotipo: 'mesomorfo',
  volumenSemanal: {},
  medidas: [],
  faseEnergetica: 'Déficit',
  proteinaGkg: 2,
  pasosObjetivo: 9000,
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

const disco = (c: HTMLElement) => c.querySelector('img') as HTMLImageElement

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('el disco de «Tu bloque actual»', () => {
  it('es la pieza A', () => {
    conMovimiento(false)
    const { container } = render(<BloqueActual perfil={PERFIL} />)

    expect(disco(container).getAttribute('src')).toBe(direccion('A').poster)
    expect(container.querySelector('video')?.getAttribute('src')).toBe(direccion('A').video)
  })

  it('mira al brillo de la pieza, no a su centro geométrico', () => {
    conMovimiento(false)
    const { container } = render(<BloqueActual perfil={PERFIL} />)
    const { width, height, left, top } = disco(container).style

    // Los cuatro salen de una ventana de 216 px centrada en (518, 216): ahí está
    // el disco de la barra, la placa roja y la mano. El recorte contiene un
    // disco, que es la frase de la pieza. Con el encaje anterior —x=621, del
    // fotograma de antes del re-grade del #96— el disco enseña la cara del
    // atleta, y eso no lo delata ningún número: hay que mirarlo.
    expect(width).toBe('592.5925925925926%')
    expect(height).toBe('333.3333333333333%')
    expect(left).toBe('-189.8148148148148%')
    expect(top).toBe('-50%')
  })

  it('lleva `max-w-none`, sin la que el encaje se anula en silencio', () => {
    conMovimiento(false)
    const { container } = render(<BloqueActual perfil={PERFIL} />)

    // El reset de Tailwind pone `max-width: 100%` a `img`. Sin quitarlo, el
    // 592,6% se recorta a 100% y la imagen sale entera y pequeña: parece que el
    // CSS no hizo nada, y no hay ningún error que lo cuente.
    expect(disco(container).className).toContain('max-w-none')
  })

  it('no se amplía: el diámetro cabe en la ventana de la pieza', () => {
    conMovimiento(false)
    const { container } = render(<BloqueActual perfil={PERFIL} />)

    // La ventana tiene 216 px de fuente; a densidad 3 el tope son 72 CSS px.
    const LADO = 216
    const DPR = 3
    const diametro = Number.parseFloat(String(disco(container).parentElement?.style.width))
    expect(diametro).toBeGreaterThan(0)
    expect(
      diametro * DPR,
      `un disco de ${diametro} px se pinta a ${((diametro * DPR) / LADO).toFixed(2)}x`,
    ).toBeLessThanOrEqual(LADO)
  })

  it('con movimiento reducido queda el póster y ni un vídeo', () => {
    conMovimiento(true)
    const { container } = render(<BloqueActual perfil={PERFIL} />)

    expect(container.querySelectorAll('video')).toHaveLength(0)
    expect(disco(container).getAttribute('src')).toBe(direccion('A').poster)
  })

  it('sin perfil no hay tarjeta, y el disco no la resucita', () => {
    conMovimiento(false)
    const { container } = render(<BloqueActual />)

    expect(container).toBeEmptyDOMElement()
  })

  it('sigue diciendo la prescripción del coach', () => {
    conMovimiento(false)
    render(<BloqueActual perfil={PERFIL} />)

    // La pieza es un objeto de la tarjeta, no su contenido: si al montarla se
    // perdiera una fila, el cambio habría sido decorar en vez de diseñar.
    expect(screen.getByText('Fase energética')).toBeInTheDocument()
    expect(screen.getByText('2 g/kg')).toBeInTheDocument()
    expect(screen.getByText('9.000/día')).toBeInTheDocument()
  })
})
