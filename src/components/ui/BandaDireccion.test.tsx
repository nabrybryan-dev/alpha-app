import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BandaDireccion } from './BandaDireccion'
import { direccion } from '../../lib/direccionesVisuales'

describe('BandaDireccion', () => {
  it('mantiene el 16:9, que es la forma en que se produjeron las piezas', () => {
    const { container } = render(<BandaDireccion direccion={direccion('A')} />)
    expect(container.querySelector('.aspect-video')).not.toBeNull()
  })

  it('declara las medidas del vídeo en el póster, para no reservar mal el hueco', () => {
    // Sin `width`/`height` la banda salta de alto al cargar la imagen y arrastra
    // todo lo que tiene debajo.
    const { container } = render(<BandaDireccion direccion={direccion('A')} />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('width')).toBe('1280')
    expect(img.getAttribute('height')).toBe('720')
  })

  it('empareja el póster con el vídeo de la MISMA dirección', () => {
    const d = direccion('B')
    const { container } = render(<BandaDireccion direccion={d} />)
    expect(container.querySelector('img')!.getAttribute('src')).toBe(d.poster)
    expect(container.querySelector('video')!.getAttribute('src')).toBe(d.video)
  })

  it('aplica el encaje de Físico al póster Y al vídeo, o habría salto', () => {
    // Físico trae una columna negra a la izquierda y se corrige ampliándola
    // anclada a la derecha. Si el recorte solo cayera en uno de los dos, al
    // relevar el póster la imagen daría un tirón lateral.
    const d = direccion('E')
    expect(d.encaje).toBeTruthy()
    const { container } = render(<BandaDireccion direccion={d} />)
    const img = container.querySelector('img')!
    const video = container.querySelector('video')!
    expect(img.className).toContain(d.encaje!)
    expect(video.className).toBe(img.className)
  })

  it('no precarga el vídeo: estas bandas no son lo que la persona vino a ver', () => {
    const { container } = render(<BandaDireccion direccion={direccion('D')} />)
    expect(container.querySelector('video')!.getAttribute('preload')).toBe('none')
  })
})
