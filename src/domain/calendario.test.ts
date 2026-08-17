import { describe, expect, it } from 'vitest'
import {
  diaDeSesion,
  diaSemanaDe,
  etiquetaDeSerie,
  inicioProximaSemana,
  semanaDelAnio,
  sesionSugerida,
} from './calendario'
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

describe('semanaDelAnio', () => {
  it('numera la semana ISO', () => {
    expect(semanaDelAnio('2026-08-01')).toBe(31)
    expect(semanaDelAnio('2026-01-01')).toBe(1)
    expect(semanaDelAnio('2026-12-31')).toBe(53)
  })

  it('los 7 días de una misma semana comparten número', () => {
    // Lunes 2026-07-27 a domingo 2026-08-02.
    const numeros = [27, 28, 29, 30, 31].map((d) => semanaDelAnio(`2026-07-${d}`))
    numeros.push(semanaDelAnio('2026-08-01'), semanaDelAnio('2026-08-02'))
    expect(new Set(numeros).size).toBe(1)
  })

  it('los primeros días de enero pueden caer en la última semana del año anterior', () => {
    // 2027-01-01 es viernes: pertenece a la semana 53 de 2026.
    expect(semanaDelAnio('2027-01-01')).toBe(53)
  })
})

describe('inicioProximaSemana', () => {
  it('desde cualquier día de la semana cae en el lunes siguiente', () => {
    // 2026-08-03 es lunes. Toda la semana anterior apunta a él.
    expect(inicioProximaSemana('2026-07-28')).toBe('2026-08-03') // martes
    expect(inicioProximaSemana('2026-07-29')).toBe('2026-08-03') // miércoles
    expect(inicioProximaSemana('2026-07-30')).toBe('2026-08-03') // jueves
    expect(inicioProximaSemana('2026-07-31')).toBe('2026-08-03') // viernes
    expect(inicioProximaSemana('2026-08-01')).toBe('2026-08-03') // sábado
    expect(inicioProximaSemana('2026-08-02')).toBe('2026-08-03') // domingo
  })

  /**
   * El caso que decide el `+1`: en lunes, «la próxima semana» es la de dentro de
   * siete días. Devolver el mismo día haría que programar un lunes por la mañana
   * le pisara al asesorado la semana que acaba de empezar.
   */
  it('un lunes devuelve el lunes de después, no el mismo día', () => {
    expect(inicioProximaSemana('2026-08-03')).toBe('2026-08-10')
  })

  it('cruza el cambio de mes y el de año sin desalinearse', () => {
    expect(inicioProximaSemana('2026-12-30')).toBe('2027-01-04') // miércoles
    expect(inicioProximaSemana('2026-08-30')).toBe('2026-08-31') // domingo
  })

  it('siempre avanza y siempre cae en lunes', () => {
    for (let dia = 1; dia <= 28; dia++) {
      const fecha = `2026-09-${String(dia).padStart(2, '0')}`
      const siguiente = inicioProximaSemana(fecha)
      expect(siguiente > fecha).toBe(true)
      expect(diaSemanaDe(siguiente)).toBe('LUNES')
    }
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
