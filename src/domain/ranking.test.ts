import { describe, expect, it } from 'vitest'
import { construirRanking } from './ranking'
import type { Microciclo, Usuario } from './types'

const HOY = '2026-07-17'

const usuarios: Usuario[] = [
  { id: 'u-coach', nombre: 'Bryan', rol: 'coach', avatarIniciales: 'B' },
  { id: 'u-a', nombre: 'Ana', rol: 'asesorado', avatarIniciales: 'A' },
  { id: 'u-z', nombre: 'Zoe', rol: 'asesorado', avatarIniciales: 'Z' },
]

function microcicloCon(usuarioId: string, sesionesCompletas: number): Microciclo {
  return {
    id: `m-${usuarioId}`,
    usuarioId,
    numero: 1,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio: '2026-07-10',
    sesiones: Array.from({ length: sesionesCompletas }, (_, i) => ({
      id: `s-${i}`,
      nombre: `S${i}`,
      orden: i,
      ejercicios: [
        {
          id: `e-${i}`,
          categoria: 'EMPUJE HORIZONTAL',
          nombre: 'Press',
          cues: '',
          prescripcion: '',
          descansoMin: 2,
          sets: 1,
          rango: '8-10',
          repsDiana: 8,
          rirObjetivo: 2,
          series: [{ orden: 1, cargaKg: 40, reps: 8, rir: 2 }],
        },
      ],
    })),
  }
}

describe('construirRanking', () => {
  it('excluye al coach y solo rankea asesorados', () => {
    const filas = construirRanking(
      { usuarios, microciclos: [], adherencias: [], checkins: [] },
      HOY,
    )
    expect(filas.map((f) => f.usuarioId).sort()).toEqual(['u-a', 'u-z'])
  })

  it('calcula puntos: 3 por sesión completa, 2 por día sí, 1 por parcial y check-in', () => {
    const filas = construirRanking(
      {
        usuarios,
        microciclos: [microcicloCon('u-a', 2)],
        adherencias: [
          { id: '1', usuarioId: 'u-a', fecha: '2026-07-15', estado: 'si' },
          { id: '2', usuarioId: 'u-a', fecha: '2026-07-16', estado: 'parcial' },
          { id: '3', usuarioId: 'u-a', fecha: '2026-07-14', estado: 'no' },
        ],
        checkins: [{ id: 'c1', usuarioId: 'u-a', fecha: '2026-07-16' }],
      },
      HOY,
    )
    const ana = filas.find((f) => f.usuarioId === 'u-a')
    expect(ana).toMatchObject({ sesionesCompletas: 2, diasCumplidos: 2, checkins: 1, puntos: 10 })
  })

  it('ignora registros fuera de la ventana de 30 días', () => {
    const filas = construirRanking(
      {
        usuarios,
        microciclos: [],
        adherencias: [{ id: '1', usuarioId: 'u-a', fecha: '2026-05-01', estado: 'si' }],
        checkins: [{ id: 'c1', usuarioId: 'u-a', fecha: '2026-05-01' }],
      },
      HOY,
    )
    expect(filas.find((f) => f.usuarioId === 'u-a')?.puntos).toBe(0)
  })

  it('ordena por puntos descendente y desempata por nombre', () => {
    const filas = construirRanking(
      {
        usuarios,
        microciclos: [microcicloCon('u-z', 1)],
        adherencias: [],
        checkins: [],
      },
      HOY,
    )
    expect(filas[0].usuarioId).toBe('u-z')
    const empatadas = construirRanking(
      { usuarios, microciclos: [], adherencias: [], checkins: [] },
      HOY,
    )
    expect(empatadas.map((f) => f.nombre)).toEqual(['Ana', 'Zoe'])
  })
})
