/**
 * Tests del `Stepper`, escritos ANTES de refactorizarlo.
 *
 * No tenía ninguno, y es el input con el que se registran carga, reps y RIR en
 * mitad de una serie: una regresión aquí no se ve, se convierte en datos de
 * entrenamiento equivocados y el coach programa el microciclo siguiente sobre
 * ellos.
 *
 * Documentan el comportamiento ACTUAL. Tienen que pasar igual antes y después del
 * refactor; si alguno cambia, el refactor cambió comportamiento.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Stepper } from './Stepper'

/** Envoltorio controlado, como lo usan RegistroSerie y CheckinForm. */
function StepperControlado({
  inicial,
  paso = 1,
  decimal = false,
  minimo,
  maximo,
  alCambiar,
}: {
  inicial: number
  paso?: number
  decimal?: boolean
  minimo?: number
  maximo?: number
  alCambiar?: (n: number) => void
}) {
  const [valor, setValor] = useState(inicial)
  return (
    <Stepper
      etiqueta="Carga"
      sufijo="kg"
      valor={valor}
      paso={paso}
      decimal={decimal}
      minimo={minimo}
      maximo={maximo}
      onCambiar={(n) => {
        setValor(n)
        alCambiar?.(n)
      }}
    />
  )
}

const campo = () => screen.getByLabelText('Carga en kg')

describe('Stepper', () => {
  it('los botones suben y bajan de a un paso', async () => {
    const usuario = userEvent.setup()
    render(<StepperControlado inicial={40} paso={2.5} decimal />)

    await usuario.click(screen.getByLabelText('Subir Carga'))
    expect(campo()).toHaveValue('42.5')

    await usuario.click(screen.getByLabelText('Bajar Carga'))
    expect(campo()).toHaveValue('40')
  })

  it('no baja del mínimo ni sube del máximo', async () => {
    const usuario = userEvent.setup()
    render(<StepperControlado inicial={1} paso={5} minimo={0} maximo={3} />)

    await usuario.click(screen.getByLabelText('Bajar Carga'))
    expect(campo()).toHaveValue('0')

    await usuario.click(screen.getByLabelText('Subir Carga'))
    await usuario.click(screen.getByLabelText('Subir Carga'))
    expect(campo()).toHaveValue('3')
  })

  it('al enfocar, el campo muestra el valor actual (no uno viejo)', async () => {
    const usuario = userEvent.setup()
    render(<StepperControlado inicial={40} paso={2.5} decimal />)

    // Se cambia el valor con los botones, sin tocar el campo…
    await usuario.click(screen.getByLabelText('Subir Carga'))
    await usuario.click(screen.getByLabelText('Subir Carga'))
    expect(campo()).toHaveValue('45')

    // …y al entrar a escribir tiene que estar el valor de ahora, no el inicial.
    await usuario.click(campo())
    expect(campo()).toHaveValue('45')
  })

  it('un valor que cambia desde fuera se ve mientras no se está editando', async () => {
    const usuario = userEvent.setup()
    render(<StepperControlado inicial={10} paso={1} />)

    await usuario.click(screen.getByLabelText('Subir Carga'))
    expect(campo()).toHaveValue('11')
  })

  it('escribir avisa del número y admite estados intermedios como "42."', async () => {
    const alCambiar = vi.fn()
    const usuario = userEvent.setup()
    render(<StepperControlado inicial={40} paso={2.5} decimal alCambiar={alCambiar} />)

    await usuario.clear(campo())
    await usuario.type(campo(), '42.')
    // El texto a medio escribir se respeta: no se normaliza hasta salir.
    expect(campo()).toHaveValue('42.')
    expect(alCambiar).toHaveBeenLastCalledWith(42)

    await usuario.type(campo(), '5')
    expect(alCambiar).toHaveBeenLastCalledWith(42.5)
  })

  it('sin decimal, lo escrito se redondea a entero', async () => {
    const alCambiar = vi.fn()
    const usuario = userEvent.setup()
    render(<StepperControlado inicial={8} paso={1} alCambiar={alCambiar} />)

    await usuario.clear(campo())
    await usuario.type(campo(), '9.7')
    expect(alCambiar).toHaveBeenLastCalledWith(10)
  })

  it('salir con el campo vacío devuelve el valor que había', async () => {
    const usuario = userEvent.setup()
    render(<StepperControlado inicial={12} paso={1} />)

    await usuario.clear(campo())
    await usuario.tab()
    expect(campo()).toHaveValue('12')
  })

  it('salir del campo normaliza lo escrito al rango', async () => {
    const usuario = userEvent.setup()
    render(<StepperControlado inicial={12} paso={1} minimo={0} maximo={20} />)

    await usuario.clear(campo())
    await usuario.type(campo(), '99')
    await usuario.tab()
    expect(campo()).toHaveValue('20')
  })
})
