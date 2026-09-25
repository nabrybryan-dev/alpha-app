import { describe, expect, it } from 'vitest'
import type { CadenaCorrida } from '../../data/consola/cadenaCorridas'
import { bandejaDePreguntas, datosAtrasados, fechaRecepcionMasReciente, filaDeLaPersona } from './tableroAgentes'

function corrida(extra: Partial<CadenaCorrida> = {}): CadenaCorrida {
  return {
    id: 'id-1',
    eventId: 'evento-1',
    runId: 'run-1',
    usuarioId: 'u-1',
    semanaInicio: '2026-09-28',
    paso: 1,
    intento: 1,
    estado: 'completado',
    secuencia: 1,
    hashArtefacto: 'hash-1',
    versionReglas: 'reglas-v1',
    fechaDato: '2026-09-28T12:00:00Z',
    fechaRecepcion: '2026-09-28T12:05:00Z',
    resumen: 'Resumen del paso',
    avisos: [],
    preguntasPendientes: [],
    creadoEn: '2026-09-28T12:05:00Z',
    ...extra,
  }
}

describe('filaDeLaPersona: la semana más reciente de la persona, sin mezclar semanas', () => {
  it('sin corridas de esa persona, pasos vacío y semanaInicio undefined', () => {
    const fila = filaDeLaPersona('u-1', [])
    expect(fila).toEqual({ usuarioId: 'u-1', semanaInicio: undefined, pasos: {} })
  })

  it('se queda con la semana_inicio máxima e ignora corridas de otra persona', () => {
    const corridas = [
      corrida({ id: 'a', usuarioId: 'u-1', semanaInicio: '2026-09-21', paso: 1, secuencia: 1 }),
      corrida({ id: 'b', usuarioId: 'u-1', semanaInicio: '2026-09-28', paso: 1, secuencia: 2 }),
      corrida({ id: 'c', usuarioId: 'u-2', semanaInicio: '2026-10-05', paso: 1, secuencia: 3 }),
    ]
    const fila = filaDeLaPersona('u-1', corridas)
    expect(fila.semanaInicio).toBe('2026-09-28')
    expect(fila.pasos[1]?.id).toBe('b')
  })

  it('dentro de la semana elegida, se queda con la mayor secuencia de cada paso', () => {
    const corridas = [
      corrida({ id: 'a', paso: 2, secuencia: 1, semanaInicio: '2026-09-28' }),
      corrida({ id: 'b', paso: 2, secuencia: 5, semanaInicio: '2026-09-28' }),
    ]
    const fila = filaDeLaPersona('u-1', corridas)
    expect(fila.pasos[2]?.id).toBe('b')
  })

  it('un paso sin evento en la semana elegida queda ausente, no inventado', () => {
    const corridas = [corrida({ id: 'a', paso: 1, semanaInicio: '2026-09-28' })]
    const fila = filaDeLaPersona('u-1', corridas)
    expect(fila.pasos[2]).toBeUndefined()
    expect(fila.pasos[3]).toBeUndefined()
    expect(fila.pasos[4]).toBeUndefined()
  })
})

describe('fechaRecepcionMasReciente', () => {
  it('sin corridas, undefined', () => {
    expect(fechaRecepcionMasReciente([])).toBeUndefined()
  })

  it('la mayor fecha_recepcion de toda la lista, sin importar la persona', () => {
    const corridas = [
      corrida({ fechaRecepcion: '2026-09-20T10:00:00Z' }),
      corrida({ usuarioId: 'u-2', fechaRecepcion: '2026-09-25T12:49:52Z' }),
      corrida({ fechaRecepcion: '2026-09-22T00:00:00Z' }),
    ]
    expect(fechaRecepcionMasReciente(corridas)).toBe('2026-09-25T12:49:52Z')
  })
})

describe('datosAtrasados: la etiqueta de Astra a partir de las 24 h', () => {
  const ahora = new Date('2026-09-25T12:00:00Z')

  it('a menos de 24 h, no está atrasado', () => {
    expect(datosAtrasados('2026-09-25T00:01:00Z', ahora)).toBe(false)
  })

  it('a más de 24 h, sí está atrasado', () => {
    expect(datosAtrasados('2026-09-24T11:00:00Z', ahora)).toBe(true)
  })

  it('justo en el borde de 24 h, no está atrasado (es un ">", no un ">=")', () => {
    expect(datosAtrasados('2026-09-24T12:00:00Z', ahora)).toBe(false)
  })

  it('una fecha inválida no revienta: cuenta como no atrasado', () => {
    expect(datosAtrasados('no-es-una-fecha', ahora)).toBe(false)
  })
})

describe('bandejaDePreguntas: aplana las preguntas de la última semana de cada persona', () => {
  it('vacía cuando nadie tiene preguntas pendientes', () => {
    const filas = [filaDeLaPersona('u-1', [corrida({ preguntasPendientes: [] })])]
    expect(bandejaDePreguntas(filas)).toEqual([])
  })

  it('recoge cada pregunta con su persona y su paso, sin asumir la forma del jsonb', () => {
    const corridas = [
      corrida({ id: 'a', usuarioId: 'u-1', paso: 1, preguntasPendientes: ['¿Texto suelto?'] }),
      corrida({
        id: 'b',
        usuarioId: 'u-1',
        paso: 3,
        preguntasPendientes: [{ texto: 'Objeto con forma libre', plazoHoras: 48 }],
      }),
    ]
    const filas = [filaDeLaPersona('u-1', corridas)]
    const bandeja = bandejaDePreguntas(filas)
    expect(bandeja).toEqual([
      { usuarioId: 'u-1', paso: 1, pregunta: '¿Texto suelto?' },
      { usuarioId: 'u-1', paso: 3, pregunta: { texto: 'Objeto con forma libre', plazoHoras: 48 } },
    ])
  })

  it('varias personas: cada una aporta solo lo suyo', () => {
    const corridasU1 = [corrida({ usuarioId: 'u-1', paso: 1, preguntasPendientes: ['de u-1'] })]
    const corridasU2 = [corrida({ usuarioId: 'u-2', paso: 2, preguntasPendientes: ['de u-2'] })]
    const filas = [filaDeLaPersona('u-1', corridasU1), filaDeLaPersona('u-2', corridasU2)]
    const bandeja = bandejaDePreguntas(filas)
    expect(bandeja.map((p) => p.usuarioId)).toEqual(['u-1', 'u-2'])
  })
})
