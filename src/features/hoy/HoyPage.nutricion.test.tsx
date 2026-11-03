/**
 * Hoy del asesorado: la tarjeta «Nutrición de hoy» con su botón «Registrar» (maqueta v7, banda
 * «Lo de hoy», justo después del check-in). Sustituye a la fila «Marcar nutrición de hoy» de
 * «Pendientes de hoy»: la misma pantalla no pide dos veces lo mismo.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db, hoyIso } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
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
afterEach(() => vi.restoreAllMocks())

describe('Hoy del asesorado — Nutrición de hoy', () => {
  it('la banda «Lo de hoy» trae la tarjeta «Nutrición de hoy» con Registrar hacia /nutricion', async () => {
    pintar()
    const hoy = screen.getByRole('region', { name: 'Lo de hoy' })
    const tarjeta = await within(hoy).findByRole('region', { name: 'Nutrición de hoy' })
    const registrar = within(tarjeta).getByRole('link', { name: 'Registrar' })
    expect(registrar.getAttribute('href')).toBe('/nutricion')
  })

  it('la tarjeta va después del check-in', async () => {
    pintar()
    const hoy = screen.getByRole('region', { name: 'Lo de hoy' })
    const tarjeta = await within(hoy).findByRole('region', { name: 'Nutrición de hoy' })
    const chequeo = within(hoy).getByRole('region', { name: 'Chequeo de hoy' })
    expect(Boolean(chequeo.compareDocumentPosition(tarjeta) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  })

  it('«Pendientes de hoy» ya no repite «Marcar nutrición de hoy»', async () => {
    pintar()
    await screen.findByRole('region', { name: 'Nutrición de hoy' })
    expect(screen.queryByText(/Marcar nutrición de hoy/)).not.toBeInTheDocument()
  })

  it('si ya marcó cómo le fue hoy, la tarjeta lo dice: la fila vieja desaparecía al marcar', async () => {
    db.nutricion.marcarAdherencia('u-valentina', hoyIso(), 'parcial')
    pintar()
    const tarjeta = await screen.findByRole('region', { name: 'Nutrición de hoy' })
    expect(tarjeta.textContent).toMatch(/Hoy marcaste: parcial/)
  })

  it('«Registrar» conserva el tamaño de dedo de 44 px en pleno gimnasio', async () => {
    pintar()
    const registrar = await screen.findByRole('link', { name: 'Registrar' })
    expect(registrar.className).toContain('tecla-2')
    expect(registrar.className).not.toMatch(/min-h-/)
  })

  it('con el contador apagado (0018) la tarjeta no enseña calorías; encendido, sí', async () => {
    const vista = pintar()
    const conContador = await screen.findByRole('region', { name: 'Nutrición de hoy' })
    expect(conContador.textContent).toMatch(/kcal/)
    vista.unmount()

    db.visibilidad.decidir({
      usuarioId: 'u-valentina',
      verComposicion: true,
      verObjetivoCalorico: true,
      verContadorKcal: false,
      estado: 'decidido',
    })
    pintar()
    const sinContador = await screen.findByRole('region', { name: 'Nutrición de hoy' })
    expect(sinContador.textContent).not.toMatch(/kcal/)
  })
})
