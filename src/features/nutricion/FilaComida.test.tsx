import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { RegistroComida } from '../../domain/types'
import { FilaComida } from './FilaComida'

const REGISTRADA: RegistroComida = {
  id: 'c1',
  usuarioId: 'u-valentina',
  momentoIso: '2026-10-22T13:27:00',
  comida: 'almuerzo',
  cocinadoPorEl: true,
  aceiteG: null,
  salG: null,
  confianza: 'estimado',
  items: [
    {
      id: 'i1',
      alimentoId: 'arroz-blanco-cocido',
      gramos: 150,
      fuePesado: true,
      estadoAsumido: 'cocido',
    },
  ],
}

const VACIA: RegistroComida = {
  ...REGISTRADA,
  id: 'c2',
  momentoIso: '2026-10-22T08:00:00',
  comida: 'desayuno',
  items: [],
}

describe('FilaComida', () => {
  /** La hora de una comida registrada es un dato de lo que pasó. */
  it('la comida registrada enseña la hora en que se anotó', () => {
    render(
      <FilaComida
        comida={REGISTRADA}
        kcal={210}
        resumen="Arroz blanco"
        verKcal
        onAbrir={() => {}}
      />,
    )

    expect(screen.getByText('13:27')).toBeInTheDocument()
  })

  /** La hora por defecto de una comida vacía sigue siendo una promesa. */
  it('la comida vacía no enseña la hora por defecto', () => {
    const { container } = render(
      <FilaComida
        comida={VACIA}
        kcal={0}
        resumen=""
        verKcal
        onAbrir={() => {}}
      />,
    )

    expect(container.textContent).not.toContain('08:00')
  })
})
