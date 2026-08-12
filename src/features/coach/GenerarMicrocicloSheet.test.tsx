import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GenerarMicrocicloSheet } from './GenerarMicrocicloSheet'
import type { EjercicioPrescrito, Microciclo, Sesion } from '../../domain/types'

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'BISAGRA DE CADERA',
    nombre: 'PESO MUERTO RUMANO',
    cues: '',
    prescripcion: '',
    descansoMin: 3,
    sets: 3,
    rango: '8-10',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [
      { orden: 1, cargaKg: 50, reps: 10, rir: 2 },
      { orden: 2, cargaKg: 50, reps: 10, rir: 2 },
      { orden: 3, cargaKg: 50, reps: 10, rir: 2 },
    ],
    ...parcial,
  }
}

function micro(sesiones: Sesion[]): Microciclo {
  return {
    id: 'm22',
    usuarioId: 'u-valentina',
    numero: 22,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio: '2026-07-20',
    sesiones,
  }
}

function unaSesion(ejercicios = [ejercicio()]): Microciclo {
  return micro([{ id: 's1', nombre: 'UPPER A', orden: 1, ejercicios }])
}

function abrir(microciclo?: Microciclo) {
  return render(
    <GenerarMicrocicloSheet
      abierto
      nombreAsesorado="Valentina"
      microciclo={microciclo}
      onCerrar={() => {}}
    />,
  )
}

describe('GenerarMicrocicloSheet', () => {
  it('avisa cuando no hay microciclo del que partir', () => {
    abrir(undefined)
    expect(screen.getByText(/todavía no tiene un microciclo/)).toBeInTheDocument()
  })

  it('titula la propuesta con el número siguiente y el reparto', () => {
    abrir(unaSesion())
    expect(screen.getByText('M23')).toBeInTheDocument()
    expect(screen.getByText(/suben ·/)).toBeInTheDocument()
  })

  it('lista cada ejercicio con su sesión y su motivo', () => {
    abrir(unaSesion())
    expect(screen.getByText(/UPPER A/)).toBeInTheDocument()
    expect(screen.getByText('PESO MUERTO RUMANO')).toBeInTheDocument()
  })

  it('deja claro que la descarga automática no se aplica', () => {
    abrir(unaSesion())
    expect(screen.getByText(/No aplica descarga automática/)).toBeInTheDocument()
  })

  it('ofrece guardar la propuesta', () => {
    abrir(unaSesion())
    expect(screen.getByRole('button', { name: /Guardar como propuesta/i })).toBeInTheDocument()
  })
})

describe('GenerarMicrocicloSheet · REF', () => {
  it('muestra el REF previsto de cada ejercicio con su lectura', () => {
    abrir(unaSesion())
    expect(screen.getByText(/REF/)).toBeInTheDocument()
  })

  /**
   * El aviso salta con la escala **semanal** (> 4,6 = «no recomendado más de una
   * semana»), que suma las sesiones del mismo ejercicio. Doce series repartidas
   * en cuatro sesiones lo cruzan; una sesión sola, no.
   */
  it('avisa del ejercicio que no se sostendría más de una semana', () => {
    const cargado = ejercicio({ sets: 6, repsDiana: 12, rirObjetivo: 0 })
    abrir(
      micro([
        { id: 's1', nombre: 'A', orden: 1, ejercicios: [cargado] },
        { id: 's2', nombre: 'B', orden: 2, ejercicios: [cargado] },
        { id: 's3', nombre: 'C', orden: 3, ejercicios: [cargado] },
        { id: 's4', nombre: 'D', orden: 4, ejercicios: [cargado] },
      ]),
    )
    expect(screen.getByText(/no se sostiene más de una semana/i)).toBeInTheDocument()
  })

  it('no avisa cuando la semana está en rango', () => {
    abrir(unaSesion())
    expect(screen.queryByText(/no se sostiene más de una semana/i)).not.toBeInTheDocument()
  })
})
