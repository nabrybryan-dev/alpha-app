import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CheckinDiario } from '../../domain/types'
import { CheckinForm } from './CheckinForm'

/**
 * El check-in A MEDIAS (Bryan, 7-nov-2026): Praxis anotó parte; el formulario arranca con eso, pide solo lo que
 * falta y, al guardar con los 8, deja de ser parcial. Datos inventados (seed de prueba), sin nadie real.
 */
const A_MEDIAS: CheckinDiario = {
  id: 'ck-u-prueba-2026-11-07', usuarioId: 'u-prueba', fecha: '2026-11-07',
  rendimiento: 'REGULAR', calidadSueno: 'MALA', horasSueno: 6, anotadoHoy: ['horasSueno'], parcial: true,
}

const marcarUltima = (titulo: string) => {
  const caja = screen.getByText(titulo).closest('fieldset') as HTMLElement
  const opciones = within(caja).getAllByRole('button')
  fireEvent.click(opciones[opciones.length - 1])
}

function pintar(onGuardar = vi.fn()) {
  render(<CheckinForm usuarioId="u-prueba" fecha="2026-11-07" inicial={A_MEDIAS} onGuardar={onGuardar} />)
  return onGuardar
}

describe('check-in a medias', () => {
  it('arranca con lo ya anotado marcado', () => {
    pintar()
    const rend = screen.getByText('¿Cómo estuvo tu rendimiento?').closest('fieldset') as HTMLElement
    expect(within(rend).getByRole('button', { name: 'REGULAR' }).className).toContain('bg-accion')
    const sueno = screen.getByText('Calidad del sueño').closest('fieldset') as HTMLElement
    expect(within(sueno).getByRole('button', { name: 'MALA' }).className).toContain('bg-accion')
  })

  it('pide solo lo que falta: 6 de los 8', () => {
    const onGuardar = pintar()
    fireEvent.click(screen.getByRole('button', { name: /guardar check-in/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('Te faltan 6 campos')
    expect(onGuardar).not.toHaveBeenCalled()
  })

  it('al completarlo conserva lo anotado y deja de ser parcial', () => {
    const onGuardar = pintar()
    for (const t of ['Motivación', 'Cansancio', 'Estrés', '¿Cómo estuvo tu alimentación?']) marcarUltima(t)
    fireEvent.click(screen.getByRole('button', { name: 'Hambre 5 de 10' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dolor 0 de 10' }))
    fireEvent.click(screen.getByRole('button', { name: /guardar check-in/i }))
    const guardado = onGuardar.mock.calls[0][0] as CheckinDiario
    expect(guardado).toMatchObject({ id: A_MEDIAS.id, rendimiento: 'REGULAR', calidadSueno: 'MALA', horasSueno: 6 })
    expect(guardado.anotadoHoy).toContain('horasSueno')
    expect(guardado.parcial).toBeUndefined()
  })
})
