import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import RutaPage from './RutaPage'

function renderizar() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter>
          <RutaPage />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

describe('RutaPage', () => {
  beforeEach(() => localStorage.clear())

  it('abre en la vista macro: nivel, bloque y escala', async () => {
    renderizar()
    expect(await screen.findByText(/Nivel 03 · RENDIMIENTO/)).toBeInTheDocument()
    expect(screen.getByText('Bloque en curso')).toBeInTheDocument()
    expect(screen.getByText('Escala Alfa')).toBeInTheDocument()
    expect(screen.getByText('Competencias evaluadas')).toBeInTheDocument()
  })

  it('pinta los 7 días de la semana y arranca con hoy seleccionado', async () => {
    renderizar()
    const dias = await screen.findAllByRole('button', { pressed: false })
    // 7 botones de día: uno va seleccionado (pressed) y los otros seis no.
    expect(dias).toHaveLength(6)
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('deja cambiar el día seleccionado', async () => {
    const usuario = userEvent.setup()
    renderizar()
    const noSeleccionados = await screen.findAllByRole('button', { pressed: false })
    await usuario.click(noSeleccionados[0])
    expect(noSeleccionados[0]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('las sesiones de la agenda llevan a su pantalla de sesión', async () => {
    renderizar()
    const enlaces = await screen.findAllByRole('link')
    const aSesiones = enlaces.filter((a) => a.getAttribute('href')?.startsWith('/entrenar/sesion/'))
    expect(aSesiones.length).toBeGreaterThan(0)
  })

  it('no promete un nivel sin decir cuánto falta para el siguiente', async () => {
    renderizar()
    const requisitos = await screen.findByText('Para subir a nivel 04')
    const panel = requisitos.closest('section')
    expect(panel).not.toBeNull()
    expect(within(panel as HTMLElement).getAllByRole('listitem')).toHaveLength(5)
  })
})
