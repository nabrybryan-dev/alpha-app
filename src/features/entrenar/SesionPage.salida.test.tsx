import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db } from '../../data/dbInstance'
import SesionPage from './SesionPage'

/**
 * Decisión de Bryan (23-oct-2026): en la sesión, el «‹» de la cabecera te devuelve de DONDE VINISTE (Hoy si
 * entraste desde Hoy, la Ruta si entraste desde la Ruta). Antes la tarjeta llevaba su propio enlace «Volver a tu
 * ruta de entrenamiento», que mandaba siempre a la Ruta. Ese enlace ya no existe; la salida es el «‹»
 * (comprobada con el recorrido real en `components/ui/TopBar.test.tsx`).
 */
describe('sesión: la salida', () => {
  it('no pinta su propio enlace a la Ruta', () => {
    const sesion = db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')?.sesiones[0]
    if (!sesion) throw new Error('el seed no trae sesión')
    render(
      <ThemeProvider>
        <SessionProvider>
          <MemoryRouter initialEntries={[`/entrenar/sesion/${sesion.id}`]}>
            <Routes>
              <Route path="/entrenar/sesion/:sesionId" element={<SesionPage />} />
            </Routes>
          </MemoryRouter>
        </SessionProvider>
      </ThemeProvider>,
    )
    expect(screen.getByRole('heading', { name: sesion.nombre })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Volver a tu ruta/ })).toBeNull()
  })
})
