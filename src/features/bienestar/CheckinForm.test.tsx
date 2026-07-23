import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CheckinForm } from './CheckinForm'

// Las 7 preguntas cualitativas obligatorias, por el texto de su leyenda.
const GRUPOS = [
  '¿Cómo estuvo tu rendimiento?',
  'Motivación',
  'Hambre',
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

function marcarTodos() {
  for (const titulo of GRUPOS) {
    const opciones = within(grupo(titulo)).getAllByRole('button')
    fireEvent.click(opciones[opciones.length - 1]) // última opción (BUENA / MUCHO)
  }
}

const guardarBtn = () => screen.getByRole('button', { name: /guardar check-in/i })

describe('CheckinForm — validación de campos', () => {
  it('no guarda con campos cualitativos incompletos y avisa cuántos faltan', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)

    fireEvent.click(guardarBtn())

    expect(onGuardar).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Te faltan 7 campos por marcar')
  })

  it('la cuenta del aviso baja a medida que se marcan campos', () => {
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={vi.fn()} />)
    fireEvent.click(guardarBtn())
    expect(screen.getByRole('alert')).toHaveTextContent('7 campos')

    fireEvent.click(within(grupo('Motivación')).getAllByRole('button')[0])
    expect(screen.getByRole('alert')).toHaveTextContent('6 campos')
  })

  it('al completar los 7, el aviso desaparece y guarda con los valores', () => {
    const onGuardar = vi.fn()
    render(<CheckinForm usuarioId="u1" fecha="2026-01-01" onGuardar={onGuardar} />)

    fireEvent.click(guardarBtn()) // intento fallido → aparece el aviso
    expect(screen.getByRole('alert')).toBeInTheDocument()

    marcarTodos()
    expect(screen.queryByRole('alert')).toBeNull() // se limpia al completar

    fireEvent.click(guardarBtn())
    expect(onGuardar).toHaveBeenCalledTimes(1)
    expect(onGuardar.mock.calls[0][0]).toMatchObject({
      usuarioId: 'u1',
      fecha: '2026-01-01',
      rendimiento: 'BUENA',
      motivacion: 'MUCHO',
      alimentacion: 'BUENA',
    })
  })
})
