import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { AppRouter } from '../../app/router'
import { EncuestaNutricion } from './EncuestaNutricion'

/**
 * ARREGLADO. Nació en rojo y hoy pasa; se queda para que no vuelva.
 *
 * El `TopBar` del layout ya emite un `<h1>` en toda ruta de asesorado
 * (`layouts.tsx:56`). Las cinco pantallas de Nutrición añadían otro, así que un
 * lector de pantalla anunciaba dos títulos de nivel 1 en la misma página y la
 * persona perdía la referencia de dónde estaba. Bienestar y Progreso ya lo
 * hacían bien con `<h2>`; Nutrición se quedó fuera del rediseño de agosto.
 *
 * Ahora las cinco pasan por `CabeceraPantalla`, que emite `<h2>` y no deja
 * elegir. Si alguien vuelve a escribir un `<h1>` a mano aquí, esto se pone rojo.
 *
 * Spec: docs/specs/2026-08-07-nutricion-al-lenguaje-del-rediseno.md
 */

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

/** El único `<h1>` legítimo es el del TopBar. */
function titulosDeNivelUno() {
  return screen.getAllByRole('heading', { level: 1 })
}

describe('los encabezados de Nutrición no compiten con el del layout', () => {
  beforeEach(() => localStorage.clear())

  it('el diario del día deja un solo h1 en la página', async () => {
    renderizarEn('/nutricion')
    await screen.findByText(/Tus \d+ comidas de hoy/)

    expect(titulosDeNivelUno()).toHaveLength(1)
  })

  it('Mi plan deja un solo h1 en la página', async () => {
    renderizarEn('/nutricion/plan')
    await screen.findByText('Tu plan nutricional')

    expect(titulosDeNivelUno()).toHaveLength(1)
  })

  it('la vista de la semana deja un solo h1 en la página', async () => {
    renderizarEn('/nutricion')
    await screen.findByText(/Tus \d+ comidas de hoy/)
    await userEvent.click(screen.getByRole('button', { name: 'Semana' }))
    await screen.findByText('Tu semana')

    expect(titulosDeNivelUno()).toHaveLength(1)
  })

  it('el detalle de una comida deja un solo h1 en la página', async () => {
    renderizarEn('/nutricion')
    await screen.findByText(/Tus \d+ comidas de hoy/)
    await userEvent.click(screen.getByRole('button', { name: /Desayuno/i }))
    await screen.findByText(/kcal registradas/)

    expect(titulosDeNivelUno()).toHaveLength(1)
  })

  /**
   * La encuesta se prueba suelta y no por la ruta: la compuerta solo la enseña a
   * quien no la ha respondido, y el seed de Valentina ya la tiene completa.
   * Aquí no hay TopBar, así que lo que se comprueba es que ella misma no
   * reclame el nivel 1 — el que le corresponde al layout que la envuelve.
   */
  it('la encuesta titula en nivel 2, no en nivel 1', () => {
    render(
      <EncuestaNutricion yaSabidos={{}} onGuardarAvance={() => {}} onTerminar={() => {}} />,
    )

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
  })
})
