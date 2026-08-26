import { describe, expect, it } from 'vitest'
import {
  desviacionRir,
  ejercicioCompleto,
  estadoPreparacion,
  resumenMicrociclo,
  semaforoAsesorado,
  sesionCompleta,
} from './cumplimiento'
import { AL_FALLO } from './objetivoDeIntensidad'
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

  it('sin ejercicios, la cierran sus bloques aunque la etiqueta no diga metabolica', () => {
    // El caso real del 2026-08-25: ZONA 2 + MOVILIDAD marcada `fuerza`, cero
    // ejercicios, dos bloques. Antes no se cerraba nunca por mas que los tildara.
    const zona2: Sesion = { ...sesionBase, nombre: 'ZONA 2 + MOVILIDAD (LUNES)', ejercicios: [] }
    expect(sesionCompleta({ ...zona2, bloquesCardio: [bloque(true), bloque(true)] })).toBe(true)
    expect(sesionCompleta({ ...zona2, bloquesCardio: [bloque(true), bloque(false)] })).toBe(false)
    expect(sesionCompleta({ ...zona2, bloquesCardio: [] })).toBe(false)
  })

  it('una metabolica CON ejercicios ya no se cierra tildando solo los bloques', () => {
    // El caso de las dos asesoradas: sesiones marcadas `metabolica` con 7 y 6
    // ejercicios cargados dentro. Hasta el 2026-08-25 bastaba con tildar los
    // bloques y se daban por completas con los 13 sin registrar — y ese 100 %
    // es el que despues dice «tiene margen sin usar, sube la carga».
    const conEjercicios: Sesion = {
      ...sesionBase,
      tipo: 'metabolica',
      ejercicios: [ejercicio(3, 0)],
      bloquesCardio: [bloque(true), bloque(true)],
    }
    expect(sesionCompleta(conEjercicios)).toBe(false)
    expect(sesionCompleta({ ...conEjercicios, ejercicios: [ejercicio(3, 3)] })).toBe(true)
  })

  it('y una sesion de fuerza no se queda sin cerrar por un calentamiento sin tildar', () => {
    // La otra mitad, que expresamente NO se toco: exigir tambien los bloques
    // bajaria la adherencia de media cartera por un bloque de movilidad.
    const fuerza: Sesion = {
      ...sesionBase,
      ejercicios: [ejercicio(3, 3)],
      bloquesCardio: [bloque(false)],
    }
    expect(sesionCompleta(fuerza)).toBe(true)
  })

  it('y por eso cuenta en el porcentaje con el que se decide la carga', () => {
    const zona2: Sesion = {
      ...sesionBase,
      id: 'z',
      ejercicios: [],
      bloquesCardio: [bloque(true), bloque(true)],
    }
    const micro: Microciclo = {
      id: 'm',
      usuarioId: 'u',
      numero: 1,
      estado: 'activo',
      fechaInicio: '2026-08-25',
      cadenciaDias: 8,
      sesiones: [zona2],
    }
    expect(resumenMicrociclo(micro).pctRegistrado).toBe(100)
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

describe('desviacionRir con el objetivo en FALLO', () => {
  /**
   * Devuelve `undefined` a propósito, y no 0.
   *
   * Restar contra 0 daría cumplimiento perfecto a las dos cosas contrarias: al
   * que se metió en la parcial —que hizo lo pedido— y al que paró en la última
   * repetición completa —que no—. La diferencia entre los dos no está en el RIR,
   * porque una parcial no es una repetición en reserva; está en `extra`, y cómo
   * se lee eso sigue sin decidirse con el coach.
   */
  it('no inventa un número de reserva donde la reserva no existe', () => {
    const series = [
      { orden: 1, cargaKg: 60, reps: 8, rir: 0 },
      { orden: 2, cargaKg: 60, reps: 7, rir: 0 },
    ]
    expect(desviacionRir(AL_FALLO, series)).toBeUndefined()
    // El mismo registro contra RIR 0 sí se mide: son objetivos distintos.
    expect(desviacionRir(0, series)).toBe(0)
  })
})
