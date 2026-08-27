import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AvisoDeCaptura } from './AvisoDeCaptura'

/**
 * Lo que se protege aquí no es cómo se ve el aviso: es que **no mueva nada**.
 *
 * Vivía como un párrafo en el flujo, entre la barra de medidas y el botón de
 * grabar, así que al aparecer empujaba el botón hacia abajo. Y aparece justo al
 * fijar el disco — el instante antes de que la mano vaya a Grabar. Con avisos de
 * más de 300 caracteres, el botón se movía decenas de píxeles bajo el pulgar, en
 * un gimnasio y con la barra en las manos.
 */

describe('el aviso de la captura', () => {
  it('sin aviso no pinta nada, ni un contenedor vacío', () => {
    // Un contenedor vacío pero presente volvería a ocupar sitio, que es
    // exactamente el problema que este componente existe para quitar.
    const { container } = render(<AvisoDeCaptura aviso={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('con aviso, sale FUERA del flujo: no puede empujar al botón', () => {
    const { container } = render(<AvisoDeCaptura aviso="Eso tiene esquinas, y un disco no las tiene." />)
    const caja = container.firstElementChild as HTMLElement
    expect(caja.className).toContain('absolute')
  })

  it('no intercepta el toque sobre la imagen', () => {
    // Se monta encima del lienzo, y ese lienzo recibe el toque que fija el
    // disco: uno de los dos toques que la doctrina permite en una medición. Si
    // el aviso se comiera ese toque, la persona tocaría el disco y no pasaría
    // nada — sin ninguna pista de por qué.
    const { container } = render(<AvisoDeCaptura aviso="Un aviso cualquiera" />)
    expect((container.firstElementChild as HTMLElement).className).toContain('pointer-events-none')
  })

  it('un aviso nuevo entra como nuevo, no cambia el texto por debajo', () => {
    const { rerender, container } = render(<AvisoDeCaptura aviso="Primero" />)
    const antes = screen.getByText('Primero')
    rerender(<AvisoDeCaptura aviso="Segundo" />)
    expect(screen.getByText('Segundo')).not.toBe(antes)
    // Y sigue habiendo uno solo: no se apilan.
    expect(container.querySelectorAll('p')).toHaveLength(1)
  })
})
