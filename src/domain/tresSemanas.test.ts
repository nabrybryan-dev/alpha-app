import { describe, expect, it } from 'vitest'
import { pieDeLaSemana, tresSemanasDeLaPersona } from './tresSemanas'
import type { BloqueCardio, EjercicioPrescrito, Microciclo, Sesion } from './types'

let n = 0

function micro(numero: number, fechaInicio: string, estado: Microciclo['estado'], extra: Partial<Microciclo> = {}): Microciclo {
  return { id: `m-${numero}-${fechaInicio}`, usuarioId: 'u', numero, cadenciaDias: 7, estado, fechaInicio, sesiones: [], ...extra }
}

function ejercicio(sets: number, hechas: number): EjercicioPrescrito {
  n += 1
  return {
    id: `e-${n}`,
    categoria: 'X',
    nombre: 'Prensa',
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets,
    rango: '8-10',
    repsDiana: 10,
    rirObjetivo: 2,
    cargaKg: 50,
    series: Array.from({ length: hechas }, (_, i) => ({ orden: i + 1, cargaKg: 50, reps: 10 })),
  }
}

function sesion(ejercicios: EjercicioPrescrito[], bloquesCardio?: BloqueCardio[]): Sesion {
  n += 1
  return { id: `s-${n}`, nombre: 'A', orden: n, ejercicios, bloquesCardio }
}

const numeros = (r: ReturnType<typeof tresSemanasDeLaPersona>) => [r.pasada?.microciclo.numero, r.esta?.microciclo.numero, r.siguiente?.microciclo.numero]

describe('tresSemanasDeLaPersona', () => {
  // El caso real del 9-oct-2026 (viernes): el M2 `cerrado` es el que cubre hoy (se cerró porque
  // el siguiente ya se cargó) y el M3 `activo` empieza el lunes que viene.
  const REAL = [
    micro(1, '2026-09-28', 'cerrado'),
    micro(2, '2026-10-05', 'cerrado'),
    micro(3, '2026-10-12', 'activo'),
  ]

  it('el caso real: el cerrado que cubre hoy es «esta» y el activo que empieza el lunes es «la que viene»', () => {
    const r = tresSemanasDeLaPersona(REAL, '2026-10-09')
    expect(numeros(r)).toEqual([1, 2, 3])
    expect(r.pasada?.situacion).toBe('paso')
    expect(r.esta?.situacion).toBe('ahora')
    expect(r.siguiente?.situacion).toBe('viene')
    expect(r.siguiente?.propuesta).toBe(false)
  })

  it('no depende del orden en que llegue el historial', () => {
    expect(numeros(tresSemanasDeLaPersona([...REAL].reverse(), '2026-10-09'))).toEqual([1, 2, 3])
  })

  it('el primer y el último día del intervalo cuentan como dentro', () => {
    expect(tresSemanasDeLaPersona(REAL, '2026-10-05').esta?.microciclo.numero).toBe(2)
    expect(tresSemanasDeLaPersona(REAL, '2026-10-11').esta?.microciclo.numero).toBe(2)
    expect(tresSemanasDeLaPersona(REAL, '2026-10-12').esta?.microciclo.numero).toBe(3)
  })

  it('sin semana siguiente cargada, «la que viene» no existe', () => {
    const r = tresSemanasDeLaPersona(REAL.slice(0, 2), '2026-10-09')
    expect(numeros(r)).toEqual([1, 2, undefined])
  })

  it('sin semana anterior, «la pasada» no existe', () => {
    const r = tresSemanasDeLaPersona(REAL.slice(1), '2026-10-09')
    expect(numeros(r)).toEqual([undefined, 2, 3])
  })

  it('con hoy fuera de todo intervalo, «esta» es la más reciente ya empezada y se dice que ya pasó', () => {
    const r = tresSemanasDeLaPersona(REAL.slice(0, 2), '2026-10-30')
    expect(numeros(r)).toEqual([1, 2, undefined])
    expect(r.esta?.situacion).toBe('paso')
  })

  it('si ninguna ha empezado, no hay «esta» ni «pasada», y «la que viene» es la primera que arranca', () => {
    const r = tresSemanasDeLaPersona(REAL, '2026-09-01')
    expect(numeros(r)).toEqual([undefined, undefined, 1])
    expect(r.siguiente?.situacion).toBe('viene')
  })

  it('un hueco entre microciclos (hoy cae entre dos) usa el último ya empezado', () => {
    const r = tresSemanasDeLaPersona([micro(1, '2026-09-14', 'cerrado'), micro(2, '2026-10-12', 'activo')], '2026-10-01')
    expect(numeros(r)).toEqual([undefined, 1, 2])
    expect(r.esta?.situacion).toBe('paso')
  })

  it('los microciclos de 15 días cubren quince días', () => {
    const quincenas = [micro(1, '2026-09-21', 'cerrado', { cadenciaDias: 15 }), micro(2, '2026-10-06', 'activo', { cadenciaDias: 15 })]
    expect(tresSemanasDeLaPersona(quincenas, '2026-10-05').esta?.microciclo.numero).toBe(1)
    expect(tresSemanasDeLaPersona(quincenas, '2026-10-20').esta?.microciclo.numero).toBe(2)
    expect(tresSemanasDeLaPersona(quincenas, '2026-10-21').esta?.situacion).toBe('paso')
  })

  it('si uno largo y uno corto cubren hoy, gana el de fechaInicio más reciente y el largo queda como la pasada', () => {
    const r = tresSemanasDeLaPersona(
      [micro(1, '2026-09-28', 'cerrado', { cadenciaDias: 15 }), micro(2, '2026-10-05', 'activo')],
      '2026-10-09',
    )
    expect(numeros(r)).toEqual([1, 2, undefined])
  })

  it('un microciclo propuesto como siguiente se marca como propuesta', () => {
    const r = tresSemanasDeLaPersona([micro(2, '2026-10-05', 'activo'), micro(3, '2026-10-12', 'propuesto')], '2026-10-09')
    expect(r.siguiente?.microciclo.numero).toBe(3)
    expect(r.siguiente?.propuesta).toBe(true)
    expect(r.esta?.propuesta).toBe(false)
  })

  it('ignora los microciclos sin fecha de inicio válida', () => {
    const r = tresSemanasDeLaPersona(
      [micro(1, '', 'cerrado'), micro(2, '2026-02-31', 'cerrado'), micro(3, 'pronto', 'activo'), micro(4, '2026-10-05', 'activo')],
      '2026-10-09',
    )
    expect(numeros(r)).toEqual([undefined, 4, undefined])
  })

  it('con una misma fecha de inicio repetida, se queda el que no es propuesto', () => {
    const r = tresSemanasDeLaPersona([micro(5, '2026-10-05', 'propuesto'), micro(4, '2026-10-05', 'activo')], '2026-10-09')
    expect(r.esta?.microciclo.numero).toBe(4)
  })

  it('sin historial no hay nada', () => {
    expect(tresSemanasDeLaPersona([], '2026-10-09')).toEqual({ pasada: undefined, esta: undefined, siguiente: undefined })
  })
})

describe('pieDeLaSemana', () => {
  it('cuenta sesiones con algo anotado y series anotadas contra pedidas', () => {
    const m = micro(2, '2026-10-05', 'cerrado', {
      sesiones: [sesion([ejercicio(3, 3), ejercicio(3, 2)]), sesion([ejercicio(4, 0)]), sesion([ejercicio(2, 0)])],
    })
    expect(pieDeLaSemana(m)).toEqual({ sesionesTotales: 3, sesionesConAlgoAnotado: 1, seriesAnotadas: 5, seriesPedidas: 12 })
  })

  it('una sesión de cardio cuenta como anotada si algún bloque tiene `hechoEn`', () => {
    const bloque = (hechoEn?: string): BloqueCardio => ({ id: `b${n++}`, titulo: 'Trote', indicaciones: '', duracionMin: 20, hechoEn })
    const m = micro(2, '2026-10-05', 'cerrado', { sesiones: [sesion([], [bloque('2026-10-06T10:00:00Z')]), sesion([], [bloque()])] })
    expect(pieDeLaSemana(m)).toEqual({ sesionesTotales: 2, sesionesConAlgoAnotado: 1, seriesAnotadas: 0, seriesPedidas: 0 })
  })
})
