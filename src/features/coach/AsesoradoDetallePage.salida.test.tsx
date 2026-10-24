import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

/**
 * La ficha no repite un «← Volver a asesorados»: el «‹» de la cabecera (padre `/coach/asesorados` en
 * `app/rutas.ts`, comprobado en `rutas.inventario.test.ts`) ya es esa salida.
 */
vi.mock('../../app/SessionProvider', () => ({
  useSesion: () => ({ usuario: { id: 'u-bryan', nombre: 'Coach', rol: 'coach', avatarIniciales: 'CO' }, esNube: false }),
  useSesionOpcional: () => null,
}))

const { default: AsesoradoDetallePage } = await import('./AsesoradoDetallePage')

describe('ficha del asesorado: la salida', () => {
  it('no pinta su propio enlace de «Volver a asesorados»', () => {
    render(
      <MemoryRouter initialEntries={['/coach/asesorado/u-valentina']}>
        <Routes>
          <Route path="/coach/asesorado/:usuarioId" element={<AsesoradoDetallePage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: /Volver a asesorados/ })).toBeNull()
    expect(document.body.textContent ?? '').not.toMatch(/Volver a asesorados/)
    // La página sí pinta (no es un blanco que pasa la prueba por vacío).
    expect(document.body.textContent?.trim().length).toBeGreaterThan(20)
  })
})
