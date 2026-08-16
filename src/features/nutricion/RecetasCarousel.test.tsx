import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Receta } from '../../data/recetas'
import { RecetasCarousel } from './RecetasCarousel'

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
  }
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

  it('«Agregar al registro» llama al handler con la receta y cierra', () => {
    const alAgregar = vi.fn()
    render(<RecetasCarousel recetas={TRES} onAgregar={alAgregar} />)
    fireEvent.click(screen.getByText('Brownie de avena'))
    fireEvent.click(screen.getByRole('button', { name: /agregar al registro/i }))
    expect(alAgregar).toHaveBeenCalledWith(expect.objectContaining({ id: '1', nombre: 'Brownie de avena' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  /**
   * Sin handler no hay botón. El registro de comidas no admite entradas libres,
   * y un botón que no guarda nada es peor que ningún botón.
   */
  it('sin handler no ofrece el botón de agregar', () => {
    render(<RecetasCarousel recetas={TRES} />)
    fireEvent.click(screen.getByText('Brownie de avena'))
    expect(screen.queryByRole('button', { name: /agregar al registro/i })).not.toBeInTheDocument()
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

  it('muestra las kcal restantes del día cuando se le pasan', () => {
    render(<RecetasCarousel recetas={TRES} kcalRestantes={420} />)
    fireEvent.click(screen.getByText('Brownie de avena'))
    expect(screen.getByText(/Te quedan 420 kcal hoy/)).toBeInTheDocument()
  })

  /** Sin `videoUrl` el reproductor cae al póster, nunca a un layout roto. */
  it('sin video avisa de que el reel vive en Instagram', () => {
    render(<RecetasCarousel recetas={TRES} />)
    fireEvent.click(screen.getByText('Brownie de avena'))
    expect(screen.getByText(/Reel disponible en Instagram/)).toBeInTheDocument()
  })
})
