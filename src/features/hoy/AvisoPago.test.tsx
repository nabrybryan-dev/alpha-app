import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AvisoPago } from './AvisoPago'

describe('AvisoPago', () => {
  it('sin aviso no pinta nada', () => {
    const { container } = render(<AvisoPago aviso={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('pinta el texto y un enlace seguro que abre en pestaña nueva', () => {
    render(<AvisoPago aviso={{ texto: 'Ana, tu mensualidad venció.', enlace: 'https://pago.ejemplo.com/abc' }} />)
    expect(screen.getByText('Ana, tu mensualidad venció.')).toBeInTheDocument()
    const a = screen.getByRole('link', { name: /pagar mi mensualidad/i })
    expect(a).toHaveAttribute('href', 'https://pago.ejemplo.com/abc')
    expect(a).toHaveAttribute('target', '_blank')
    expect(a.getAttribute('rel')).toContain('noopener')
    expect(a.getAttribute('rel')).toContain('noreferrer')
    expect(a).toHaveTextContent('PAGAR MI MENSUALIDAD')
  })
  it('lleva la clase del relieve y el aviso es una región con nombre', () => {
    render(<AvisoPago aviso={{ texto: 'x', enlace: 'https://a.co' }} />)
    expect(screen.getByRole('link').className).toContain('boton-pago-3d')
    expect(screen.getByRole('region', { name: /mensualidad/i })).toBeInTheDocument()
  })
})
