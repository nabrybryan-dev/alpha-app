import { describe, expect, it } from 'vitest'
import { resumenSemanalParaPresentar } from './resumenSemanalParaPresentar'
import type { AdherenciaNutricional, CheckinDiario, MedidaCorporal, Microciclo, Sesion } from './types'

const HOY = '2026-10-08'

function sesion(id: string, hecha: boolean): Sesion {
  return {
    id,
    nombre: `Sesión ${id}`,
    orden: 1,
    ejercicios: hecha
      ? [
          {
            id: `${id}-e1`,
            nombre: 'Sentadilla',
            categoria: 'SENTADILLA',
            sets: 1,
            cargaKg: 40,
            unidadCarga: 'kg',
            rirObjetivo: 2,
            repsDiana: 8,
            cues: '',
            prescripcion: '',
            series: [{ orden: 1, reps: 8, rir: 2, cargaKg: 40 }],
          },
        ]
      : [],
  } as Sesion
}

function microciclo(fechaInicio: string, sesiones: Sesion[]): Microciclo {
  return {
    id: 'm-1',
    usuarioId: 'u-1',
    numero: 8,
    cadenciaDias: 7,
    estado: 'activo',
    fechaInicio,
    sesiones,
  }
}

function checkin(fecha: string, horasSueno: number): CheckinDiario {
  return { id: `c-${fecha}`, usuarioId: 'u-1', fecha, horasSueno } as CheckinDiario
}

function adherencia(fecha: string, estado: AdherenciaNutricional['estado']): AdherenciaNutricional {
  return { id: `a-${fecha}`, usuarioId: 'u-1', fecha, estado } as AdherenciaNutricional
}

function medida(fecha: string, pesoKg: number): MedidaCorporal {
  return { fecha, pesoKg, perimetros: {} } as MedidaCorporal
}

describe('resumenSemanalParaPresentar', () => {
  it('sin microciclo, no hay nada que presentar', () => {
    expect(resumenSemanalParaPresentar(undefined, [], [], [], HOY)).toBeUndefined()
  })

  it('cuenta sesiones con el mismo criterio que el salón (resumenMicrociclo)', () => {
    const micro = microciclo('2026-10-05', [sesion('s1', true), sesion('s2', true), sesion('s3', false)])
    const r = resumenSemanalParaPresentar(micro, [], [], [], HOY)
    expect(r?.sesiones).toEqual({ registradas: 2, totales: 3 })
    expect(r?.microcicloNumero).toBe(8)
  })

  it('promedia las horas de sueño SOLO de check-ins dentro del microciclo (arrancó hace 3 días)', () => {
    const micro = microciclo('2026-10-05', [])
    const checkins = [
      checkin('2026-10-03', 9), // antes del microciclo: no cuenta
      checkin('2026-10-06', 7),
      checkin('2026-10-07', 8),
    ]
    const r = resumenSemanalParaPresentar(micro, checkins, [], [], HOY)
    expect(r?.horasSuenoPromedio).toBe(7.5)
  })

  it('con un microciclo viejo, la ventana es rodante de 7 días, no desde el inicio', () => {
    const micro = microciclo('2026-08-01', [])
    const checkins = [
      checkin('2026-09-01', 5), // muy viejo: fuera de la ventana rodante
      checkin('2026-10-02', 6),
      checkin('2026-10-05', 8),
    ]
    const r = resumenSemanalParaPresentar(micro, checkins, [], [], HOY)
    expect(r?.horasSuenoPromedio).toBe(7)
  })

  it('sin check-ins en la ventana, el dato queda ausente — no se inventa un promedio', () => {
    const micro = microciclo('2026-10-05', [])
    const r = resumenSemanalParaPresentar(micro, [checkin('2026-09-01', 5)], [], [], HOY)
    expect(r?.horasSuenoPromedio).toBeUndefined()
  })

  it('la adherencia nutricional es SOLO de esta semana, no la de siempre', () => {
    const micro = microciclo('2026-10-05', [])
    const adherencias = [
      adherencia('2026-09-01', 'no'), // viejo: no debe arrastrar el promedio hacia abajo
      adherencia('2026-10-06', 'si'),
      adherencia('2026-10-07', 'si'),
    ]
    const r = resumenSemanalParaPresentar(micro, [], adherencias, [], HOY)
    expect(r?.adherenciaNutricionPct).toBe(100)
  })

  it('el peso es el más reciente, y el delta contra la MÁS VIEJA dentro de 14 días (la tendencia más larga que cabe, no la más ruidosa)', () => {
    const micro = microciclo('2026-09-20', [])
    const medidas = [
      medida('2026-09-24', 72.6),
      medida('2026-10-01', 72.0),
      medida('2026-10-08', 71.4),
    ]
    const r = resumenSemanalParaPresentar(micro, [], [], medidas, HOY)
    expect(r?.pesoKg).toBe(71.4)
    expect(r?.pesoDelta).toEqual({ kg: -1.2, dias: 14 })
  })

  it('sin ninguna medida, peso y delta quedan ausentes', () => {
    const micro = microciclo('2026-10-05', [])
    const r = resumenSemanalParaPresentar(micro, [], [], [], HOY)
    expect(r?.pesoKg).toBeUndefined()
    expect(r?.pesoDelta).toBeUndefined()
  })

  it('con una sola medida, hay peso pero no delta', () => {
    const micro = microciclo('2026-10-05', [])
    const r = resumenSemanalParaPresentar(micro, [], [], [medida('2026-10-08', 71.4)], HOY)
    expect(r?.pesoKg).toBe(71.4)
    expect(r?.pesoDelta).toBeUndefined()
  })
})
