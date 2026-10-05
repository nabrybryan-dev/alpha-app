import { describe, expect, it } from 'vitest'
import { cambioDePeso, perimetrosRecientes, restarDias, serieDePeso, suenoMedio } from './miDia'
import type { CheckinDiario, MedidaCorporal } from './types'

const checkin = (fecha: string, extra: Partial<CheckinDiario> = {}): CheckinDiario => ({
  id: `c-${fecha}`,
  usuarioId: 'u-x',
  fecha,
  ...extra,
})

const medida = (fecha: string, extra: Partial<MedidaCorporal> = {}): MedidaCorporal => ({
  fecha,
  alturaCm: 160,
  perimetros: {},
  ...extra,
})

describe('restarDias', () => {
  it('cruza el fin de mes sin perder días', () => {
    expect(restarDias('2026-10-02', 3)).toBe('2026-09-29')
  })
})

describe('suenoMedio', () => {
  it('promedia solo las noches apuntadas de los últimos siete días', () => {
    const lista = [
      checkin('2026-09-20', { horasSueno: 4 }), // fuera de la ventana
      checkin('2026-09-22', { horasSueno: 7 }),
      checkin('2026-09-25'), // sin apuntar: no es una noche de cero horas
      checkin('2026-09-28', { horasSueno: 7.5 }),
    ]
    expect(suenoMedio(lista, '2026-09-28')).toBe(7.3)
  })

  it('una noche apuntada con 0 horas cuenta: 0 y 8 dan 4, no 8 (E-08)', () => {
    const lista = [checkin('2026-09-27', { horasSueno: 0 }), checkin('2026-09-28', { horasSueno: 8 })]
    expect(suenoMedio(lista, '2026-09-28')).toBe(4)
  })

  it('un valor negativo o no finito no es una noche', () => {
    const lista = [
      checkin('2026-09-26', { horasSueno: -1 }),
      checkin('2026-09-27', { horasSueno: Number.NaN }),
      checkin('2026-09-28', { horasSueno: 6 }),
    ]
    expect(suenoMedio(lista, '2026-09-28')).toBe(6)
  })

  it('sin noches apuntadas no inventa una media', () => {
    expect(suenoMedio([checkin('2026-09-28')], '2026-09-28')).toBeUndefined()
  })
})

describe('serieDePeso', () => {
  it('un peso infinito no entra en la serie (E-09)', () => {
    const serie = serieDePeso(
      [checkin('2026-09-27', { pesoKg: Number.POSITIVE_INFINITY }), checkin('2026-09-28', { pesoKg: 60 })],
      [medida('2026-09-26', { pesoKg: Number.POSITIVE_INFINITY })],
      '2026-09-28',
    )
    expect(serie).toEqual([{ fecha: '2026-09-28', kg: 60 }])
  })

  it('junta check-ins y medidas, ordena, y el check-in manda si coinciden en el día', () => {
    const serie = serieDePeso(
      [checkin('2026-09-27', { pesoKg: 58.4 }), checkin('2026-09-10', { pesoKg: 59 })],
      [medida('2026-09-27', { pesoKg: 60 }), medida('2026-09-01', { pesoKg: 59.5 })],
      '2026-09-28',
    )
    expect(serie).toEqual([
      { fecha: '2026-09-01', kg: 59.5 },
      { fecha: '2026-09-10', kg: 59 },
      { fecha: '2026-09-27', kg: 58.4 },
    ])
  })

  it('deja fuera lo que es más viejo que la ventana y lo que no trae kilos', () => {
    const serie = serieDePeso(
      [checkin('2026-06-01', { pesoKg: 62 }), checkin('2026-09-28')],
      [medida('2026-09-20')],
      '2026-09-28',
      8,
    )
    expect(serie).toEqual([])
  })
})

describe('cambioDePeso', () => {
  it('compara la última pesada con la más reciente de hace al menos dos semanas', () => {
    const cambio = cambioDePeso([
      { fecha: '2026-09-01', kg: 59.5 },
      { fecha: '2026-09-12', kg: 58.7 },
      { fecha: '2026-09-20', kg: 58.6 },
      { fecha: '2026-09-28', kg: 58.4 },
    ])
    expect(cambio).toEqual({ kg: -0.3, dias: 16 })
  })

  it('sin una pesada de hace dos semanas no hay cambio que contar', () => {
    expect(cambioDePeso([{ fecha: '2026-09-27', kg: 58 }, { fecha: '2026-09-28', kg: 58.4 }])).toBeUndefined()
    expect(cambioDePeso([])).toBeUndefined()
  })
})

describe('perimetrosRecientes', () => {
  it('manda la última toma de la tarjeta que traiga perímetros', () => {
    const p = perimetrosRecientes(
      [medida('2026-09-01', { cuerpo: { cinturaCm: 70 } }), medida('2026-09-20', { cuerpo: { cinturaCm: 68, caderasCm: 94 } }), medida('2026-09-25')],
      { cinturaCm: 77 },
    )
    expect(p).toEqual({ cinturaCm: 68, caderasCm: 94, cuelloCm: undefined, fecha: '2026-09-20', fuente: 'medidas' })
  })

  it('sin tarjeta, mira la encuesta de nutrición (las medidas viven en dos tablas)', () => {
    expect(perimetrosRecientes([], { cinturaCm: 77, caderaCm: '82', cuelloCm: 31 })).toEqual({
      cinturaCm: 77,
      caderasCm: 82,
      cuelloCm: 31,
      fuente: 'encuesta',
    })
  })

  it('sin ninguna de las dos, nada', () => {
    expect(perimetrosRecientes([medida('2026-09-01')], {})).toBeUndefined()
    expect(perimetrosRecientes([], undefined)).toBeUndefined()
  })
})
