import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Cifra3D } from './Cifra3D'

describe('Cifra3D', () => {
  it('el lector de pantalla oye la etiqueta entera, no la cuenta animada', () => {
    const { container } = render(<Cifra3D valor={86} sufijo="%" etiqueta="86 % de adherencia" />)
    expect(screen.getByText('86 % de adherencia')).toBeInTheDocument()
    const visible = container.querySelector('.cifra-3d')!
    expect(visible).toHaveAttribute('aria-hidden', 'true')
    expect(visible).not.toHaveClass('cifra-3d-rojo')
  })

  it('sin dato pinta una raya y no le pega la unidad: no medido no es cero', () => {
    const { container } = render(<Cifra3D valor={undefined} sufijo="%" etiqueta="Sin adherencia registrada" />)
    expect(container.querySelector('.cifra-3d')!.textContent).toBe('—')
  })

  it('con decimales sale ya quieta y en formato colombiano', () => {
    const { container } = render(<Cifra3D valor={7.25} decimales={1} etiqueta="7,3 horas" />)
    expect(container.querySelector('.cifra-3d')!.textContent).toBe('7,3')
  })

  it('el rojo es opt-in, para lo que pide atención', () => {
    const { container } = render(<Cifra3D valor={3} rojo etiqueta="3 por aprobar" />)
    expect(container.querySelector('.cifra-3d')).toHaveClass('cifra-3d-rojo')
  })
})
