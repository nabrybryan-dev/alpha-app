import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AdjuntoMensaje } from './AdjuntoMensaje'

describe('AdjuntoMensaje', () => {
  it('avisa mientras el archivo todavía sube', () => {
    render(<AdjuntoMensaje path="u/msg-1.jpg" tipo="imagen" estado="subiendo" />)
    expect(screen.getByText(/subiendo/i)).toBeInTheDocument()
  })

  it('dice que es un video cuando lo es', () => {
    render(<AdjuntoMensaje path="u/msg-1.mp4" tipo="video" estado="subiendo" />)
    expect(screen.getByText(/video/i)).toBeInTheDocument()
  })

  it('no pinta nada si el mensaje no lleva adjunto', () => {
    const { container } = render(
      <AdjuntoMensaje path={undefined} tipo={undefined} estado={undefined} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
