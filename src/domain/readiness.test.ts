import { describe, expect, it } from 'vitest'
import { desviacionRirMedia, indiceRecuperacion } from './readiness'
import type { Microciclo } from './types'

const HOY = '2026-07-18'

describe('indiceRecuperacion', () => {
  it('devuelve undefined sin check-ins en la ventana', () => {
    const r = indiceRecuperacion(
      [{ id: 'c', usuarioId: 'u', fecha: '2026-06-01', estres: 'POCO' }],
      HOY,
    )
    expect(r.indice).toBeUndefined()
    expect(r.dias).toBe(0)
  })

  it('puntúa alto con señales frescas y bajo con fatiga', () => {
    const fresco = indiceRecuperacion(
      [{ id: 'a', usuarioId: 'u', fecha: '2026-07-17', cansancio: 'POCO', estres: 'POCO', motivacion: 'MUCHO', calidadSueno: 'BUENA', horasSueno: 8 }],
      HOY,
    )
    const fatigado = indiceRecuperacion(
      [{ id: 'b', usuarioId: 'u', fecha: '2026-07-17', cansancio: 'MUCHO', estres: 'MUCHO', motivacion: 'POCO', calidadSueno: 'MALA', horasSueno: 4 }],
      HOY,
    )
    expect(fresco.indice).toBe(100)
    expect(fatigado.indice).toBeLessThan(20)
  })

  it('promedia varios días e ignora señales ausentes', () => {
    const r = indiceRecuperacion(
      [
        { id: 'a', usuarioId: 'u', fecha: '2026-07-16', estres: 'POCO' },
        { id: 'b', usuarioId: 'u', fecha: '2026-07-17', estres: 'MUCHO' },
      ],
      HOY,
    )
    expect(r.dias).toBe(2)
    expect(r.indice).toBe(55)
  })
})

describe('desviacionRirMedia', () => {
  const base = {
    id: 'm', usuarioId: 'u', numero: 1, cadenciaDias: 8 as const,
    estado: 'activo' as const, fechaInicio: '2026-07-10',
  }
  const ejercicio = (rirObjetivo: number, rirsReales: number[]) => ({
    id: `e-${rirObjetivo}-${rirsReales.join()}`, categoria: 'X', nombre: 'X', cues: '',
    prescripcion: '', descansoMin: 2, sets: rirsReales.length, rango: '8-10',
    repsDiana: 8, rirObjetivo,
    series: rirsReales.map((rir, i) => ({ orden: i + 1, cargaKg: 40, reps: 8, rir })),
  })

  it('positivo cuando entrena más lejos del fallo que lo pautado', () => {
    const micro: Microciclo = {
      ...base,
      sesiones: [{ id: 's', nombre: 'S', orden: 1, ejercicios: [ejercicio(2, [4, 4, 4])] }],
    }
    expect(desviacionRirMedia(micro)).toBe(2)
  })

  it('undefined sin series registradas o sin microciclo', () => {
    const micro: Microciclo = {
      ...base,
      sesiones: [{ id: 's', nombre: 'S', orden: 1, ejercicios: [ejercicio(2, [])] }],
    }
    expect(desviacionRirMedia(micro)).toBeUndefined()
    expect(desviacionRirMedia(undefined)).toBeUndefined()
  })
})
