import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { reiniciarDb } from '../../data/mockDb'
import BienestarPage from './BienestarPage'

/**
 * BIENESTAR SIGUE EL TEMA DE LA PERSONA (decisión de Bryan, 28-oct).
 *
 * Hasta hoy la pantalla forzaba `data-theme="light"` y en oscuro se veía la
 * cabecera y la barra negras sobre un cuerpo hueso: dos apps pegadas. La
 * auditoría lo midió en `semana__m_dark_p1.png` y `bienestar__m_dark_p1.png`.
 *
 * Lo que se comprueba aquí es lo único que jsdom puede ver: que el cuerpo no
 * vuelve a fijar un tema propio. Que en los dos temas se lea bien es del ojo.
 */
function pintar() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter>
          <BienestarPage />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
})

describe('Bienestar · tema', () => {
  it('no fuerza data-theme: hereda el de la persona', () => {
    const { container } = pintar()
    expect(screen.getByRole('heading', { level: 2, name: 'Check-in diario' })).toBeInTheDocument()
    expect(container.querySelector('[data-theme]')).toBeNull()
  })
})
