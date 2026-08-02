import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { stickersDelAlbum } from '../../data/contenido/albumAlfa'
import { NOTICIAS_RADAR } from '../../data/contenido/radarAlfa'
import { AlbumAlfa } from './AlbumAlfa'
import { RadarAlfa } from './RadarAlfa'

function renderizarAlbum() {
  return render(
    <MemoryRouter>
      <AlbumAlfa stickers={stickersDelAlbum()} />
    </MemoryRouter>,
  )
}

describe('AlbumAlfa', () => {
  it('numera las fichas y dice cuántas van del bloque de 24', () => {
    renderizarAlbum()
    expect(screen.getByText('04 / 24')).toBeInTheDocument()
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('04')).toBeInTheDocument()
  })

  it('cada ficha lleva a la historia completa en Logros', () => {
    renderizarAlbum()
    const fichas = screen.getAllByRole('link')
    expect(fichas).toHaveLength(stickersDelAlbum().length)
    for (const ficha of fichas) expect(ficha).toHaveAttribute('href', '/logros')
  })

  it('toda ficha tiene foto con texto alternativo: no se pintan huecos', () => {
    renderizarAlbum()
    const fotos = screen.getAllByRole('img')
    expect(fotos).toHaveLength(stickersDelAlbum().length)
    for (const foto of fotos) {
      expect(foto.getAttribute('alt')).toBeTruthy()
      expect(foto.getAttribute('src')).toMatch(/^\//)
    }
  })

  it('no se pinta la sección si todavía no hay fichas', () => {
    const { container } = render(
      <MemoryRouter>
        <AlbumAlfa stickers={[]} />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('RadarAlfa', () => {
  it('muestra la semana y una fila por noticia con su categoría', () => {
    render(<RadarAlfa noticias={NOTICIAS_RADAR} semana={31} />)
    expect(screen.getByText('Sem 31')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(NOTICIAS_RADAR.length)
    expect(screen.getByText('Estudio')).toBeInTheDocument()
    expect(screen.getByText('Recuperación')).toBeInTheDocument()
  })

  it('no se pinta la sección sin noticias', () => {
    const { container } = render(<RadarAlfa noticias={[]} semana={31} />)
    expect(container).toBeEmptyDOMElement()
  })
})
