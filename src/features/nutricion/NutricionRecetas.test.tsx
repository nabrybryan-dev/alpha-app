import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Receta } from '../../data/recetas'
import { RecetasCarousel } from './RecetasCarousel'

/**
 * El rediseño de recetas (maqueta v7, paso 5): portada con crédito y duración,
 * relieve al desplazar, la porción que entra y «La cociné» con su Deshacer.
 * Escritas antes del código: en rojo contra el anterior.
 */

function receta(id: string, nombre: string, kcal = 180, gramos = 22): Receta {
  return {
    id,
    handle: '@ejemplo.cocina',
    nombre,
    categoria: 'Postre',
    media: {
      thumbnail: 'data:image/svg+xml;utf8,<svg/>',
      duracion: '0:47',
      instagramPermalink: 'https://instagram.com/p/x',
    },
    social: { views: '1,2 M', likes: '84 k', guardados: '12 k' },
    ajuste: {
      porcion: '1 porción',
      porcionNota: 'de las 9 que salen del molde',
      kcal,
      prot: 7,
      carb: 24,
      grasa: 6,
      notas: [{ tipo: 'encaja', label: 'Dónde encaja hoy', texto: 'Entra en tu merienda.' }],
    },
    ingredientes: [
      {
        nombre: 'Avena en hojuelas',
        enElReel: '200 g',
        paraTi: `${gramos} g`,
        alimentoId: 'avena-en-hojuelas-peso-en-seco',
        gramosParaTi: gramos,
        estado: 'seco',
      },
    ],
  }
}

const TRES = [
  receta('1', 'Brownie de avena'),
  receta('2', 'Tortitas'),
  receta('3', 'Bolitas'),
]

describe('recetas que sí encajan', () => {
  it('cada tarjeta dice el crédito, la duración y lo que te entra', () => {
    render(<RecetasCarousel recetas={TRES} kcalRestantes={420} />)

    expect(screen.getByText('Te quedan 420 kcal hoy')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Brownie de avena, de @ejemplo\.cocina\. Te entra 22 g · 180 kcal/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('0:47').length).toBe(3)
    expect(screen.getAllByText('@ejemplo.cocina').length).toBe(3)
  })

  it('las tarjetas giran según su distancia al centro, solo con transform', () => {
    const { container } = render(<RecetasCarousel recetas={TRES} kcalRestantes={420} />)
    const carrusel = container.querySelector<HTMLElement>('[data-carrusel-recetas]')
    if (!carrusel) throw new Error('no hay carrusel')
    const tarjetas = Array.from(container.querySelectorAll<HTMLElement>('[data-receta]'))

    Object.defineProperty(carrusel, 'clientWidth', { configurable: true, value: 300 })
    Object.defineProperty(carrusel, 'scrollLeft', { configurable: true, value: 0 })
    tarjetas.forEach((t, i) => {
      Object.defineProperty(t, 'offsetLeft', { configurable: true, value: i * 160 })
      Object.defineProperty(t, 'offsetWidth', { configurable: true, value: 148 })
    })

    act(() => {
      fireEvent.scroll(carrusel)
    })

    expect(tarjetas[0].style.transform).toContain('rotateY')
    // La de fuera del centro gira más que la primera; solo se toca transform.
    expect(tarjetas[2].style.transform).toContain('rotateY')
  })

  it('con movimiento reducido no gira: la tarjeta se queda plana', () => {
    // Asignación directa y configurable, no `vi.stubGlobal`: la prueba de la
    // escena WebGL asigna `window.matchMedia` y borra la propiedad en su
    // `afterEach`. Un stub no escribible la dejaba sin efecto y la escena
    // giraba cuando no tocaba.
    const original = window.matchMedia
    const falso = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: falso,
    })
    try {
      const { container } = render(<RecetasCarousel recetas={TRES} />)
      const carrusel = container.querySelector<HTMLElement>('[data-carrusel-recetas]')
      if (!carrusel) throw new Error('no hay carrusel')
      Object.defineProperty(carrusel, 'clientWidth', { configurable: true, value: 300 })
      const tarjetas = Array.from(container.querySelectorAll<HTMLElement>('[data-receta]'))
      tarjetas.forEach((t, i) => {
        Object.defineProperty(t, 'offsetLeft', { configurable: true, value: i * 160 })
        Object.defineProperty(t, 'offsetWidth', { configurable: true, value: 148 })
      })

      act(() => {
        fireEvent.scroll(carrusel)
      })

      expect(tarjetas.every((t) => t.style.transform === '')).toBe(true)
    } finally {
      if (original) {
        Object.defineProperty(window, 'matchMedia', {
          configurable: true,
          writable: true,
          value: original,
        })
      } else {
        Reflect.deleteProperty(window, 'matchMedia')
      }
    }
  })
})

describe('la hoja de la receta', () => {
  function abrir(registro = { agregar: vi.fn(), deshacer: vi.fn() }) {
    render(<RecetasCarousel recetas={TRES} kcalRestantes={420} registro={registro} />)
    fireEvent.click(screen.getByText('Brownie de avena'))
    return registro
  }

  it('«La cociné» registra y deja el aviso con Deshacer', () => {
    const registro = abrir()
    fireEvent.click(screen.getByRole('button', { name: 'La cociné' }))

    expect(registro.agregar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('agregada a tu merienda')
    expect(screen.queryByRole('button', { name: 'La cociné' })).toBeNull()
  })

  it('«Deshacer» devuelve el botón y quita lo registrado', () => {
    const registro = abrir()
    fireEvent.click(screen.getByRole('button', { name: 'La cociné' }))
    fireEvent.click(screen.getByRole('button', { name: /deshacer/i }))

    expect(registro.deshacer).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'La cociné' })).toBeInTheDocument()
  })

  it('el ajuste enseña la porción, los gramos y los macros, con la kcal en relieve', () => {
    const { container } = render(
      <RecetasCarousel
        recetas={TRES}
        kcalRestantes={420}
        registro={{ agregar: vi.fn(), deshacer: vi.fn() }}
      />,
    )
    fireEvent.click(screen.getByText('Brownie de avena'))

    expect(screen.getByText(/1 porción de las 9 que salen del molde · 22 g/)).toBeInTheDocument()
    expect(screen.getByText(/7 g proteína · 24 g carbohidratos · 6 g grasa/)).toBeInTheDocument()
    expect(container.querySelector('.cifra-3d')).toBeInTheDocument()
  })
})
