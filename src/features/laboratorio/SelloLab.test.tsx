import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SelloLab } from './SelloLab'

afterEach(cleanup)

const D = [
  { sello: 'evidencia', fuente: 'F1', texto: 'dato publicado' },
  { sello: 'simulado', fuente: 'F2', texto: 'dato simulado' },
  { sello: 'evidencia', fuente: '', texto: 'sin fuente' },
  { sello: 'raro', fuente: 'F3', texto: 'sello raro' },
]

describe('SelloLab', () => {
  it('apagado: el asesorado no ve nada', () => {
    const { container } = render(<SelloLab datos={D} rol="asesorado" />)
    expect(container.innerHTML).toBe('')
  })
  it('encendido: el asesorado solo ve evidencia con su fuente', () => {
    render(<SelloLab datos={D} rol="asesorado" visible />)
    expect(screen.getByText('dato publicado')).toBeTruthy()
    expect(screen.getByText('Fuente: F1')).toBeTruthy()
    expect(screen.queryByText('dato simulado')).toBeNull()
    expect(screen.queryByText('sin fuente')).toBeNull()
    expect(screen.queryByText('sello raro')).toBeNull()
  })
  it('equipo apagado: ve lo válido y la leyenda de que no prescribe', () => {
    render(<SelloLab datos={D} rol="equipo" />)
    expect(screen.getByText('dato simulado')).toBeTruthy()
    expect(screen.getByText(/apagado · no va a prescripción/)).toBeTruthy()
    expect(screen.queryByText('sin fuente')).toBeNull()
  })
  it('sin datos válidos: aviso vacío', () => {
    render(<SelloLab datos={[]} rol="equipo" />)
    expect(screen.getByText(/Sin datos del laboratorio/)).toBeTruthy()
  })
})
