/**
 * El formulario de salud pregunta también qué días puede entrenar (0065).
 *
 * POR QUÉ AQUÍ Y NO EN UNA PARADA DE LA CADENA. Los 27 perfiles de producción guardan
 * cuántos días entrena cada persona y ninguno cuáles (medido el 10-sep-2026). El cerebro
 * no puede inventar un día (I-38), así que sin este dato se detiene a preguntarlo en la
 * primera corrida de cada persona: 27 paradas de pago para llenar un hueco que se llena
 * con una pantalla. El circuito de preguntas es para lo que cambia; un formulario es para
 * lo que nunca se preguntó.
 *
 * Las tres cosas que se pueden equivocar en silencio: que los días no lleguen al perfil,
 * que lleguen desordenados (el orden del toque y no el de la semana), y que se pueda
 * enviar el cribado sin haber dicho ningún día.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CribadoForm } from './CribadoForm'

function contestarTodoQueNo() {
  for (const boton of screen.getAllByRole('button', { name: 'No' })) fireEvent.click(boton)
}

function montar(guardarDias = vi.fn(), contestar = vi.fn(() => 'guardado' as const)) {
  render(
    <CribadoForm
      usuarioId={`p-${Math.random().toString(36).slice(2)}`}
      guardarDias={guardarDias}
      contestar={contestar}
      hoyIso="2026-09-10"
    />,
  )
  return { guardarDias, contestar }
}

describe('los días que puede entrenar', () => {
  it('llegan al perfil, y en el orden de la semana aunque se marquen al revés', () => {
    const { guardarDias } = montar()
    contestarTodoQueNo()
    fireEvent.click(screen.getByRole('button', { name: 'Viernes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Martes' }))
    fireEvent.click(screen.getByRole('button', { name: /^enviar$/i }))
    expect(guardarDias).toHaveBeenCalledWith(['MARTES', 'VIERNES'])
  })

  it('sin ningún día no se envía nada, y se dice', () => {
    const { guardarDias, contestar } = montar()
    contestarTodoQueNo()
    fireEvent.click(screen.getByRole('button', { name: /^enviar$/i }))
    expect(screen.getByText(/marca al menos un día/i)).toBeInTheDocument()
    expect(guardarDias).not.toHaveBeenCalled()
    expect(contestar).not.toHaveBeenCalled()
  })

  it('un día marcado dos veces se desmarca', () => {
    const { guardarDias } = montar()
    contestarTodoQueNo()
    fireEvent.click(screen.getByRole('button', { name: 'Lunes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Jueves' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lunes' }))
    fireEvent.click(screen.getByRole('button', { name: /^enviar$/i }))
    expect(guardarDias).toHaveBeenCalledWith(['JUEVES'])
  })

  it('los días se guardan ANTES que el cribado: valen por sí solos', () => {
    const orden: string[] = []
    montar(
      vi.fn(() => {
        orden.push('dias')
      }),
      vi.fn(() => {
        orden.push('cribado')
        return 'guardado' as const
      }),
    )
    contestarTodoQueNo()
    fireEvent.click(screen.getByRole('button', { name: 'Sábado' }))
    fireEvent.click(screen.getByRole('button', { name: /^enviar$/i }))
    expect(orden).toEqual(['dias', 'cribado'])
  })
})
