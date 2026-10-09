import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ConclusionDeSemana } from '../../../domain/presentacionAsesorado'
import { SeccionConclusiones } from './SeccionConclusiones'
import { SeccionVelocidadTecnica } from './SeccionVelocidadTecnica'

function conclusion(n: number, parcial: Partial<ConclusionDeSemana> = {}): ConclusionDeSemana {
  return {
    clave: `m:${n}`,
    titulo: `Semana ${n}`,
    numero: n,
    desde: `2026-09-${String(n).padStart(2, '0')}`,
    paso: 4,
    resumen: `resumen ${n}`,
    avisos: [],
    ...parcial,
  }
}

describe('SeccionConclusiones', () => {
  it('sin conclusiones, una frase', () => {
    render(<SeccionConclusiones corridas={{ estado: 'listo', valor: [] }} conclusiones={[]} />)
    expect(screen.getByText(/no hay conclusiones/)).toBeInTheDocument()
  })

  it('mientras las corridas cargan enseña el esqueleto', () => {
    render(<SeccionConclusiones corridas={{ estado: 'cargando' }} conclusiones={[]} />)
    expect(screen.getByLabelText('Cargando')).toBeInTheDocument()
  })

  it('por semana, el resumen y los avisos tal como están escritos', () => {
    render(
      <SeccionConclusiones
        corridas={{ estado: 'listo', valor: [] }}
        conclusiones={[conclusion(2, { resumen: 'Subió la carga en prensa', avisos: ['Durmió poco', 'Dolor leve en rodilla'] })]}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Semana 2' })).toBeInTheDocument()
    expect(screen.getByText('Subió la carga en prensa')).toBeInTheDocument()
    expect(screen.getByText('Durmió poco')).toBeInTheDocument()
    expect(screen.getByText('Dolor leve en rodilla')).toBeInTheDocument()
  })

  it('deja a la vista las tres más recientes y pliega las anteriores', async () => {
    const user = userEvent.setup()
    const cinco = [5, 4, 3, 2, 1].map((n) => conclusion(n))
    render(<SeccionConclusiones corridas={{ estado: 'listo', valor: [] }} conclusiones={cinco} />)
    expect(screen.getByText('Semanas anteriores (2)')).toBeInTheDocument()
    const plegado = screen.getByText('resumen 1').closest('details')!
    expect(plegado).not.toHaveAttribute('open')
    await user.click(screen.getByText('Semanas anteriores (2)'))
    expect(plegado).toHaveAttribute('open')
  })
})

describe('SeccionVelocidadTecnica', () => {
  it('dice con claridad que todavía no hay mediciones, con el nombre de la persona', () => {
    render(<SeccionVelocidadTecnica nombre="Karin" />)
    expect(
      screen.getByText(
        'Todavía no hay mediciones de velocidad ni tomas de técnica de Karin. Aparecerán aquí cuando el encoder las guarde.',
      ),
    ).toBeInTheDocument()
  })

  it('no contiene ninguna cifra ni tabla ni gráfica: nada que parezca un dato', () => {
    const { container } = render(<SeccionVelocidadTecnica nombre="Karin" />)
    expect(container.textContent).not.toMatch(/\d/)
    expect(container.querySelector('svg, canvas, table, img, li')).toBeNull()
  })
})
