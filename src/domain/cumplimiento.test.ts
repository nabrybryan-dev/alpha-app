import { describe, expect, it } from 'vitest'
import {
  desviacionRir,
  ejercicioCompleto,
  estadoPreparacion,
  resumenMicrociclo,
  semaforoAsesorado,
  sesionCompleta,
} from './cumplimiento'
import type { EjercicioPrescrito, Microciclo, Sesion } from './types'

const sesionBase: Sesion = { id: 's', nombre: 'LEG A', orden: 1, ejercicios: [] }
let contadorItems = 0
const bloque = (hecho: boolean) => ({
  id: `b${++contadorItems}`,
  titulo: 't',
  indicaciones: 'i',
  hechoEn: hecho ? '2026-07-17T10:00:00Z' : undefined,
})
const parte = (hecho: boolean) => ({ ...bloque(hecho), tipo: 'movilidad' as const })

describe('sesionCompleta', () => {
  it('sesión de fuerza usa los ejercicios (vacía = incompleta)', () => {
    expect(sesionCompleta(sesionBase)).toBe(false)
  })

  it('metabólica completa cuando todos los bloques están hechos', () => {
    expect(sesionCompleta({ ...sesionBase, tipo: 'metabolica', bloquesCardio: [bloque(true), bloque(true)] })).toBe(true)
    expect(sesionCompleta({ ...sesionBase, tipo: 'metabolica', bloquesCardio: [bloque(true), bloque(false)] })).toBe(false)
    expect(sesionCompleta({ ...sesionBase, tipo: 'metabolica', bloquesCardio: [] })).toBe(false)
  })
})

describe('estadoPreparacion', () => {
  it('hecha / parcial según las partes marcadas', () => {
    expect(estadoPreparacion({ ...sesionBase, preparacion: [parte(true), parte(true)] })).toBe('hecha')
    expect(estadoPreparacion({ ...sesionBase, preparacion: [parte(true), parte(false)] })).toBe('parcial')
  })

  it('sin marcar: pendiente si la sesión no se ha hecho, omitida si ya se hizo', () => {
    expect(estadoPreparacion({ ...sesionBase, preparacion: [parte(false)] })).toBe('pendiente')
    expect(
      estadoPreparacion({
        ...sesionBase,
        preparacion: [parte(false)],
        tipo: 'metabolica',
        bloquesCardio: [bloque(true)],
      }),
    ).toBe('omitida')
  })
})

describe('desviacionRir', () => {
  it('promedio real menos objetivo', () => {
    expect(
      desviacionRir(2, [
        { orden: 1, cargaKg: 40, reps: 8, rir: 1 },
        { orden: 2, cargaKg: 40, reps: 8, rir: 3 },
      ]),
    ).toBe(0)
  })

  it('negativo cuando entrenó más cerca del fallo de lo pautado', () => {
    expect(
      desviacionRir(2, [
        { orden: 1, cargaKg: 40, reps: 8, rir: 0 },
        { orden: 2, cargaKg: 40, reps: 8, rir: 1 },
      ]),
    ).toBe(-1.5)
  })

  it('sin series: no hay desviación calculable', () => {
    expect(desviacionRir(2, [])).toBeUndefined()
  })
})

function ejercicio(sets: number, seriesRegistradas: number): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'EMPUJE HORIZONTAL',
    nombre: 'Press',
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets,
    rango: '(8-10)',
    repsDiana: 9,
    rirObjetivo: 2,
    series: Array.from({ length: seriesRegistradas }, (_, i) => ({
      orden: i + 1,
      cargaKg: 40,
      reps: 9,
      rir: 2,
    })),
  }
}

describe('ejercicioCompleto', () => {
  it('completo cuando registró todas las series pautadas', () => {
    expect(ejercicioCompleto(ejercicio(3, 3))).toBe(true)
    expect(ejercicioCompleto(ejercicio(3, 2))).toBe(false)
  })
})

describe('resumenMicrociclo', () => {
  it('calcula % de sesiones registradas', () => {
    const micro: Microciclo = {
      id: 'm1',
      usuarioId: 'u1',
      numero: 1,
      cadenciaDias: 8,
      estado: 'activo',
      fechaInicio: '2026-07-07',
      sesiones: [
        { id: 's1', nombre: 'A', orden: 1, ejercicios: [ejercicio(3, 3)] },
        { id: 's2', nombre: 'B', orden: 2, ejercicios: [ejercicio(3, 0)] },
      ],
    }
    const r = resumenMicrociclo(micro)
    expect(r.sesionesTotales).toBe(2)
    expect(r.sesionesRegistradas).toBe(1)
    expect(r.pctRegistrado).toBe(50)
  })
})

describe('semaforoAsesorado', () => {
  it('verde al día', () => {
    expect(semaforoAsesorado({ diasSinRegistrar: 0, readinessBaja: false }).color).toBe('verde')
    expect(semaforoAsesorado({ diasSinRegistrar: 1, readinessBaja: false }).color).toBe('verde')
  })
  it('ámbar con 2-3 días sin registrar o readiness baja', () => {
    expect(semaforoAsesorado({ diasSinRegistrar: 2, readinessBaja: false }).color).toBe('ambar')
    expect(semaforoAsesorado({ diasSinRegistrar: 0, readinessBaja: true }).color).toBe('ambar')
  })
  it('rojo con 4 o más días sin registrar', () => {
    expect(semaforoAsesorado({ diasSinRegistrar: 5, readinessBaja: true }).color).toBe('rojo')
  })
})
