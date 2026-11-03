import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { TotalDia } from '../../domain/nutricion/dia'
import { VISIBILIDAD_POR_DEFECTO } from '../../domain/nutricion/visibilidad'
import { ResumenDia } from './ResumenDia'

const TOTAL: TotalDia = {
  porDia: { kcal: 500, proteina_g: 40, carbos_g: 60, grasa_g: 20 },
  parciales: new Set(),
  margenPct: 10,
}

const META = { kcal: 2000, proteinaG: 120, carbosG: 220, grasaG: 60 }

describe('ResumenDia', () => {
  /** `bg-placa` no existía en el tema: la barra se pintaba sin relleno. */
  it('el relleno de la barra de kcal usa una clase que existe', () => {
    const { container } = render(
      <ResumenDia total={TOTAL} meta={META} visibilidad={VISIBILIDAD_POR_DEFECTO} />,
    )

    const relleno = container.querySelector('[role="progressbar"] > div')
    expect(relleno).toHaveClass('bg-logrado')
    expect(relleno).not.toHaveClass('bg-placa')
  })

  /** Las metas de macros no se tocan: las gobierna `verObjetivoCalorico`. */
  it('sin objetivo calórico las metas de macros también se apagan', () => {
    render(
      <ResumenDia
        total={TOTAL}
        meta={META}
        visibilidad={{ ...VISIBILIDAD_POR_DEFECTO, verObjetivoCalorico: false }}
      />,
    )

    expect(screen.queryByText(/de 120/)).toBeNull()
    expect(screen.getByText(/margen de tu registro/i)).toBeInTheDocument()
  })
})
