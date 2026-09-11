/**
 * La tarjeta de la pregunta de la cadena, y las dos formas en que engañaba.
 *
 * LOS ROJOS QUE LA MOTIVAN (2026-09-10, revisión del PR #220), los dos sobre respuestas
 * que la persona no ha dado:
 *
 *   1. Las respuestas se quedaban pegadas de un cuestionario al siguiente. La tarjeta
 *      guarda lo que se va escribiendo y el padre la reutilizaba sin vaciarla; como las
 *      preguntas que redacta la cadena numeran sus casillas igual (`p1`, `p2`), la
 *      siguiente aparecía RELLENADA con lo contestado a la anterior y con el botón ya
 *      activo. Un toque y se enviaba la respuesta equivocada, sobre salud.
 *   2. Una pregunta que la tarjeta no sabe pintar —un `opcion_multiple` sin sus
 *      `opciones`, que la cadena escribe y nadie valida— dejaba el cuestionario
 *      imposible de completar. Y como la app solo enseña el PRIMER pendiente, esa
 *      pregunta rota escondía todas las siguientes para siempre.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Cuestionario } from '../../domain/types'
import { TarjetaPregunta } from './TarjetaPregunta'

const cuestionario = (id: string, preguntas: Cuestionario['preguntas']): Cuestionario => ({
  id,
  titulo: 'Tu coach te pregunta',
  descripcion: '',
  asignadoA: ['u1'],
  preguntas,
})

const TEXTO = { id: 'p1', tipo: 'texto' as const, enunciado: '¿Qué días puedes entrenar?' }

describe('una pregunta que la tarjeta no sabe pintar', () => {
  it('se puede contestar igual, escribiendo', () => {
    const onResponder = vi.fn()
    render(
      <TarjetaPregunta
        // `opcion_multiple` SIN `opciones`: lo que escribe la cadena cuando se
        // equivoca, y el blob llega a la app sin que nadie lo valide.
        pregunta={cuestionario('preg-rota-M3', [
          { id: 'p1', tipo: 'opcion_multiple', enunciado: '¿Cuál de estas?' },
        ])}
        onResponder={onResponder}
      />,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'la segunda' } })
    fireEvent.click(screen.getByRole('button', { name: /responder/i }))
    expect(onResponder).toHaveBeenCalledWith({ p1: 'la segunda' })
  })
})

describe('cada cuestionario empieza vacío', () => {
  it('lo escrito en uno no aparece en el siguiente, aunque la casilla se llame igual', () => {
    const { rerender } = render(
      <TarjetaPregunta pregunta={cuestionario('preg-A-M3', [TEXTO])} onResponder={vi.fn()} />,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'martes y viernes' } })
    expect(screen.getByRole('textbox')).toHaveValue('martes y viernes')

    // La MISMA tarjeta, otra pregunta, y su casilla se llama `p1` igual que la anterior.
    rerender(
      <TarjetaPregunta
        pregunta={cuestionario('preg-B-M4', [{ ...TEXTO, enunciado: '¿Te sigue doliendo?' }])}
        onResponder={vi.fn()}
      />,
    )
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('y no manda lo de la anterior al contestar la nueva', () => {
    const onResponder = vi.fn()
    const { rerender } = render(
      <TarjetaPregunta pregunta={cuestionario('preg-A-M3', [TEXTO])} onResponder={onResponder} />,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'martes y viernes' } })
    // La siguiente numera su casilla DISTINTO, que es donde se ve el arrastre: al
    // contestarla, la respuesta vieja viajaría de polizón dentro del mismo objeto.
    rerender(
      <TarjetaPregunta
        pregunta={cuestionario('preg-B-M4', [
          { id: 'p2', tipo: 'texto', enunciado: '¿Te sigue doliendo?' },
        ])}
        onResponder={onResponder}
      />,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ya no' } })
    fireEvent.click(screen.getByRole('button', { name: /responder/i }))
    expect(onResponder).toHaveBeenCalledWith({ p2: 'ya no' })
  })
})
