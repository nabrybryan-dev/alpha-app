import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { reiniciarDb } from '../../data/mockDb'
import type { EstadoAvisos } from '../avisos/estadoAvisos'
import BienestarPage from './BienestarPage'

const avisos = { estado: 'activo' as EstadoAvisos }
vi.mock('../avisos/estadoAvisos', () => ({
  leerEstadoAvisos: () => Promise.resolve(avisos.estado),
}))

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

describe('Bienestar · tarjeta del recordatorio de las 6 pm', () => {
  // Defecto H5 de la revisión del 29-oct: quien apagó los avisos en «Yo» conserva el permiso del navegador
  // (`apagado`) y la tarjeta se le escondía, así que nunca se enteraba de que no recibe el recordatorio.
  it.each<EstadoAvisos>(['apagado', 'sin-preguntar', 'bloqueado', 'no-soportado'])(
    'se ofrece «Ir a Yo» con los avisos en estado «%s»',
    async (estado) => {
      avisos.estado = estado
      pintar()
      expect(await screen.findByRole('link', { name: 'Ir a Yo' })).toHaveAttribute('href', '/yo')
    },
  )

  it('no se ofrece con los avisos activos', async () => {
    avisos.estado = 'activo'
    pintar()
    expect(await screen.findByRole('heading', { level: 2, name: 'Check-in diario' })).toBeInTheDocument()
    // Deja correr la lectura asíncrona del estado antes de afirmar que la tarjeta no está.
    await Promise.resolve()
    expect(screen.queryByRole('link', { name: 'Ir a Yo' })).not.toBeInTheDocument()
  })
})
