/**
 * «Mi nutrición de hoy» (E-10 de la revisión de Codex del 28-sep): la app todavía no sabe
 * qué tipo de día es hoy (el diario también fija ALTO), así que la tarjeta DICE qué meta usa
 * en vez de callarlo. Con los datos ficticios del seed de Valentina.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { hoyIso } from '../../../data/dbInstance'
import { reiniciarDb } from '../../../data/mockDb'
import MiNutricionDeHoy from './MiNutricionDeHoy'

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
})

describe('MiNutricionDeHoy', () => {
  it('sin tipo de día elegido, dice que mide contra la meta del día ALTO', () => {
    render(
      <MemoryRouter>
        <MiNutricionDeHoy usuarioId="u-valentina" hoy={hoyIso()} />
      </MemoryRouter>,
    )
    const tarjeta = screen.getByRole('region', { name: 'Mi nutrición de hoy' })
    expect(within(tarjeta).getByText(/Meta del día ALTO/)).toBeInTheDocument()
    expect(within(tarjeta).getByText(/todavía no se elige el tipo de día/)).toBeInTheDocument()
  })

  it('sin plan no inventa una meta', () => {
    render(
      <MemoryRouter>
        <MiNutricionDeHoy usuarioId="u-nadie" hoy={hoyIso()} />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/Meta del día/)).not.toBeInTheDocument()
  })
})
