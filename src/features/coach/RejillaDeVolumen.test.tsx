import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { EjercicioPrescrito, Microciclo } from '../../domain/types'
import { RejillaDeVolumen } from './RejillaDeVolumen'

let contador = 0

function ejercicio(categoria: string, sets: number): EjercicioPrescrito {
  contador += 1
  return {
    id: `e-${contador}`,
    categoria,
    nombre: categoria,
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets,
    rango: '8-10',
    repsDiana: 8,
    rirObjetivo: 2,
    series: [],
  }
}

function microciclo(numero: number, ejercicios: EjercicioPrescrito[]): Microciclo {
  return {
    id: `m-${numero}`,
    usuarioId: 'u-test',
    numero,
    cadenciaDias: 8,
    estado: 'cerrado',
    fechaInicio: '2026-07-10',
    sesiones: [{ id: `s-${numero}`, nombre: 'LEG A', orden: 1, ejercicios }],
  }
}

function filaDe(grupo: string): HTMLElement {
  const fila = screen.getByRole('rowheader', { name: grupo }).closest('tr')
  expect(fila).not.toBeNull()
  return fila as HTMLElement
}

describe('RejillaDeVolumen', () => {
  it('pinta una columna por microciclo, en orden de bloque', () => {
    render(
      <RejillaDeVolumen
        microciclos={[
          microciclo(12, [ejercicio('SENTADILLA', 9)]),
          microciclo(3, [ejercicio('SENTADILLA', 5)]),
        ]}
      />,
    )
    const cabeceras = screen.getAllByRole('columnheader').map((c) => c.textContent)
    expect(cabeceras).toEqual(['Grupo', 'M3', 'M12', 'Total'])
  })

  it('muestra las series de cada grupo y su total', () => {
    render(
      <RejillaDeVolumen
        microciclos={[
          microciclo(1, [ejercicio('EXTENSIÓN DE RODILLA', 3)]),
          microciclo(2, [ejercicio('EXTENSIÓN DE RODILLA', 5)]),
        ]}
      />,
    )
    const celdas = within(filaDe('Cuádriceps')).getAllByRole('cell').map((c) => c.textContent)
    expect(celdas).toEqual(['3', '5', '8'])
  })

  /**
   * Un grupo que descansó una semana no puede verse igual que uno que nunca se
   * programó: el punto medio dice «aquí no tocó», el hueco no diría nada.
   */
  it('marca con un punto el microciclo en que el grupo no se tocó', () => {
    render(
      <RejillaDeVolumen
        microciclos={[
          microciclo(1, [ejercicio('FLEXIÓN DE CODO', 4)]),
          microciclo(2, [ejercicio('SENTADILLA', 6)]),
        ]}
      />,
    )
    const celdas = within(filaDe('Bíceps')).getAllByRole('cell').map((c) => c.textContent)
    expect(celdas).toEqual(['4', '·', '4'])
  })

  it('escribe las medias series con coma', () => {
    render(<RejillaDeVolumen microciclos={[microciclo(1, [ejercicio('EMPUJE HORIZONTAL', 3)])]} />)
    const celdas = within(filaDe('Tríceps')).getAllByRole('cell').map((c) => c.textContent)
    expect(celdas).toEqual(['1,5', '1,5'])
  })

  it('cada celda dice en su título de qué grupo y microciclo es', () => {
    render(<RejillaDeVolumen microciclos={[microciclo(7, [ejercicio('SENTADILLA', 4)])]} />)
    expect(screen.getByTitle('Cuádriceps · M7 · 4 series')).toBeInTheDocument()
  })

  it('sin volumen que mostrar no pinta una tabla vacía', () => {
    render(<RejillaDeVolumen microciclos={[microciclo(1, [ejercicio('PREV/REHAB', 4)])]} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText(/Sin volumen que mostrar/i)).toBeInTheDocument()
  })

  it('sin microciclos tampoco revienta', () => {
    render(<RejillaDeVolumen microciclos={[]} />)
    expect(screen.getByText(/Sin volumen que mostrar/i)).toBeInTheDocument()
  })

  it('dice en qué moneda cuenta, que no es evidente al leer un 1,5', () => {
    render(<RejillaDeVolumen microciclos={[microciclo(1, [ejercicio('SENTADILLA', 4)])]} />)
    expect(screen.getByText(/el indirecto 0,5/i)).toBeInTheDocument()
  })
})
