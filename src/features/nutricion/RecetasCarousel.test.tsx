import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Receta } from '../../data/recetas'
import { RecetasCarousel } from './RecetasCarousel'
import type { RecetaRegistro } from './RecetaSheet'

function receta(id: string, nombre: string): Receta {
  return {
    id,
    handle: '@ejemplo.cocina',
    nombre,
    categoria: 'Postre',
    media: { thumbnail: 'data:image/svg+xml;utf8,<svg/>', duracion: '0:47', instagramPermalink: 'https://instagram.com/p/x' },
    social: { views: '1,2 M', likes: '84 k', guardados: '12 k' },
    ajuste: {
      porcion: '1 porción de 60 g',
      porcionNota: 'de las 9 que salen del molde',
      kcal: 180,
      prot: 7,
      carb: 24,
      grasa: 6,
      notas: [{ tipo: 'encaja', label: 'Dónde encaja hoy', texto: 'Entra en tu merienda.' }],
    },
    ingredientes: [
      {
        nombre: 'Avena en hojuelas',
        enElReel: '200 g',
        paraTi: '22 g',
        alimentoId: 'avena-en-hojuelas-peso-en-seco',
        gramosParaTi: 22,
        estado: 'seco',
      },
    ],
  }
}

/** Sin ingredientes medidos no se puede registrar, y hay que decirlo. */
function recetaSinMedir(): Receta {
  return { ...receta('9', 'Sopa de la abuela'), ingredientes: undefined }
}

const TRES = [receta('1', 'Brownie de avena'), receta('2', 'Tortitas'), receta('3', 'Bolitas')]

describe('RecetasCarousel', () => {
  it('pinta una tarjeta por receta', () => {
    render(<RecetasCarousel recetas={TRES} />)
    expect(screen.getByText('Brownie de avena')).toBeInTheDocument()
    expect(screen.getByText('Bolitas')).toBeInTheDocument()
    expect(screen.getByText('3 nuevas')).toBeInTheDocument()
  })

  /** Sin recetas la sección entera desaparece: ni estado vacío, ni hueco. */
  it('con cero recetas no renderiza nada', () => {
    const { container } = render(<RecetasCarousel recetas={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('el toque en la tarjeta abre la hoja', () => {
    render(<RecetasCarousel recetas={TRES} />)
    fireEvent.click(screen.getByText('Brownie de avena'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Tu ajuste Alfa')).toBeInTheDocument()
    expect(screen.getByText('1 porción de 60 g')).toBeInTheDocument()
  })

  it('Esc cierra la hoja', () => {
    render(<RecetasCarousel recetas={TRES} />)
    fireEvent.click(screen.getByText('Brownie de avena'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('agregar al registro', () => {
    function abrirCon(registro: RecetaRegistro) {
      render(<RecetasCarousel recetas={TRES} registro={registro} />)
      fireEvent.click(screen.getByText('Brownie de avena'))
      return screen.getByRole('button', { name: /agregar al registro/i })
    }

    it('agrega en un solo toque, sin diálogo de confirmación', () => {
      const registro = { agregar: vi.fn(), deshacer: vi.fn() }
      fireEvent.click(abrirCon(registro))
      expect(registro.agregar).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
      expect(registro.agregar).toHaveBeenCalledTimes(1)
    })

    /**
     * La hoja NO se cierra al agregar. Cerrar de golpe se lleva por delante el
     * aviso de «Deshacer», que es la única salida si el toque fue un accidente.
     */
    it('deja la hoja abierta y avisa de lo que quedó registrado', () => {
      fireEvent.click(abrirCon({ agregar: vi.fn(), deshacer: vi.fn() }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      const aviso = screen.getByRole('status')
      expect(aviso).toHaveTextContent('Brownie de avena')
      expect(aviso).toHaveTextContent('1 porción de 60 g agregada')
    })

    it('«Deshacer» revierte de verdad, no solo esconde el aviso', () => {
      const registro = { agregar: vi.fn(), deshacer: vi.fn() }
      fireEvent.click(abrirCon(registro))
      fireEvent.click(screen.getByRole('button', { name: /deshacer/i }))
      expect(registro.deshacer).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('el aviso se va solo a los 4 s', () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        fireEvent.click(abrirCon({ agregar: vi.fn(), deshacer: vi.fn() }))
        act(() => {
          vi.advanceTimersByTime(3900)
        })
        expect(screen.getByRole('status')).toBeInTheDocument()
        act(() => {
          vi.advanceTimersByTime(200)
        })
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })

    it('«Deshacer» tiene 44px de área táctil', () => {
      fireEvent.click(abrirCon({ agregar: vi.fn(), deshacer: vi.fn() }))
      expect(screen.getByRole('button', { name: /deshacer/i }).style.minHeight).toBe('44px')
    })

    /**
     * Un botón que se pulsa y no hace nada se lee como una app rota. Si la
     * receta no está medida, se dice antes de tocarlo y no se deja tocar.
     */
    it('sin ingredientes medidos el botón se desactiva y explica por qué', () => {
      const registro = { agregar: vi.fn(), deshacer: vi.fn() }
      render(<RecetasCarousel recetas={[recetaSinMedir()]} registro={registro} />)
      fireEvent.click(screen.getByText('Sopa de la abuela'))
      const boton = screen.getByRole('button', { name: /agregar al registro/i })
      expect(boton).toBeDisabled()
      expect(screen.getByText(/todavía no trae sus ingredientes medidos/i)).toBeInTheDocument()
      fireEvent.click(boton)
      expect(registro.agregar).not.toHaveBeenCalled()
    })
  })

  it('el crédito al creador está en la tarjeta y en la hoja', () => {
    render(<RecetasCarousel recetas={TRES} />)
    expect(screen.getAllByText('@ejemplo.cocina').length).toBe(3)
    fireEvent.click(screen.getByText('Brownie de avena'))
    expect(screen.getByRole('link', { name: /ver en instagram/i })).toHaveAttribute(
      'href',
      'https://instagram.com/p/x',
    )
  })

  /**
   * La línea contextual es lo único que separa esto de un feed de recetas: dice
   * que la porción está medida contra el día de esta persona. Sin dato cambia de
   * texto; no se calla nunca.
   */
  describe('línea contextual', () => {
    it('con dato, dice cuántas kcal quedan hoy', () => {
      render(<RecetasCarousel recetas={TRES} kcalRestantes={420} />)
      fireEvent.click(screen.getByText('Brownie de avena'))
      expect(screen.getByText('Te quedan 420 kcal hoy')).toBeInTheDocument()
    })

    it('sin dato NO desaparece: cae al plan del día', () => {
      render(<RecetasCarousel recetas={TRES} />)
      fireEvent.click(screen.getByText('Brownie de avena'))
      expect(screen.getByText('Según tu plan de hoy')).toBeInTheDocument()
    })
  })

  /** El esqueleto reserva el hueco exacto: si no coincide, el contenido salta. */
  describe('esqueleto de carga', () => {
    it('reserva tres tarjetas del mismo ancho que las de verdad', () => {
      const { container } = render(<RecetasCarousel recetas={[]} cargando />)
      const fantasmas = container.querySelectorAll('.w-\\[132px\\]')
      expect(fantasmas).toHaveLength(3)
      expect(container.querySelector('.h-\\[176px\\]')).toBeInTheDocument()
    })

    it('no anuncia el hueco a quien navega por voz', () => {
      const { container } = render(<RecetasCarousel recetas={[]} cargando />)
      expect(container.querySelector('section')).toHaveAttribute('aria-hidden', 'true')
    })

    it('al llegar las recetas, el esqueleto se va', () => {
      const { container, rerender } = render(<RecetasCarousel recetas={[]} cargando />)
      rerender(<RecetasCarousel recetas={TRES} />)
      expect(container.querySelector('.brillo-carga')).not.toBeInTheDocument()
      expect(screen.getByText('Brownie de avena')).toBeInTheDocument()
    })
  })

  /** Sin `videoUrl` el reproductor cae al póster, nunca a un layout roto. */
  it('sin video avisa de que el reel vive en Instagram', () => {
    render(<RecetasCarousel recetas={TRES} />)
    fireEvent.click(screen.getByText('Brownie de avena'))
    expect(screen.getByText(/Reel disponible en Instagram/)).toBeInTheDocument()
  })
})
