/**
 * C1 — Hoy con anillo, detrás de la bandera `HOY_CON_ANILLO` (apagada por defecto).
 * Apagada: nada cambia. Encendida: aparece el anillo (sin dato, hasta que Bryan decida qué
 * lo alimenta), las tarjetas llevan la clase de 22 px y «Nutrición de hoy» sigue.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { reiniciarDb } from '../../data/mockDb'

const bandera = vi.hoisted(() => ({ valor: false }))
vi.mock('./banderas', () => ({
  get HOY_CON_ANILLO() {
    return bandera.valor
  },
}))

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

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
})
afterEach(() => {
  bandera.valor = false
  vi.restoreAllMocks()
})

describe('Hoy — bandera HOY_CON_ANILLO apagada', () => {
  it('no hay anillo ni clase de 22 px', async () => {
    bandera.valor = false
    const { container } = pintar()
    await screen.findByRole('region', { name: 'Nutrición de hoy' })
    expect(container.querySelector('[data-trazo="pista"]')).toBeNull()
    expect(container.querySelector('.hoy-con-anillo')).toBeNull()
  })
})

describe('Hoy — bandera HOY_CON_ANILLO encendida', () => {
  it('aparece el anillo dentro de «Lo de hoy», sin dato (raya, no cero)', async () => {
    bandera.valor = true
    const { container } = pintar()
    const hoy = screen.getByRole('region', { name: 'Lo de hoy' })
    expect(hoy.querySelector('[data-trazo="pista"]')).not.toBeNull()
    expect(hoy.querySelector('[data-trazo="hecho"]')).toBeNull()
    expect(hoy.querySelector('[data-trazo="hoy"]')).toBeNull()
    expect(container.querySelector('.hoy-con-anillo')).not.toBeNull()
  })

  it('la tarjeta «Nutrición de hoy» sigue con su Registrar', async () => {
    bandera.valor = true
    pintar()
    const hoy = screen.getByRole('region', { name: 'Lo de hoy' })
    const tarjeta = await within(hoy).findByRole('region', { name: 'Nutrición de hoy' })
    expect(within(tarjeta).getByRole('link', { name: 'Registrar' }).getAttribute('href')).toBe('/nutricion')
  })
})
