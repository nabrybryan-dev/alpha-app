import { describe, expect, it } from 'vitest'
import { construirRanking } from './ranking'
import type { Mensaje, Microciclo, Usuario } from './types'

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

  it('cuenta las series registradas como cargas colocadas', () => {
    const filas = construirRanking(
      { usuarios, microciclos: [microcicloCon('u-a', 3)], adherencias: [], checkins: [] },
      HOY,
    )
    expect(filas.find((f) => f.usuarioId === 'u-a')?.seriesRegistradas).toBe(3)
  })

  it('detecta progresión cuando un ejercicio sube de carga en una sesión posterior', () => {
    const microciclo: Microciclo = {
      ...microcicloCon('u-a', 0),
      sesiones: [40, 45].map((carga, i) => ({
        id: `s-${i}`,
        nombre: `S${i}`,
        orden: i,
        ejercicios: [
          {
            id: `e-${i}`,
            categoria: 'EMPUJE HORIZONTAL',
            nombre: 'Press banca',
            cues: '',
            prescripcion: '',
            descansoMin: 2,
            sets: 1,
            rango: '8-10',
            repsDiana: 8,
            rirObjetivo: 2,
            series: [{ orden: 1, cargaKg: carga, reps: 8, rir: 2 }],
          },
        ],
      })),
    }
    const filas = construirRanking(
      { usuarios, microciclos: [microciclo], adherencias: [], checkins: [] },
      HOY,
    )
    const ana = filas.find((f) => f.usuarioId === 'u-a')
    expect(ana?.ejerciciosProgresados).toBe(1)
    // 2 sesiones completas (3+3) + progresión (4) = 10
    expect(ana?.puntos).toBe(10)
  })

  it('cuenta preguntas al coach en ventana y limita su aporte a 10 puntos', () => {
    const mensajes: Mensaje[] = Array.from({ length: 14 }, (_, i) => ({
      id: `msg-${i}`,
      deId: 'u-a',
      paraId: 'u-coach',
      fechaIso: '2026-07-15T10:00:00.000Z',
      texto: `pregunta ${i}`,
      leido: true,
    }))
    // Mensajes del coach hacia la asesorada no cuentan
    mensajes.push({
      id: 'msg-coach',
      deId: 'u-coach',
      paraId: 'u-a',
      fechaIso: '2026-07-15T10:00:00.000Z',
      texto: 'respuesta',
      leido: true,
    })
    const filas = construirRanking(
      { usuarios, microciclos: [], adherencias: [], checkins: [], mensajes, coachId: 'u-coach' },
      HOY,
    )
    const ana = filas.find((f) => f.usuarioId === 'u-a')
    expect(ana?.preguntas).toBe(14)
    expect(ana?.puntos).toBe(10)
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
