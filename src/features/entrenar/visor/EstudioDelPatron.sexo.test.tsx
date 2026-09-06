import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATRONES } from '../../../domain/patrones/catalogo'
import { EstudioDelPatron } from './EstudioDelPatron'

/**
 * EL SEXO DE LA FICHA LLEGA A LAS DOS VISTAS DEL ESTUDIO.
 *
 * Al visor, tal cual. Al explorador, como valor de ARRANQUE de su selector: el
 * selector sigue existiendo y se puede cambiar a mano, porque el estudio es
 * para mirar y mirar el otro cuerpo también enseña. Y sin dato no se pasa nada:
 * el defecto lo decide cada vista, no el estudio.
 *
 * El visor se sustituye por un espía porque jsdom no tiene WebGL. El explorador
 * se deja de verdad: su selector es DOM y se lee por `aria-pressed`.
 */

const espia = vi.hoisted(() => ({ recibidas: [] as Record<string, unknown>[] }))

vi.mock('./VisorPatron', () => ({
  VisorPatron: (props: Record<string, unknown>) => {
    espia.recibidas.push(props)
    return null
  },
}))

const patron = PATRONES.find((p) => p.id === 'empuje_vertical')!

function ultimoSexo(): unknown {
  const ultima = espia.recibidas[espia.recibidas.length - 1]
  if (!ultima) throw new Error('el estudio no montó el visor ni una vez')
  return ultima.sexo
}

describe('el sexo de la ficha en el estudio del cuerpo', () => {
  beforeEach(() => {
    espia.recibidas.length = 0
  })

  it('sin dato, el visor no recibe sexo y el selector arranca en neutro', async () => {
    const usuario = userEvent.setup()
    render(<EstudioDelPatron patron={patron} />)
    expect(ultimoSexo()).toBeUndefined()

    await usuario.click(screen.getByRole('button', { name: /una articulación/i }))
    expect(screen.getByRole('button', { name: 'Huesos neutros' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('con mujer en la ficha, el visor la recibe tal cual', () => {
    render(<EstudioDelPatron patron={patron} sexo="mujer" />)
    expect(ultimoSexo()).toBe('mujer')
  })

  it('y el selector del explorador ARRANCA en el valor de la ficha', async () => {
    const usuario = userEvent.setup()
    render(<EstudioDelPatron patron={patron} sexo="hombre" />)
    await usuario.click(screen.getByRole('button', { name: /una articulación/i }))
    expect(screen.getByRole('button', { name: 'Huesos de hombre' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Huesos neutros' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('pero sigue pudiéndose cambiar a mano: la ficha es el arranque, no una orden', async () => {
    const usuario = userEvent.setup()
    render(<EstudioDelPatron patron={patron} sexo="mujer" />)
    await usuario.click(screen.getByRole('button', { name: /una articulación/i }))
    expect(screen.getByRole('button', { name: 'Huesos de mujer' })).toHaveAttribute('aria-pressed', 'true')

    await usuario.click(screen.getByRole('button', { name: 'Huesos neutros' }))
    expect(screen.getByRole('button', { name: 'Huesos neutros' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Huesos de mujer' })).toHaveAttribute('aria-pressed', 'false')
    // Y lo que eligió a mano es lo que el explorador le pasa al visor.
    expect(ultimoSexo()).toBe('neutro')
  })
})
