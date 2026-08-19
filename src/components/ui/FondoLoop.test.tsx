import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FondoLoop } from './FondoLoop'

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

describe('FondoLoop', () => {
  it('pinta el póster aunque no haya vídeo', () => {
    const { container } = render(<FondoLoop poster="/fondos/x.jpg" />)

    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', '/fondos/x.jpg')
    expect(img).toHaveAttribute('alt', '')
    expect(container.querySelector('video')).toBeNull()
  })

  it('no pide el vídeo mientras la ruta sea null', () => {
    // Es el estado hasta que exista el loop: pedirlo daría 404 en cada arranque.
    const { container } = render(<FondoLoop poster="/fondos/x.jpg" video={null} />)
    expect(container.querySelector('video')).toBeNull()
  })

  it('monta el vídeo silenciado, en bucle y sin salir a pantalla completa', () => {
    const { container } = render(<FondoLoop poster="/fondos/x.jpg" video="/hero/loop.webm" />)

    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    expect(video).toHaveAttribute('src', '/hero/loop.webm')
    expect(video).toHaveAttribute('poster', '/fondos/x.jpg')
    expect(video).toHaveAttribute('playsinline')
    expect((video as HTMLVideoElement).muted).toBe(true)
    expect((video as HTMLVideoElement).loop).toBe(true)
    expect((video as HTMLVideoElement).autoplay).toBe(true)
  })

  it('respeta el preload que se le pide', () => {
    const { container } = render(
      <FondoLoop poster="/fondos/x.jpg" video="/hero/loop.webm" preload="auto" />,
    )
    expect(container.querySelector('video')).toHaveAttribute('preload', 'auto')
  })

  it('no descarga nada de más por defecto', () => {
    const { container } = render(<FondoLoop poster="/fondos/x.jpg" video="/hero/loop.webm" />)
    expect(container.querySelector('video')).toHaveAttribute('preload', 'none')
  })

  it('no reclama prioridad de descarga salvo que se le pida', () => {
    // En el login el fondo es ambiente: no debe competir con el formulario.
    const { container } = render(<FondoLoop poster="/fondos/x.jpg" />)
    expect(container.querySelector('img')).toHaveAttribute('fetchpriority', 'auto')
  })

  it('acepta prioridad alta donde el fondo es el contenido', () => {
    const { container } = render(<FondoLoop poster="/fondos/x.jpg" prioridad="high" />)
    expect(container.querySelector('img')).toHaveAttribute('fetchpriority', 'high')
  })

  it('deja el póster fijo a quien pide menos movimiento', () => {
    pedirMenosMovimiento()
    const { container } = render(<FondoLoop poster="/fondos/x.jpg" video="/hero/loop.webm" />)

    expect(container.querySelector('img')).not.toBeNull()
    expect(container.querySelector('video')).toBeNull()
  })

  it('retira el vídeo si falla, en vez de dejar un hueco', () => {
    const { container } = render(<FondoLoop poster="/fondos/x.jpg" video="/hero/roto.webm" />)

    const video = container.querySelector('video')
    expect(video).not.toBeNull()

    fireEvent.error(video as HTMLVideoElement)

    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('img')).toHaveAttribute('src', '/fondos/x.jpg')
  })

  it('encaja imagen y vídeo con las mismas clases, para que coincidan', () => {
    const { container } = render(
      <FondoLoop poster="/fondos/x.jpg" video="/hero/loop.webm" className="object-contain" />,
    )

    expect(container.querySelector('img')?.className).toBe('object-contain')
    expect(container.querySelector('video')?.className).toBe('object-contain')
  })
})
