import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SessionProvider } from '../../app/SessionProvider'
import { reiniciarDb } from '../../data/mockDb'
import { db } from '../../data/dbInstance'
import DiarioDia from './DiarioDia'
import { TiraSemana } from './TiraSemana'

/**
 * El rediseño del diario (maqueta v7, paso 5): cabecera, tira con «Semana» y
 * resumen con las cifras en relieve. Escritas antes del código: en rojo contra
 * el anterior.
 */

const pintarDiario = () =>
  render(
    <MemoryRouter>
      <SessionProvider>
        <DiarioDia />
      </SessionProvider>
    </MemoryRouter>,
  )

describe('la cabecera y la tira de la semana', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })

  it('la pantalla se llama Nutrición, con la fecha debajo', () => {
    pintarDiario()
    expect(screen.getByRole('heading', { level: 1, name: 'Nutrición' })).toBeInTheDocument()
    expect(screen.getByText(/diario de comidas/i)).toBeInTheDocument()
  })

  it('la fecha va como se escribe en español: «lunes, 26 de octubre», no «26 De Octubre»', () => {
    // H-12: el `capitalize` de CSS ponía mayúscula en CADA palabra. En español
    // los días y los meses van en minúscula.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      vi.setSystemTime(new Date('2026-10-26T09:00:00'))
      pintarDiario()
      expect(screen.getByText(/lunes, 26 de octubre/)).toBeInTheDocument()
      expect(screen.queryByText(/26 De Octubre/)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('la tira lleva el botón Semana y no deja abrir días que aún no han llegado', () => {
    render(
      <TiraSemana
        fecha="2026-10-21"
        hoy="2026-10-21"
        conRegistro={new Set()}
        onElegir={() => {}}
        onSemana={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: '2026-10-21' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '2026-10-22' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '2026-10-25' })).toBeDisabled()
  })
})

describe('lo que llevas hoy', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })

  it('el resumen se titula y dice que solo suma lo registrado', () => {
    const { container } = pintarDiario()

    expect(screen.getByRole('heading', { name: 'Lo que llevas hoy' })).toBeInTheDocument()
    expect(screen.getByText(/solo suma lo que registras/i)).toBeInTheDocument()
    // kcal + los tres macros, en la cifra con relieve de la maqueta.
    expect(container.querySelectorAll('.cifra-3d').length).toBeGreaterThanOrEqual(4)
  })

  it('una comida vacía no enseña una hora que nadie registró', () => {
    const { container } = pintarDiario()

    // Las horas por defecto (08:00, 13:00, 19:30, 16:00) no se pintan hasta
    // que hay algo anotado: son una promesa, no un dato.
    expect(container.textContent).not.toContain('13:00')
    expect(container.textContent).not.toContain('19:30')
  })
})

describe('el recordatorio quincenal', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })

  /**
   * El rediseño lo quitó del diario y lo dejó solo en «Al día». Vuelve: el
   * diario es donde la asesorada entra a diario, y una pregunta que solo se ve
   * en otra ruta es una pregunta que se pierde.
   */
  it('vive en el diario y lleva a «Al día»', () => {
    const perfil = db.perfilNutricion.byUsuario('u-valentina')
    db.perfilNutricion.guardar(
      'u-valentina',
      { ...perfil?.respuestas, embarazo: 'si', fechaProbableParto: '2027-01-01' },
      true,
    )
    pintarDiario()

    const aviso = screen.getByText(/cuéntanos qué te dijo tu médico/i)
    expect(aviso).toBeInTheDocument()
    expect(aviso.closest('a')).toHaveAttribute('href', '/nutricion/al-dia')
  })
})
