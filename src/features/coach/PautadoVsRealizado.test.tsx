import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PautadoVsRealizado } from './PautadoVsRealizado'
import type { Microciclo, Sesion } from '../../domain/types'

function micro(sesiones: Sesion[]): Microciclo {
  return {
    id: 'm',
    usuarioId: 'u',
    numero: 1,
    estado: 'activo',
    fechaInicio: '2026-08-25',
    cadenciaDias: 8,
    sesiones,
  }
}

const bloques = [
  { id: 'b1', titulo: 'ZONA 2 · 40 MIN', indicaciones: '' },
  { id: 'b2', titulo: 'MOVILIDAD DE CADERA', indicaciones: '' },
]

describe('PautadoVsRealizado · bloques', () => {
  it('los pinta cuando los hay, aunque la sesion no este marcada metabolica', () => {
    // El caso real: ZONA 2 + MOVILIDAD venia con `tipo: fuerza`, y el coach
    // abria su comparativa y no veia NADA de lo unico que ella tenia que hacer.
    render(
      <PautadoVsRealizado
        microciclo={micro([
          { id: 's1', nombre: 'ZONA 2 + MOVILIDAD (LUNES)', orden: 1, ejercicios: [], bloquesCardio: bloques },
        ])}
      />,
    )
    expect(screen.getByText('ZONA 2 · 40 MIN')).toBeInTheDocument()
    expect(screen.getByText('MOVILIDAD DE CADERA')).toBeInTheDocument()
  })

  it('y los sigue pintando en una metabolica de toda la vida', () => {
    render(
      <PautadoVsRealizado
        microciclo={micro([
          {
            id: 's2',
            nombre: 'METABOLICO (JUEVES)',
            orden: 1,
            tipo: 'metabolica',
            ejercicios: [],
            bloquesCardio: bloques,
          },
        ])}
      />,
    )
    expect(screen.getByText('ZONA 2 · 40 MIN')).toBeInTheDocument()
  })

  it('no pinta lista de bloques cuando la sesion no tiene ninguno', () => {
    render(
      <PautadoVsRealizado
        microciclo={micro([{ id: 's3', nombre: 'PIERNA A (MARTES)', orden: 1, ejercicios: [] }])}
      />,
    )
    expect(screen.queryByText('ZONA 2 · 40 MIN')).not.toBeInTheDocument()
  })
})
