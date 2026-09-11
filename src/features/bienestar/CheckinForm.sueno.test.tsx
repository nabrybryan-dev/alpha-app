/**
 * Las dos horas del sueño: a qué hora te acostaste y a qué hora te levantaste.
 *
 * El check-in ya preguntaba CUÁNTAS horas dormiste. Falta CUÁNDO, y no es un
 * matiz: ocho horas de once a siete y ocho horas de tres a once son el mismo
 * número y dos vidas distintas. Sin la hora no se puede calcular el índice de
 * regularidad del sueño —el que está validado con ~60.000 personas— y todo lo
 * circadiano se queda en literatura.
 *
 * Las dos son OPCIONALES a propósito. Un check-in que se bloquea es un
 * check-in que no se hace, y este formulario ya pide ocho campos obligatorios.
 *
 * Visto romperse: TRES de los cuatro dan rojo contra el formulario anterior,
 * que no tenía los campos. El cuarto —que sin contestarlas se guarda igual—
 * pasa contra el viejo por construcción, porque ahí nunca hubo nada que
 * contestar.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CheckinForm } from './CheckinForm'

const GRUPOS = [
  '¿Cómo estuvo tu rendimiento?',
  'Motivación',
  'Cansancio',
  'Estrés',
  'Calidad del sueño',
  '¿Cómo estuvo tu alimentación?',
]

function grupo(titulo: string): HTMLElement {
  const fieldset = screen.getByText(titulo).closest('fieldset')
  if (!fieldset) throw new Error(`No se encontró el fieldset de "${titulo}"`)
  return fieldset as HTMLElement
}

function marcarTodosLosObligatorios() {
  for (const titulo of GRUPOS) {
    const opciones = within(grupo(titulo)).getAllByRole('button')
    fireEvent.click(opciones[opciones.length - 1])
  }
  fireEvent.click(screen.getByRole('button', { name: 'Hambre 10 de 10' }))
  fireEvent.click(screen.getByRole('button', { name: 'Dolor 0 de 10' }))
}

const guardarBtn = () => screen.getByRole('button', { name: /guardar check-in/i })

describe('las dos horas del sueño', () => {
  afterEach(cleanup)

  it('el check-in pregunta a qué hora te acostaste y a qué hora te levantaste', () => {
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={vi.fn()} />)
    expect(screen.getByLabelText('Me acosté a las')).toBeInTheDocument()
    expect(screen.getByLabelText('Me levanté a las')).toBeInTheDocument()
  })

  it('guarda las dos horas tal como se escribieron', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)
    marcarTodosLosObligatorios()
    fireEvent.change(screen.getByLabelText('Me acosté a las'), { target: { value: '23:30' } })
    fireEvent.change(screen.getByLabelText('Me levanté a las'), { target: { value: '06:45' } })
    fireEvent.click(guardarBtn())

    expect(onGuardar).toHaveBeenCalledTimes(1)
    expect(onGuardar.mock.calls[0][0]).toMatchObject({
      horaAcostarse: '23:30',
      horaLevantarse: '06:45',
    })
  })

  it('son opcionales: sin ellas el check-in se guarda igual', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)
    marcarTodosLosObligatorios()
    fireEvent.click(guardarBtn())

    expect(onGuardar).toHaveBeenCalledTimes(1)
    const guardado = onGuardar.mock.calls[0][0]
    // Sin contestar viajan como «no hay dato», nunca como una hora inventada:
    // una medianoche de relleno haría que el índice de regularidad puntuara a
    // alguien por una noche que nadie registró.
    expect(guardado.horaAcostarse).toBeUndefined()
    expect(guardado.horaLevantarse).toBeUndefined()
  })

  it('una sola de las dos también viaja, y la otra queda sin dato', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)
    marcarTodosLosObligatorios()
    fireEvent.change(screen.getByLabelText('Me levanté a las'), { target: { value: '05:15' } })
    fireEvent.click(guardarBtn())

    const guardado = onGuardar.mock.calls[0][0]
    expect(guardado.horaLevantarse).toBe('05:15')
    expect(guardado.horaAcostarse).toBeUndefined()
  })
})
