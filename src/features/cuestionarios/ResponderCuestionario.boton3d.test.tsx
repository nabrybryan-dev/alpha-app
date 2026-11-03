import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Cuestionario } from '../../domain/types'
import { ResponderCuestionario } from './ResponderCuestionario'

const cuestionario = {
  id: 'c1',
  titulo: 'Prueba',
  descripcion: '',
  asignadoA: [],
  preguntas: [{ id: 'p1', enunciado: '¿Dormiste bien?', tipo: 'si_no' }],
} as unknown as Cuestionario

describe('ResponderCuestionario — la acción principal es el botón con cuerpo', () => {
  it('«Enviar respuestas» lleva la clase btn-3d, nace apagado y manda lo respondido', () => {
    const alEnviar = vi.fn()
    render(<ResponderCuestionario cuestionario={cuestionario} onEnviar={alEnviar} />)
    const enviar = screen.getByRole('button', { name: /Enviar respuestas/ })
    expect(enviar).toHaveClass('btn-3d')
    expect(enviar).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }))
    expect(enviar).toBeEnabled()
    fireEvent.click(enviar)
    expect(alEnviar).toHaveBeenCalledWith({ p1: 'Sí' })
  })
})
