/**
 * La vitrina de `/interesados`: se ve qué recibe la persona, el precio y la fuente de cada
 * frase de respaldo, y un enlace baja al formulario. No añade campos ni botones.
 */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RESPALDO } from '../../domain/interesados/vitrina'
import { Vitrina } from './Vitrina'

function montar() {
  return render(<Vitrina anclaFormulario="formulario" />)
}

describe('la vitrina', () => {
  it('dice qué recibe la persona y cuánto cuesta', () => {
    montar()
    expect(screen.getByRole('heading', { name: 'Qué recibes' })).toBeInTheDocument()
    expect(screen.getByText('$225.000')).toBeInTheDocument()
    expect(screen.getByText(/al mes/)).toBeInTheDocument()
  })

  it('cada frase de respaldo se ve con su fuente', () => {
    montar()
    const lista = screen.getByRole('heading', { name: 'En qué nos apoyamos' }).parentElement!
    for (const r of RESPALDO) {
      expect(within(lista).getByText(r.frase)).toBeInTheDocument()
      expect(within(lista).getByText(`Fuente: ${r.fuente}`)).toBeInTheDocument()
    }
  })

  it('el enlace baja al formulario', () => {
    montar()
    expect(screen.getByRole('link', { name: /empezar/i })).toHaveAttribute('href', '#formulario')
  })

  it('no trae campos ni botones: lo único que se toca es el formulario', () => {
    const { container } = montar()
    expect(container.querySelectorAll('input, textarea, select, button, [contenteditable]')).toHaveLength(0)
  })
})
