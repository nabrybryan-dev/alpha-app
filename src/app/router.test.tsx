import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from './SessionProvider'
import { ThemeProvider } from './ThemeProvider'
import { AppRouter } from './router'

function renderizarEn(ruta: string) {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <AppRouter />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

describe('rutas del asesorado', () => {
  beforeEach(() => localStorage.clear())

  it('monta la cáscara con navegación inferior', async () => {
    renderizarEn('/')
    expect(await screen.findByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
    expect(screen.getAllByText('Hoy').length).toBeGreaterThan(0)
  })

  it('resuelve las pestañas principales', async () => {
    renderizarEn('/entrenar')
    expect(await screen.findByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
  })

  it('redirige /coach al inicio cuando la sesión es de asesorado', async () => {
    renderizarEn('/coach')
    expect(await screen.findByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
  })
})

describe('rutas del coach', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('alpha-usuario', 'u-bryan')
  })

  it('muestra el panel del coach', async () => {
    renderizarEn('/coach')
    expect(await screen.findByText('Panel del coach')).toBeInTheDocument()
  })
})
