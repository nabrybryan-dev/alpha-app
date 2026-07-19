import { describe, expect, it } from 'vitest'
import { diaDeSesion, diaSemanaDe, etiquetaDeSerie, sesionSugerida } from './calendario'
import type { Microciclo, Sesion } from './types'

function sesion(id: string, nombre: string, extra?: Partial<Sesion>): Sesion {
  return { id, nombre, orden: 1, ejercicios: [], ...extra }
}

function microciclo(sesiones: Sesion[]): Microciclo {
  return {
    id: 'm-test',
    usuarioId: 'u1',
    numero: 1,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio: '2026-07-20',
    sesiones,
  }
}

describe('diaDeSesion', () => {
  it('prefiere el campo dia explícito', () => {
    expect(diaDeSesion(sesion('s1', 'FULL BODY A', { dia: 'MARTES' }))).toBe('MARTES')
  })

  it('deduce el día del nombre de la sesión', () => {
    expect(diaDeSesion(sesion('s1', 'FULL BODY A - PIERNA PRIORITARIA (LUNES)'))).toBe('LUNES')
    expect(diaDeSesion(sesion('s2', 'CARDIO HIIT + ZONA 2 (MARTES)'))).toBe('MARTES')
    expect(diaDeSesion(sesion('s3', 'CIRCUITO METABÓLICO + ZONA 2 (SÁBADO)'))).toBe('SÁBADO')
  })

  it('encuentra días con y sin tilde', () => {
    expect(diaDeSesion(sesion('s1', 'UPPER (MIÉRCOLES)'))).toBe('MIÉRCOLES')
    expect(diaDeSesion(sesion('s2', 'UPPER (MIERCOLES)'))).toBe('MIÉRCOLES')
    expect(diaDeSesion(sesion('s3', 'CARDIO (SABADO)'))).toBe('SÁBADO')
  })

  it('devuelve undefined si no hay día', () => {
    expect(diaDeSesion(sesion('s1', 'FULL BODY B'))).toBeUndefined()
  })
})

describe('diaSemanaDe', () => {
  it('convierte fechas ISO al día local', () => {
    expect(diaSemanaDe('2026-07-20')).toBe('LUNES')
    expect(diaSemanaDe('2026-07-25')).toBe('SÁBADO')
    expect(diaSemanaDe('2026-07-26')).toBe('DOMINGO')
  })
})

describe('sesionSugerida', () => {
  const lunes = sesion('s-lun', 'FULL BODY A (LUNES)')
  const martes = sesion('s-mar', 'CARDIO (MARTES)')
  const sinDia = sesion('s-x', 'FULL BODY B')

  it('destaca la sesión pendiente del día actual', () => {
    const r = sesionSugerida(microciclo([lunes, martes]), '2026-07-21', () => false)
    expect(r?.sesion.id).toBe('s-mar')
    expect(r?.esDeHoy).toBe(true)
  })

  it('si hoy no toca ninguna, cae a la primera pendiente en orden', () => {
    const r = sesionSugerida(microciclo([lunes, martes]), '2026-07-23', () => false)
    expect(r?.sesion.id).toBe('s-lun')
    expect(r?.esDeHoy).toBe(false)
  })

  it('salta las sesiones ya registradas aunque sean las de hoy', () => {
    const r = sesionSugerida(microciclo([lunes, martes]), '2026-07-20', (s) => s.id === 's-lun')
    expect(r?.sesion.id).toBe('s-mar')
    expect(r?.esDeHoy).toBe(false)
  })

  it('devuelve undefined con todo registrado', () => {
    expect(sesionSugerida(microciclo([lunes, sinDia]), '2026-07-20', () => true)).toBeUndefined()
  })
})

describe('etiquetaDeSerie', () => {
  it('devuelve la etiqueta de la serie (1-based) cuando existe', () => {
    const ejercicio = { etiquetasSeries: ['TOP', 'BACK-OFF', 'BACK-OFF'] }
    expect(etiquetaDeSerie(ejercicio, 1)).toBe('TOP')
    expect(etiquetaDeSerie(ejercicio, 3)).toBe('BACK-OFF')
    expect(etiquetaDeSerie(ejercicio, 4)).toBeUndefined()
    expect(etiquetaDeSerie({}, 1)).toBeUndefined()
  })
})
