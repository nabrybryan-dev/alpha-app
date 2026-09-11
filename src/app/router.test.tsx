import { configure, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from './SessionProvider'
import { ThemeProvider } from './ThemeProvider'
import { AppRouter } from './router'

/**
 * ESTE FICHERO NECESITA MÁS MARGEN QUE EL RESTO, Y ESTÁ MEDIDO.
 *
 * Cada caso monta el router ENTERO, que trae 21 rutas perezosas (`lazy()`), así que
 * es el fichero más pesado del suite. El presupuesto general de `src/test/setup.ts`
 * son 10 s por espera, y contra eso el margen se come solo cuando la máquina va justa:
 *
 *     suite normal, 6 corridas ......... 2.391 – 6.062 ms  (el fichero entero)
 *     dos suites en paralelo, 2 corridas .. 11.000 – 12.000 ms
 *
 * Cinco veces más lento con solo el DOBLE de carga. Con 10 s por espera, una espera
 * suelta se planta en el límite en cuanto el equipo tiene algo más corriendo — y este
 * equipo trabaja con ~2 GB libres de 15. El 2026-09-07 el fichero salió rojo 2 de 5
 * corridas en una sesión cargada, y en 11 corridas en una sesión tranquila, ninguna.
 *
 * NO ES UN REINTENTO NI UN PERDÓN: los nueve casos afirman exactamente lo mismo y
 * siguen fallando si el elemento no llega. Lo único que cambia es el tiempo que se le
 * concede a un `lazy()` para resolver en una máquina ocupada. Si algún día el fichero
 * tarda de verdad 30 s, eso es un problema real y esta puerta lo dirá.
 *
 * Y EL ORDEN DE LOS DOS NÚMEROS NO ES CAPRICHO: el límite del test tiene que quedar
 * POR ENCIMA de la espera, como avisa `src/test/setup.ts`. Al revés, el test muere por
 * su propio timeout antes de que la espera se rinda, y el error no dice qué elemento
 * faltaba — según ese comentario, ya costó dos diagnósticos.
 */
vi.setConfig({ testTimeout: 45_000, hookTimeout: 45_000 })
configure({ asyncUtilTimeout: 30_000 })

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
