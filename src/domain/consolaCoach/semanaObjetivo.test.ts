import { describe, expect, it } from 'vitest'
import type { CadenaCorrida } from '../../data/consola/cadenaCorridas'
import { semanaObjetivoDeAcciones } from './semanaObjetivo'

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
    resumen: null,
    avisos: [],
    preguntasPendientes: [],
    creadoEn: '2026-09-28T12:05:00Z',
    ...extra,
  }
}

describe('semanaObjetivoDeAcciones: la semana que se va a cargar, no la que está en curso', () => {
  it('sábado 26-sep con una corrida para 2026-09-28 (posterior al lunes en curso, 21-sep): usa esa', () => {
    const corridas = [corrida({ usuarioId: 'u-1', semanaInicio: '2026-09-28' })]
    expect(semanaObjetivoDeAcciones('u-1', corridas, '2026-09-26')).toBe('2026-09-28')
  })

  it('sin corridas, cae al PRÓXIMO lunes desde hoy', () => {
    // Hoy miércoles 30-sep: el lunes en curso es 28-sep, el siguiente es 5-oct.
    expect(semanaObjetivoDeAcciones('u-1', [], '2026-09-30')).toBe('2026-10-05')
  })

  it('con corridas pero NINGUNA posterior al lunes en curso, también cae al próximo lunes', () => {
    // La cadena ya generó (o está generando) la semana en curso: no cuenta como "la que viene".
    const corridas = [
      corrida({ usuarioId: 'u-1', semanaInicio: '2026-09-14' }),
      corrida({ usuarioId: 'u-1', semanaInicio: '2026-09-21' }), // = lunes en curso, no es "posterior"
    ]
    expect(semanaObjetivoDeAcciones('u-1', corridas, '2026-09-26')).toBe('2026-09-28')
  })

  it('con varias corridas posteriores, usa la MÁS RECIENTE (mayor semana_inicio)', () => {
    const corridas = [
      corrida({ usuarioId: 'u-1', semanaInicio: '2026-09-28' }),
      corrida({ usuarioId: 'u-1', semanaInicio: '2026-10-05' }),
    ]
    expect(semanaObjetivoDeAcciones('u-1', corridas, '2026-09-26')).toBe('2026-10-05')
  })

  it('no cuenta corridas de OTRA persona', () => {
    const corridas = [corrida({ usuarioId: 'otra-persona', semanaInicio: '2026-10-05' })]
    expect(semanaObjetivoDeAcciones('u-1', corridas, '2026-09-26')).toBe('2026-09-28')
  })

  it('hoy ya es lunes: el lunes en curso es hoy mismo, la corrida de hoy no es "posterior"', () => {
    const corridas = [corrida({ usuarioId: 'u-1', semanaInicio: '2026-09-28' })]
    expect(semanaObjetivoDeAcciones('u-1', corridas, '2026-09-28')).toBe('2026-10-05')
  })
})
