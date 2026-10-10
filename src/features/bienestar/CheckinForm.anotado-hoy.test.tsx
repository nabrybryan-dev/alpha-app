/**
 * UN DATO ARRASTRADO NO ES UN DATO ANOTADO, Y LA APP NO LOS DISTINGUÍA.
 *
 * El formulario abre con el peso y los pasos de la vez anterior, y con 7 horas de sueño. Quien no
 * toca esos tres selectores guarda igual. Salió de los datos reales (9-oct-2026): una persona con
 * el mismo peso en 11 de 12 reportes seguidos, otra con 8.000 pasos en 13 de 14. Con eso no se
 * puede estimar nada: el número parece una medición y es una copia.
 *
 * El número se sigue guardando (otras pantallas lo usan), pero el reporte dice ahora cuáles de
 * esos tres movió la persona ese día: `anotadoHoy`.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CheckinForm } from './CheckinForm'

const GRUPOS = ['¿Cómo estuvo tu rendimiento?', 'Motivación', 'Cansancio', 'Estrés', 'Calidad del sueño', '¿Cómo estuvo tu alimentación?']

function marcarTodos() {
  for (const titulo of GRUPOS) {
    const fieldset = screen.getByText(titulo).closest('fieldset') as HTMLElement
    const opciones = within(fieldset).getAllByRole('button')
    fireEvent.click(opciones[opciones.length - 1])
  }
  fireEvent.click(screen.getByRole('button', { name: 'Hambre 10 de 10' }))
  fireEvent.click(screen.getByRole('button', { name: 'Dolor 0 de 10' }))
}

const guardar = () => fireEvent.click(screen.getByRole('button', { name: /guardar check-in/i }))

describe('el check-in dice qué números movió la persona ese día', () => {
  afterEach(cleanup)

  it('sin tocar nada: guarda el peso arrastrado, pero no lo marca como anotado', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u-ana" fecha="2026-10-09" pesoInicial={72.8} pasosInicial={8000} onGuardar={onGuardar} />)
    marcarTodos()
    guardar()
    const guardado = onGuardar.mock.calls[0][0]
    expect(guardado.pesoKg).toBe(72.8)
    expect(guardado.anotadoHoy).toEqual([])
  })

  it('al mover peso, pasos y sueño, los tres quedan marcados', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u-ana" fecha="2026-10-09" pesoInicial={72.8} pasosInicial={8000} onGuardar={onGuardar} />)
    marcarTodos()
    fireEvent.click(screen.getByRole('button', { name: 'Subir Peso ayunas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Subir Pasos de ayer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bajar' }))
    guardar()
    expect(onGuardar.mock.calls[0][0].anotadoHoy).toEqual(['pesoKg', 'pasos', 'horasSueno'])
  })

  it('mover solo el peso no marca los otros dos', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u-ana" fecha="2026-10-09" pesoInicial={72.8} pasosInicial={8000} onGuardar={onGuardar} />)
    marcarTodos()
    fireEvent.click(screen.getByRole('button', { name: 'Subir Peso ayunas' }))
    guardar()
    expect(onGuardar.mock.calls[0][0].anotadoHoy).toEqual(['pesoKg'])
  })
})
