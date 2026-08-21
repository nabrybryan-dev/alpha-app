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

  it('el asesorado sí llega al encoder: medir la barra es parte de entrenar', async () => {
    // Estuvo un rato colgando del panel del coach y era el sitio equivocado: la
    // medición ocurre mientras haces la serie, no mientras revisas a alguien.
    renderizarEn('/entrenar/encoder')
    expect(await screen.findByText('Encoder de cámara')).toBeInTheDocument()
  })

  it('Progreso tiene pestaña propia y el chat sigue alcanzable desde Hoy', async () => {
    renderizarEn('/progreso')
    expect(await screen.findByText('Tu progreso')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(nav.textContent).toMatch(/Progreso/)
    // El chat salió del nav: si tampoco se llegara desde Hoy, quedaría enterrado.
    expect(nav.textContent).not.toMatch(/Chat/)
  })

  it('desde Hoy se llega al chat por la barra del coach', async () => {
    renderizarEn('/')
    // Esperar a CONTENIDO de Hoy, no a la navegación: la barra vive en el
    // layout y aparece al instante, mientras que la página entra por `lazy()`.
    // Esperando la navegación, este test afirmaba sobre un `<main>` que todavía
    // decía "Cargando…" y fallaba o pasaba según lo rápido que resolviera el
    // import. Puso `main` en rojo de forma intermitente.
    await screen.findByText('Escríbele a tu coach')
    const alChat = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/chat')
    expect(alChat.length).toBeGreaterThan(0)
  })

  it('muestra el ranking del equipo en Logros sin exponer datos personales', async () => {
    renderizarEn('/logros')
    expect(await screen.findByText('Nivel general del equipo')).toBeInTheDocument()
    const ranking = screen.getByLabelText('Ranking del Equipo Alpha')
    expect(ranking).toBeInTheDocument()
    // Las 5 categorías nuevas están disponibles
    expect(ranking.textContent).toMatch(/Disciplina/)
    expect(ranking.textContent).toMatch(/Progresión/)
    expect(ranking.textContent).toMatch(/Preguntas/)
    // Solo cumplimiento: la tarjeta no debe filtrar estados personales
    expect(ranking.textContent).not.toMatch(/estrés|sueño|hambre|kg/i)
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

  it('el encoder ya no está en el panel del coach', async () => {
    // Se movió a Entrenar: la medición ocurre mientras haces la serie, no
    // mientras revisas a alguien. Un coach que quiera medir entra con su cuenta
    // de asesorado, como cualquiera que esté entrenando.
    renderizarEn('/coach')
    expect(await screen.findByText('Panel del coach')).toBeInTheDocument()
    expect(screen.queryByText(/Encoder/i)).not.toBeInTheDocument()
  })
})
