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
  cifraViva = false,
  alCambiar,
}: {
  inicial: number
  paso?: number
  decimal?: boolean
  minimo?: number
  maximo?: number
  cifraViva?: boolean
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
      cifraViva={cifraViva}
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

/**
 * La cifra viva: la respuesta es proporcional a la causa.
 *
 * Esto es lo que separa una reacción de un adorno, y por eso está fijado en un test y
 * no solo en un comentario. Un toque de `+` mueve la cifra un paso y tiene que ser
 * INSTANTÁNEO: un mando que se lo piensa cuando lo tocas se siente roto, no bonito.
 * Un salto grande que llega de fuera —la prescripción del ejercicio siguiente, o el
 * valor que vuelve de medir con la cámara— sí recorre la distancia.
 *
 * Y va apagada por defecto porque este stepper lo comparten nutrición y bienestar,
 * donde la cifra es el resultado de una cuenta y viajar no dice nada. Ocho tests de
 * esas dos áreas se pusieron en rojo el día que se encendió para todos: la prueba de
 * que la primitiva es compartida y de que el opt-in no es timidez.
 */
describe('Stepper · la cifra viva', () => {
  it('sin pedirla, el valor de fuera se ve al instante', () => {
    const { rerender } = render(
      <Stepper etiqueta="Carga" valor={20} paso={1} sufijo="kg" onCambiar={vi.fn()} />,
    )
    rerender(<Stepper etiqueta="Carga" valor={90} paso={1} sufijo="kg" onCambiar={vi.fn()} />)
    expect(campo()).toHaveValue('90')
  })

  it('con `cifraViva`, un salto grande NO aterriza de golpe: viaja', () => {
    const { rerender } = render(
      <Stepper etiqueta="Carga" valor={20} paso={1} sufijo="kg" cifraViva onCambiar={vi.fn()} />,
    )
    rerender(
      <Stepper etiqueta="Carga" valor={90} paso={1} sufijo="kg" cifraViva onCambiar={vi.fn()} />,
    )
    // 70 pasos se topan en el techo de 360 ms, así que en el primer fotograma la cifra
    // todavía está de camino. Si esto empieza a dar '90', la animación dejó de existir.
    expect(campo()).not.toHaveValue('90')
  })

  it('con `cifraViva`, un paso suelto llega a su valor y no se queda por el camino', async () => {
    const usuario = userEvent.setup()
    render(<StepperControlado inicial={20} paso={1} cifraViva />)
    await usuario.click(screen.getByLabelText('Subir Carga'))

    // LO QUE SE AFIRMA AQUÍ, Y LO QUE NO.
    //
    // Se afirma que la cifra ATERRIZA: que meter la animación por medio no deja el
    // mando mostrando un valor viejo. Es la mitad que de verdad puede romperse — la
    // otra ya la cubre el hook, con su red de seguridad por si el navegador congela
    // los fotogramas.
    //
    // NO se afirma que sea instantáneo, aunque lo sea: los 20 ms de un paso caen por
    // debajo de un fotograma, y el reloj de `requestAnimationFrame` en jsdom no es el
    // de un navegador. Un `expect` síncrono aquí no mediría la rapidez — mediría
    // cuándo le apeteció correr al rAF de jsdom, que es un dato sin significado. Esa
    // mitad se comprueba con el dedo, no aquí.
    await screen.findByDisplayValue('21')
  })
})
