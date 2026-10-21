import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import type { Perfil } from '../../domain/types'
import HoyPage from './HoyPage'

function pintar() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter>
          <HoyPage />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

/** La ficha del seed con `avisoPago` dentro, que es como llega de `perfiles.datos`. */
function fichaConAviso(aviso: unknown): void {
  const real = db.perfiles.byUsuario('u-valentina')
  if (!real) throw new Error('el seed no trae ficha de Valentina')
  const ficha = { ...real, avisoPago: aviso } as Perfil
  vi.spyOn(db.perfiles, 'byUsuario').mockImplementation((id) => (id === 'u-valentina' ? ficha : undefined))
}

describe('Hoy: aviso de mensualidad vencida', () => {
  beforeEach(() => reiniciarDb())
  afterEach(() => vi.restoreAllMocks())

  it('sin aviso en la ficha no hay botón de pago', () => {
    pintar()
    expect(screen.queryByRole('link', { name: /pagar mi mensualidad/i })).toBeNull()
  })

  it('con aviso activo y enlace https sale con el nombre y la fecha de los datos', () => {
    fichaConAviso({ venceDesde: '2026-10-05', enlace: 'https://pago.ejemplo.com/x', activo: true })
    pintar()
    expect(screen.getByRole('link', { name: /pagar mi mensualidad/i })).toHaveAttribute('href', 'https://pago.ejemplo.com/x')
    expect(screen.getByText(/Valentina, tu mensualidad de Alpha venció el 5 de octubre/)).toBeInTheDocument()
  })

  it('con enlace http no sale', () => {
    fichaConAviso({ venceDesde: '2026-10-05', enlace: 'http://pago.ejemplo.com/x', activo: true })
    pintar()
    expect(screen.queryByRole('link', { name: /pagar mi mensualidad/i })).toBeNull()
  })

  it('con activo false no sale', () => {
    fichaConAviso({ venceDesde: '2026-10-05', enlace: 'https://pago.ejemplo.com/x', activo: false })
    pintar()
    expect(screen.queryByRole('link', { name: /pagar mi mensualidad/i })).toBeNull()
  })
})
