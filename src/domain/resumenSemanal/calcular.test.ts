import { describe, expect, it } from 'vitest'
import type { CheckinDiario, Sesion } from '../types'
import { resumenSemanal } from './calcular'

function sesion(id: string, seriesHechas: number, sets: number): Sesion {
  return {
    id,
    nombre: `Sesión ${id}`,
    orden: 1,
    tipo: 'fuerza',
    ejercicios: [
      {
        id: `${id}-e1`,
        nombre: 'Sentadilla',
        sets,
        series: Array.from({ length: seriesHechas }, (_, i) => ({ numero: i + 1, reps: 8 })),
      },
    ],
  } as unknown as Sesion
}

function checkin(fecha: string, horas?: { a: string; l: string }): CheckinDiario {
  return {
    id: `c-${fecha}`,
    usuarioId: 'u1',
    fecha,
    horaAcostarse: horas?.a,
    horaLevantarse: horas?.l,
  } as CheckinDiario
}

function semanaDeSueno(dias: number): CheckinDiario[] {
  const base = new Date('2026-09-01T00:00:00Z').getTime()
  return Array.from({ length: dias }, (_, i) =>
    checkin(new Date(base + i * 86_400_000).toISOString().slice(0, 10), {
      a: '23:00',
      l: '07:00',
    }),
  )
}

describe('los números de la semana', () => {
  it('cuenta las sesiones hechas contra las pautadas', () => {
    const r = resumenSemanal({
      sesiones: [sesion('a', 3, 3), sesion('b', 1, 3), sesion('c', 3, 3)],
      checkins: [],
    })
    expect(r.sesionesHechas).toBe(2)
    expect(r.sesionesPautadas).toBe(3)
  })

  it('sin sesiones ni check-ins no se cae, y no inventa ceros con cara de dato', () => {
    const r = resumenSemanal({ sesiones: [], checkins: [] })
    expect(r).toMatchObject({ sesionesHechas: 0, sesionesPautadas: 0, checkinsDeLaSemana: 0 })
    expect(r.adherenciaPct).toBeUndefined()
    expect(r.regularidad.estado).toBe('sin-datos')
  })

  it('la ventana de check-ins son siete días, no todo el historial', () => {
    const r = resumenSemanal({ sesiones: [], checkins: semanaDeSueno(30) })
    expect(r.checkinsDeLaSemana).toBe(7)
  })

  it('pero el sueño mira la racha entera: recortarla a siete rompería el índice', () => {
    // Con 7 noches solo hay 5 pares de días vecinos comparables. Si esta
    // función recortara el historial a 7 antes de pasarlo, una persona con
    // treinta noches seguidas perdería su índice sin motivo.
    const r = resumenSemanal({ sesiones: [], checkins: semanaDeSueno(30) })
    expect(r.regularidad).toMatchObject({ estado: 'medido', indice: 100 })
  })

  it('la adherencia pasa tal cual, y sin ella queda sin dato', () => {
    expect(resumenSemanal({ sesiones: [], checkins: [], adherenciaPct: 82 }).adherenciaPct).toBe(82)
    expect(resumenSemanal({ sesiones: [], checkins: [] }).adherenciaPct).toBeUndefined()
  })

  it('no reparte adjetivos: devuelve hechos', () => {
    const r = resumenSemanal({
      sesiones: [sesion('a', 3, 3)],
      checkins: semanaDeSueno(10),
      adherenciaPct: 40,
    })
    // Si algún día alguien mete aquí un «vas mal», este test lo caza: los
    // cortes que separan un bien de un regular los pone el entrenador, no el
    // programa. Se miran los VALORES y no los nombres de campo — la primera
    // versión daba rojo por la palabra «regularidad», que es el nombre de un
    // dato y no un juicio.
    const valores: string[] = []
    const recorrer = (v: unknown) => {
      if (typeof v === 'string') valores.push(v.toLowerCase())
      else if (v && typeof v === 'object') Object.values(v).forEach(recorrer)
    }
    recorrer(r)
    const juicios = /\b(bien|mal|bueno|buena|malo|mala|alta|baja|regular)\b/
    for (const v of valores) expect(v).not.toMatch(juicios)
  })
})
