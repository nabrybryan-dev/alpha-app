import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarcaAguila } from './MarcaAguila'

describe('MarcaAguila', () => {
  it('es un vector, no una imagen', () => {
    // El motivo del cambio: antes era un JPEG de 1254x1254 y 45 KB para pintar
    // 32 px. Si alguien vuelve a meter un <img>, esta prueba lo caza.
    const { container } = render(<MarcaAguila />)

    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('hereda el color del texto, para que el tema lo invierta solo', () => {
    // Es la razón de ser del cambio: el JPEG traía fondo negro cocido, así que
    // en tema claro la barra mostraba una pastilla negra. Con currentColor el
    // águila se pinta del color que mande el contenedor.
    const { container } = render(<MarcaAguila />)
    const relleno = container.querySelector('svg [fill], svg[fill]')

    expect(relleno?.getAttribute('fill')).toBe('currentColor')
  })

  it('no anuncia nada a quien no ve: el título ya dice dónde está', () => {
    const { container } = render(<MarcaAguila />)
    const svg = container.querySelector('svg')

    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg?.querySelector('title')).toBeNull()
  })

  it('deja pasar la clase de tamaño', () => {
    const { container } = render(<MarcaAguila className="h-8 w-8" />)

    expect(container.querySelector('svg')).toHaveClass('h-8', 'w-8')
  })

  it('lleva la caja ceñida al trazado, no la del export', () => {
    // El export de marca trae 1254x1254 con casi un 30% de aire alrededor. Con
    // esa caja, `h-8 w-8` pintaba un águila de 22 px — más pequeña que el JPEG
    // que sustituye, que iba a sangre. Ceñida, el tamaño que pide quien la usa
    // es el que se ve. Los números salen de medir el trazado a escala 1:1.
    const { container } = render(<MarcaAguila />)

    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '206 200 871 922')
  })
})
