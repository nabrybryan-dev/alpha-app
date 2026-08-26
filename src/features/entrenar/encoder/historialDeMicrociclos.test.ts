import { describe, expect, it } from 'vitest'
import {
  ejerciciosConMedicion,
  fechaDeLaSesion,
  tomasDeMicrociclos,
} from './historialDeMicrociclos'
import { tramoQueSeñalar, tramosDelHistorial, tieneHora } from './historial'
import type { Microciclo } from '../../../domain/types'

/* Los datos son inventados, con la forma del seed de Valentina. */

function serie(p: { cargaKg?: number; pvPct?: number; calidad?: string; hayEscala?: boolean } = {}) {
  return {
    orden: 1,
    cargaKg: p.cargaKg ?? 100,
    velocidad:
      p.pvPct === undefined
        ? undefined
        : { pvPct: p.pvPct, hayEscala: p.hayEscala ?? true, calidad: p.calidad ?? 'buena' },
  }
}

function micro(numero: number, fechaInicio: string, dia: string, series: unknown[]): Microciclo {
  return {
    id: `m${numero}`,
    usuarioId: 'u1',
    numero,
    cadenciaDias: 8,
    estado: 'cerrado',
    fechaInicio,
    sesiones: [
      {
        id: `s${numero}`,
        nombre: `FULL BODY A (${dia})`,
        orden: 1,
        ejercicios: [
          {
            id: 'e1',
            categoria: 'BISAGRA DE CADERA',
            nombre: 'PESO MUERTO CONVENCIONAL',
            cues: '',
            prescripcion: '',
            descansoMin: 3,
            series,
          },
        ],
      },
    ],
  } as unknown as Microciclo
}

describe('la fecha de una sesión se deriva del día, no del inicio del microciclo', () => {
  it('un microciclo que arranca en lunes coloca el miércoles dos días después', () => {
    // 2026-08-10 es lunes.
    expect(fechaDeLaSesion('2026-08-10', { nombre: 'FULL BODY (MIÉRCOLES)' })).toBe('2026-08-12')
  })

  it('el día se avanza, nunca se retrocede', () => {
    // Un microciclo que arranca en miércoles y una sesión de lunes: el lunes que
    // toca es el SIGUIENTE, no el anterior — ese sería antes de empezar.
    const f = fechaDeLaSesion('2026-08-12', { nombre: 'FULL BODY (LUNES)' })
    expect(f).toBe('2026-08-17')
  })

  it('sin día en el nombre no se coloca en el eje', () => {
    // Ponerla en `fechaInicio` amontonaría todas las sesiones del microciclo como
    // si se hubieran hecho a la vez.
    expect(fechaDeLaSesion('2026-08-10', { nombre: 'FULL BODY A' })).toBeUndefined()
  })
})

describe('la fecha derivada NO trae hora, y eso protege el aviso', () => {
  it('`tieneHora` dice que no', () => {
    expect(tieneHora('2026-08-12')).toBe(false)
    expect(tieneHora('2026-08-12T00:00:00')).toBe(false)
    expect(tieneHora('2026-08-12T18:30:00')).toBe(true)
  })

  it('los tramos se marcan como hora desconocida', () => {
    const tomas = tomasDeMicrociclos(
      [
        micro(1, '2026-08-10', 'LUNES', [serie({ pvPct: 25 })]),
        micro(2, '2026-08-17', 'LUNES', [serie({ pvPct: 31 })]),
      ],
      'PESO MUERTO CONVENCIONAL',
    )
    expect(tramosDelHistorial(tomas)[0].horaDesconocida).toBe(true)
  })

  it('y por eso NO se señala ningún tramo por la hora', () => {
    // Es el fallo que el aviso existe para evitar: decir «una es de mañana y la
    // otra de tarde» sobre dos medianoches derivadas sería inventarse el motivo.
    const tomas = tomasDeMicrociclos(
      [
        micro(1, '2026-08-10', 'LUNES', [serie({ pvPct: 25 })]),
        micro(2, '2026-08-17', 'LUNES', [serie({ pvPct: 31 })]),
      ],
      'PESO MUERTO CONVENCIONAL',
    )
    expect(tramoQueSeñalar(tomas)).toBeUndefined()
  })
})

describe('qué series se convierten en puntos', () => {
  it('cada serie medida es un punto, no una media por sesión', () => {
    // La primera serie y la quinta llegan a fatigas distintas, y esa diferencia
    // es justo lo que el %PV mide.
    const tomas = tomasDeMicrociclos(
      [micro(1, '2026-08-10', 'LUNES', [serie({ pvPct: 22 }), serie({ pvPct: 31 })])],
      'PESO MUERTO CONVENCIONAL',
    )
    expect(tomas.map((t) => t.pvPct)).toEqual([22, 31])
  })

  it('las series sin medir se saltan', () => {
    const tomas = tomasDeMicrociclos(
      [micro(1, '2026-08-10', 'LUNES', [serie(), serie({ pvPct: 28 })])],
      'PESO MUERTO CONVENCIONAL',
    )
    expect(tomas).toHaveLength(1)
  })

  it('solo el ejercicio pedido, comparando sin tildes ni mayúsculas', () => {
    const tomas = tomasDeMicrociclos(
      [micro(1, '2026-08-10', 'LUNES', [serie({ pvPct: 28 })])],
      'peso muerto convencional',
    )
    expect(tomas).toHaveLength(1)
  })

  it('otro ejercicio no entra', () => {
    const tomas = tomasDeMicrociclos(
      [micro(1, '2026-08-10', 'LUNES', [serie({ pvPct: 28 })])],
      'SENTADILLA',
    )
    expect(tomas).toEqual([])
  })
})

describe('qué ejercicios se pueden seguir', () => {
  it('solo los que tienen alguna serie medida', () => {
    const conMedicion = ejerciciosConMedicion([
      micro(1, '2026-08-10', 'LUNES', [serie({ pvPct: 28 })]),
      micro(2, '2026-08-17', 'LUNES', [serie()]),
    ])
    expect(conMedicion).toEqual(['PESO MUERTO CONVENCIONAL'])
  })

  it('sin nada medido, la lista está vacía y no se finge un selector', () => {
    expect(ejerciciosConMedicion([micro(1, '2026-08-10', 'LUNES', [serie()])])).toEqual([])
  })
})
