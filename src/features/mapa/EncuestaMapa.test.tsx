/**
 * El mapa de vida se responde entero, y solo entonces sale hacia
 * `onGuardar` — el mismo patrón que `CheckinForm`: el componente no habla con
 * la base, quien lo monta decide qué hacer con la respuesta.
 *
 * El test de «llega a donde tiene que llegar» de verdad (hasta la cola de
 * sync) vive en `src/data/nube/mapa-de-vida-sync.test.ts`; aquí se prueba que
 * el formulario junta bien las respuestas y no deja enviar a medias.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EncuestaMapa } from './EncuestaMapa'
import { PREGUNTAS_MAPA_DE_VIDA } from '../../domain/mapaDeVida/preguntas'

function fieldsetDe(texto: string): HTMLElement {
  const legend = screen.getByText(new RegExp(escapeRegExp(texto)))
  const fieldset = legend.closest('fieldset')
  if (!fieldset) throw new Error(`No se encontró el fieldset de "${texto}"`)
  return fieldset as HTMLElement
}

function escapeRegExp(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Responde todas las preguntas con un valor válido para cada tipo. */
function responderTodo() {
  for (const pregunta of PREGUNTAS_MAPA_DE_VIDA) {
    const fieldset = fieldsetDe(pregunta.texto)
    if (pregunta.tipo === 'si_no') {
      fireEvent.click(within(fieldset).getByText('Sí'))
    } else if (pregunta.tipo === 'hora') {
      fireEvent.change(within(fieldset).getByLabelText(pregunta.texto), { target: { value: '08:00' } })
    } else if (pregunta.tipo === 'opcion_multiple' && pregunta.opciones) {
      fireEvent.click(within(fieldset).getByText(pregunta.opciones[0]))
    } else if (pregunta.tipo === 'escala_1_5') {
      fireEvent.click(within(fieldset).getByRole('button', { name: '3 de 5' }))
    }
  }
}

const guardarBtn = () => screen.getByRole('button', { name: /guardar mapa de vida/i })
const TOTAL = PREGUNTAS_MAPA_DE_VIDA.length

describe('la encuesta del mapa de vida', () => {
  afterEach(cleanup)

  it('pinta todas las preguntas, cada una con su enunciado', () => {
    render(<EncuestaMapa onGuardar={vi.fn()} />)
    for (const pregunta of PREGUNTAS_MAPA_DE_VIDA) {
      expect(screen.getByText(new RegExp(escapeRegExp(pregunta.texto)))).toBeInTheDocument()
    }
    expect(screen.getByText(`0 de ${TOTAL} respondidas`)).toBeInTheDocument()
  })

  it('no envía si falta alguna respuesta', () => {
    const onGuardar = vi.fn()
    render(<EncuestaMapa onGuardar={onGuardar} />)
    fireEvent.click(guardarBtn())

    expect(onGuardar).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(`${TOTAL}`)
  })

  it('se responde entera y la respuesta sale completa hacia onGuardar', () => {
    const onGuardar = vi.fn()
    render(<EncuestaMapa onGuardar={onGuardar} />)
    responderTodo()
    expect(screen.getByText(`${TOTAL} de ${TOTAL} respondidas`)).toBeInTheDocument()
    fireEvent.click(guardarBtn())

    expect(onGuardar).toHaveBeenCalledTimes(1)
    const enviado = onGuardar.mock.calls[0][0] as Record<string, string>
    for (const pregunta of PREGUNTAS_MAPA_DE_VIDA) {
      expect(enviado[pregunta.id]).toBeTruthy()
    }
    expect(Object.keys(enviado)).toHaveLength(TOTAL)
  })

  it('retoma lo ya respondido en una vuelta anterior', () => {
    const primera = PREGUNTAS_MAPA_DE_VIDA[0]
    render(<EncuestaMapa respuestasIniciales={{ [primera.id]: 'Sí' }} onGuardar={vi.fn()} />)
    expect(screen.getByText(`1 de ${TOTAL} respondidas`)).toBeInTheDocument()
  })
})
