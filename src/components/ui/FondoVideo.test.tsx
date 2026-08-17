import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FondoVideo } from './FondoVideo'

/**
 * `matchMedia` no existe en jsdom. Se declara con el valor que pida el test y
 * guardando los oyentes, para poder simular que la preferencia cambia con la
 * app ya abierta.
 */
type Oyente = () => void
let oyentes: Oyente[] = []
let reducido = false

function declararMatchMedia() {
  oyentes = []
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    // Getter, no valor: el hook guarda este objeto y lo vuelve a leer cuando
    // llega el `change`. Con un valor fijo leería siempre el de antes.
    get matches() {
      return reducido && consulta.includes('prefers-reduced-motion')
    },
    addEventListener: (_: string, fn: Oyente) => oyentes.push(fn),
    removeEventListener: (_: string, fn: Oyente) => {
      oyentes = oyentes.filter((o) => o !== fn)
    },
  }))
}

/** Cambia la preferencia y avisa a quien esté escuchando, como haría el sistema. */
function cambiarPreferencia(nuevo: boolean) {
  reducido = nuevo
  act(() => oyentes.forEach((avisar) => avisar()))
}

const props = {
  poster: '/hero/despiece.jpg',
  webm: '/hero/despiece.webm',
  mp4: '/hero/despiece.mp4',
}

beforeEach(() => {
  reducido = false
  declararMatchMedia()
})

afterEach(() => vi.unstubAllGlobals())

describe('FondoVideo', () => {
  it('reproduce el loop en bucle, mudo y sin salir a pantalla completa', () => {
    const { container } = render(<FondoVideo {...props} />)
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    expect(video).toHaveAttribute('loop')
    expect(video).toHaveAttribute('autoplay')
    expect(video?.muted).toBe(true)
    expect(video).toHaveAttribute('playsinline')
  })

  it('no descarga el vídeo hasta que hace falta', () => {
    const { container } = render(<FondoVideo {...props} />)
    expect(container.querySelector('video')).toHaveAttribute('preload', 'none')
  })

  it('ofrece webm antes que mp4, para que el navegador coja el ligero', () => {
    const { container } = render(<FondoVideo {...props} />)
    const tipos = Array.from(container.querySelectorAll('source'), (s) => s.getAttribute('type'))
    expect(tipos).toEqual(['video/webm', 'video/mp4'])
  })

  it('el póster se ve aunque el vídeo no llegue nunca', () => {
    const { container } = render(<FondoVideo {...props} />)
    // Como atributo del vídeo (mientras carga) y como fondo del contenedor
    // (si el archivo falla y el vídeo se queda transparente).
    expect(container.querySelector('video')).toHaveAttribute('poster', props.poster)
    const plancha = container.querySelector('[data-plancha]') as HTMLElement
    expect(plancha.style.backgroundImage).toContain(props.poster)
  })

  it('con movimiento reducido no monta el vídeo: no se pide el archivo', () => {
    reducido = true
    declararMatchMedia()
    const { container } = render(<FondoVideo {...props} />)
    expect(container.querySelector('video')).toBeNull()
    const plancha = container.querySelector('[data-plancha]') as HTMLElement
    expect(plancha.style.backgroundImage).toContain(props.poster)
  })

  it('si la preferencia se activa con la app abierta, el vídeo se va', () => {
    const { container } = render(<FondoVideo {...props} />)
    expect(container.querySelector('video')).not.toBeNull()
    cambiarPreferencia(true)
    expect(container.querySelector('video')).toBeNull()
  })

  it('es decorativo: no lo anuncia el lector de pantalla', () => {
    const { container } = render(<FondoVideo {...props} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('sin matchMedia (jsdom pelado) no revienta y deja el vídeo', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { container } = render(<FondoVideo {...props} />)
    expect(container.querySelector('video')).not.toBeNull()
  })
})
