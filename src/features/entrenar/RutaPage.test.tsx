import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { requisitosParaPeldano } from '../../domain/nivelesAlfa'
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
  afterEach(() => vi.useRealTimers())

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
    // Los del peldaño al que va, no una lista igual para todos: el 04 es el
    // primero que pide autorregulación real, así que trae un requisito más que
    // los de abajo.
    expect(within(panel as HTMLElement).getAllByRole('listitem')).toHaveLength(
      requisitosParaPeldano(4, { microcicloNumero: 22, sesionesRegistradas: 0, sesionesTotales: 0, seriesPorGrupo: [] }).length,
    )
    expect(panel?.textContent).toMatch(/cansado/i)
  })
  /**
   * LA VÍSPERA. El domingo 6-sep se cargaron catorce microciclos que arrancaban
   * el lunes 7, y las catorce cuentas decían «Descanso» los siete días.
   *
   * Ahora la rejilla se adelanta a la semana que viene, y por eso NINGÚN día
   * está marcado como hoy. Rotularla «Semana 3» sería mentir: la persona busca
   * el día en el que está y no lo encuentra. El título lo dice.
   *
   * Para llegar aquí se atrasa el reloj DESPUÉS de sembrar: el seed fecha su
   * microciclo con `diasAtras(7)` sobre la hora real, así que retrasar «hoy»
   * treinta días deja el arranque en el futuro sin tocar el seed.
   */
  it('si el microciclo aún no ha empezado, el calendario se rotula como la próxima semana', async () => {
    vi.setSystemTime(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    renderizar()

    expect(await screen.findByText(/Próxima semana · Microciclo/)).toBeInTheDocument()
    expect(screen.queryByText(/^Semana \d+ · Microciclo/)).not.toBeInTheDocument()
  })

  it('y con el microciclo ya en marcha el título sigue siendo el de siempre', async () => {
    renderizar()
    expect(await screen.findByText(/^Semana \d+ · Microciclo/)).toBeInTheDocument()
    expect(screen.queryByText(/Próxima semana/)).not.toBeInTheDocument()
  })
})
