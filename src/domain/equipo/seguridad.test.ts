import { describe, expect, it } from 'vitest'
import type { CheckinDiario } from '../types'
import { alarmasDeDolor, UMBRAL_ALARMA_DE_DOLOR } from './seguridad'

/**
 * «La seguridad sale siempre» (maqueta 7 y regla 2 del encargo): el filtro de sombreros no
 * puede esconder una alerta de dolor del check-in. La derivación al coach ya existe; esto solo
 * la pone en una lista para la Bandeja y el Hoy del equipo.
 */

const personas = [
  { id: 'u-mateo', nombre: 'Mateo' },
  { id: 'u-sara', nombre: 'Sara' },
]

function checkin(parcial: Partial<CheckinDiario> & { usuarioId: string; fecha: string }): CheckinDiario {
  return { id: `ck-${parcial.usuarioId}-${parcial.fecha}`, ...parcial }
}

describe('alarmasDeDolor', () => {
  it('el umbral es el mismo del resto de la app (4/10)', () => {
    expect(UMBRAL_ALARMA_DE_DOLOR).toBe(4)
  })

  it('saca el último check-in de cada persona que llega al umbral, con su nombre y el dónde', () => {
    const alarmas = alarmasDeDolor(personas, {
      'u-mateo': [checkin({ usuarioId: 'u-mateo', fecha: '2026-10-20', dolor: 6, dolorDonde: 'hombro derecho' })],
      'u-sara': [checkin({ usuarioId: 'u-sara', fecha: '2026-10-21', dolor: 2 })],
    })
    expect(alarmas).toEqual([
      { usuarioId: 'u-mateo', nombre: 'Mateo', fecha: '2026-10-20', dolor: 6, donde: 'hombro derecho' },
    ])
  })

  it('no avisa por debajo del umbral ni por un check-in viejo ya superado', () => {
    const alarmas = alarmasDeDolor(personas, {
      'u-mateo': [
        checkin({ usuarioId: 'u-mateo', fecha: '2026-10-19', dolor: 7, dolorDonde: 'rodilla' }),
        checkin({ usuarioId: 'u-mateo', fecha: '2026-10-21', dolor: 1 }),
      ],
    })
    expect(alarmas).toEqual([])
  })

  // Borde del umbral (revisión del 25-oct): el 4 avisa y el 3 no. Estaba bien; la prueba lo fija.
  it('el borde: un dolor de 4 sí sale en las alarmas', () => {
    const alarmas = alarmasDeDolor(personas, {
      'u-mateo': [checkin({ usuarioId: 'u-mateo', fecha: '2026-10-21', dolor: 4 })],
    })
    expect(alarmas.map((a) => a.dolor)).toEqual([4])
  })

  it('el borde: un dolor de 3 no sale', () => {
    const alarmas = alarmasDeDolor(personas, {
      'u-mateo': [checkin({ usuarioId: 'u-mateo', fecha: '2026-10-21', dolor: 3 })],
    })
    expect(alarmas).toEqual([])
  })

  it('ordena de más dolor a menos (lo que pide atención primero)', () => {
    const alarmas = alarmasDeDolor(personas, {
      'u-mateo': [checkin({ usuarioId: 'u-mateo', fecha: '2026-10-21', dolor: 5 })],
      'u-sara': [checkin({ usuarioId: 'u-sara', fecha: '2026-10-21', dolor: 9, dolorDonde: 'lumbar' })],
    })
    expect(alarmas.map((a) => a.nombre)).toEqual(['Sara', 'Mateo'])
  })

  it('sin check-ins no inventa alarmas', () => {
    expect(alarmasDeDolor(personas, {})).toEqual([])
  })

  it('un dolor ausente (no contestado) no es cero ni alarma', () => {
    const alarmas = alarmasDeDolor(personas, {
      'u-mateo': [checkin({ usuarioId: 'u-mateo', fecha: '2026-10-21' })],
    })
    expect(alarmas).toEqual([])
  })
})
