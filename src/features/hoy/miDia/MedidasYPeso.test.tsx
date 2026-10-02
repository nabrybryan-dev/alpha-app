import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { hoyIso } from '../../../data/dbInstance'
import { reiniciarDb } from '../../../data/mockDb'
import { MedidasYPeso } from './MedidasYPeso'

/**
 * El estado vacío de «Medidas y peso». Sin una sola pesada ni un perímetro, la tarjeta lo
 * dice y ofrece registrar: no pinta una curva plana ni un «0 kg», que se leerían como datos.
 */
beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
})

describe('MedidasYPeso', () => {
  it('sin peso ni medidas lo dice, sin cifra ni curva', () => {
    render(
      <MemoryRouter>
        <MedidasYPeso usuarioId="u-sin-datos" hoy={hoyIso()} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Todavía no hay peso ni medidas/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText(/kilos/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar' })).toHaveAttribute('href', '/bienestar')
  })
})
