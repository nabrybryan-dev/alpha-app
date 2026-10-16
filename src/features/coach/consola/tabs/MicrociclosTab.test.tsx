import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Microciclo } from '../../../../domain/types'

/**
 * LA RUTINA DE CADA DÍA SE VE EN LA CONSOLA (Bryan, 15-oct-2026: «a pesar de que vemos los
 * días de entrenamiento no se logra ver las rutinas», con todos los asesorados).
 *
 * La rejilla de la semana pintaba el nombre de la sesión y «N ejercicios · N cardio», y nada
 * más: para saber qué hacía alguien un día había que abrir su app o pedírselo a Claude. Ahora
 * cada día con sesión es un botón y debajo de la rejilla sale la rutina del día elegido:
 * ejercicios con lo pautado y lo anotado, y los bloques de cardio con sus indicaciones.
 */

const microciclo = {
  id: 'm-prueba-1',
  usuarioId: 'u-1',
  numero: 7,
  estado: 'activo',
  fechaInicio: '2026-10-12',
  cadenciaDias: 7,
  sesiones: [
    {
      id: 's-lun',
      nombre: 'LEG A · FUERZA',
      orden: 1,
      dia: 'LUNES',
      ejercicios: [
        {
          id: 'e1',
          nombre: 'Sentadilla goblet',
          categoria: 'SENTADILLA',
          cues: '',
          prescripcion: '',
          descansoMin: 2,
          sets: 3,
          rango: '10-12',
          repsDiana: 10,
          rirObjetivo: 2,
          cargaKg: 20,
          unidadCarga: 'kg',
          series: [{ orden: 1, cargaKg: 20, reps: 11, rir: 2, confirmada: 'editada' }],
        },
      ],
    },
    {
      id: 's-mie',
      nombre: 'CARDIO · Z2',
      orden: 2,
      dia: 'MIÉRCOLES',
      ejercicios: [],
      bloquesCardio: [
        { id: 'b1', titulo: 'Z2 larga', duracionMin: 50, indicaciones: 'En bici o remo, sin trote.' },
      ],
    },
  ],
} as unknown as Microciclo

vi.mock('../usePersona', () => ({
  usePersona: () => ({
    hoy: '2026-10-12',
    activo: microciclo,
    plan: { estado: 'listo', valor: null },
    historial: { estado: 'listo', valor: [microciclo] },
  }),
}))

const { MicrociclosTab } = await import('./MicrociclosTab')

describe('MicrociclosTab · la rutina del día', () => {
  it('abre con la rutina de hoy: ejercicio, lo pautado y lo anotado', () => {
    render(<MicrociclosTab usuarioId="u-1" />)
    const panel = screen.getByRole('region', { name: /Rutina del/ })
    expect(within(panel).getByText('Sentadilla goblet')).toBeInTheDocument()
    expect(within(panel).getByText(/3 series · 10-12 reps · 20 kg · RIR 2/)).toBeInTheDocument()
    expect(within(panel).getByText(/Anotado: 20 kg × 11 · RIR 2/)).toBeInTheDocument()
  })

  it('al elegir otro día muestra su cardio con minutos e indicaciones', async () => {
    const usuario = userEvent.setup()
    render(<MicrociclosTab usuarioId="u-1" />)
    await usuario.click(screen.getByRole('button', { name: /CARDIO · Z2/ }))
    const panel = screen.getByRole('region', { name: /Rutina del/ })
    expect(within(panel).getByText('Z2 larga')).toBeInTheDocument()
    expect(within(panel).getByText(/50 min/)).toBeInTheDocument()
    expect(within(panel).getByText('En bici o remo, sin trote.')).toBeInTheDocument()
    expect(within(panel).queryByText('Sentadilla goblet')).toBeNull()
  })

  it('el día elegido queda marcado para lectores de pantalla', async () => {
    const usuario = userEvent.setup()
    render(<MicrociclosTab usuarioId="u-1" />)
    const boton = screen.getByRole('button', { name: /CARDIO · Z2/ })
    expect(boton).toHaveAttribute('aria-pressed', 'false')
    await usuario.click(boton)
    expect(boton).toHaveAttribute('aria-pressed', 'true')
  })
})
