import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CabeceraPantalla } from './CabeceraPantalla'

describe('CabeceraPantalla', () => {
  it('titula en nivel 2, porque el nivel 1 es del TopBar', () => {
    render(<CabeceraPantalla titulo="Tu plan nutricional" />)

    expect(screen.getByRole('heading', { level: 2, name: 'Tu plan nutricional' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('sin etiqueta no deja una línea vacía sobre el título', () => {
    const { container } = render(<CabeceraPantalla titulo="Tu semana" />)

    expect(container.querySelectorAll('p')).toHaveLength(0)
  })

  it('pinta la etiqueta cuando se le pasa', () => {
    render(<CabeceraPantalla etiqueta="Antes de empezar" titulo="Nos falta un dato tuyo" />)

    expect(screen.getByText('Antes de empezar')).toBeInTheDocument()
  })

  it('sin alVolver no hay botón de volver', () => {
    render(<CabeceraPantalla titulo="Tu semana" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('el botón de volver llama a su callback y anuncia adónde va', async () => {
    const volver = vi.fn()
    render(<CabeceraPantalla titulo="Tu semana" alVolver={volver} etiquetaVolver="Volver al diario" />)

    await userEvent.click(screen.getByRole('button', { name: 'Volver al diario' }))

    expect(volver).toHaveBeenCalledOnce()
  })

  it('muestra el pie y las acciones', () => {
    render(
      <CabeceraPantalla
        titulo="Desayuno"
        pie={<span>420 kcal registradas</span>}
        acciones={<button type="button">Semana</button>}
      />,
    )

    expect(screen.getByText('420 kcal registradas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Semana' })).toBeInTheDocument()
  })

  it('capitaliza solo cuando se le pide', () => {
    const { rerender } = render(<CabeceraPantalla titulo="jueves, 7 de agosto" />)
    expect(screen.getByRole('heading', { level: 2 })).not.toHaveClass('capitalize')

    rerender(<CabeceraPantalla titulo="jueves, 7 de agosto" capitalizar />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveClass('capitalize')
  })
})
