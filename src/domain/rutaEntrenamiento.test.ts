import { describe, expect, it } from 'vitest'
import {
  armarSemana,
  gradoDeCompetencia,
  inicioSemanaDe,
  resumenSemana,
  sesionDestacada,
} from './rutaEntrenamiento'
import type { EjercicioPrescrito, Microciclo, Sesion } from './types'

function ejercicio(sets: number, registradas: number): EjercicioPrescrito {
  return {
    id: `e-${sets}-${registradas}`,
    categoria: 'DOMINANTE DE RODILLA',
    nombre: 'Sentadilla',
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets,
    rango: '(8-12)',
    repsDiana: 10,
    rirObjetivo: 2,
    series: Array.from({ length: registradas }, (_, i) => ({
      orden: i + 1,
      cargaKg: 40,
      reps: 10,
      rir: 2,
    })),
  }
}

function sesion(id: string, nombre: string, extra?: Partial<Sesion>): Sesion {
  return { id, nombre, orden: 1, ejercicios: [ejercicio(3, 0)], ...extra }
}

function microciclo(sesiones: Sesion[], fechaInicio = '2026-07-20'): Microciclo {
  return {
    id: 'm-test',
    usuarioId: 'u1',
    numero: 8,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio,
    sesiones,
  }
}

describe('inicioSemanaDe', () => {
  it('arranca en domingo cuando el microciclo empieza en domingo', () => {
    // 2026-07-26 es domingo.
    expect(inicioSemanaDe(microciclo([], '2026-07-26'))).toBe('DOMINGO')
  })

  it('arranca en lunes cuando el microciclo empieza en lunes', () => {
    expect(inicioSemanaDe(microciclo([], '2026-07-20'))).toBe('LUNES')
  })

  it('si empieza otro día, manda que haya sesión programada en domingo', () => {
    const conDomingo = microciclo([sesion('s1', 'FULL BODY (DOMINGO)')], '2026-07-22')
    const sinDomingo = microciclo([sesion('s1', 'FULL BODY (MARTES)')], '2026-07-22')
    expect(inicioSemanaDe(conDomingo)).toBe('DOMINGO')
    expect(inicioSemanaDe(sinDomingo)).toBe('LUNES')
  })
})

describe('armarSemana', () => {
  it('devuelve 7 días y respeta el inicio de semana de la persona', () => {
    const empiezaLunes = armarSemana(microciclo([], '2026-07-20'), '2026-07-22')
    expect(empiezaLunes).toHaveLength(7)
    expect(empiezaLunes[0].dia).toBe('LUNES')
    expect(empiezaLunes[0].fechaIso).toBe('2026-07-20')
    expect(empiezaLunes[6].dia).toBe('DOMINGO')

    const empiezaDomingo = armarSemana(microciclo([], '2026-07-26'), '2026-07-29')
    expect(empiezaDomingo[0].dia).toBe('DOMINGO')
    expect(empiezaDomingo[0].fechaIso).toBe('2026-07-26')
    expect(empiezaDomingo[6].dia).toBe('SÁBADO')
  })

  it('coloca cada sesión en su día cuando lo trae', () => {
    const micro = microciclo([
      sesion('s-mie', 'LEG A (MIÉRCOLES)', { orden: 2 }),
      sesion('s-lun', 'PUSH A (LUNES)', { orden: 1 }),
    ])
    const semana = armarSemana(micro, '2026-07-22')
    expect(semana[0].sesionId).toBe('s-lun')
    expect(semana[2].sesionId).toBe('s-mie')
    expect(semana[1].estado).toBe('descanso')
  })

  it('reparte por orden las sesiones que no traen día', () => {
    const micro = microciclo([
      sesion('s-b', 'UPPER B', { orden: 2 }),
      sesion('s-a', 'LEG A', { orden: 1 }),
    ])
    const semana = armarSemana(micro, '2026-07-22')
    expect(semana[0].sesionId).toBe('s-a')
    expect(semana[1].sesionId).toBe('s-b')
  })

  it('no pisa un día ya ocupado al repartir las sueltas', () => {
    const micro = microciclo([
      sesion('s-lun', 'PUSH A (LUNES)', { orden: 1 }),
      sesion('s-suelta', 'UPPER B', { orden: 2 }),
    ])
    const semana = armarSemana(micro, '2026-07-22')
    expect(semana[0].sesionId).toBe('s-lun')
    expect(semana[1].sesionId).toBe('s-suelta')
  })

  it('marca completada, hoy, programada y descanso', () => {
    const hecha = sesion('s-lun', 'PUSH A (LUNES)', { ejercicios: [ejercicio(3, 3)] })
    const micro = microciclo([hecha, sesion('s-mie', 'LEG A (MIÉRCOLES)')])
    const semana = armarSemana(micro, '2026-07-22')
    expect(semana[0].estado).toBe('completada')
    expect(semana[2].estado).toBe('hoy')
    expect(semana[2].esHoy).toBe(true)
    expect(semana[4].estado).toBe('descanso')
  })

  it('una sesión de hoy ya registrada se muestra completada, no como pendiente', () => {
    const micro = microciclo([
      sesion('s-mie', 'LEG A (MIÉRCOLES)', { ejercicios: [ejercicio(3, 3)] }),
    ])
    expect(armarSemana(micro, '2026-07-22')[2].estado).toBe('completada')
  })

  it('describe la sesión con ejercicios, series y duración', () => {
    const semana = armarSemana(microciclo([sesion('s-lun', 'PUSH A (LUNES)')]), '2026-07-22')
    expect(semana[0].titulo).toBe('PUSH A (LUNES)')
    expect(semana[0].detalle).toMatch(/1 ejercicios · 3 series/)
  })

  it('numera los días con dos cifras', () => {
    const semana = armarSemana(microciclo([], '2026-07-06'), '2026-07-08')
    expect(semana[0].numero).toBe('06')
    expect(semana[0].abreviatura).toBe('Lun')
  })
})

describe('resumenSemana', () => {
  it('cuenta solo los días con sesión', () => {
    const micro = microciclo([
      sesion('s-lun', 'PUSH A (LUNES)', { ejercicios: [ejercicio(3, 3)] }),
      sesion('s-mar', 'PULL A (MARTES)'),
    ])
    expect(resumenSemana(armarSemana(micro, '2026-07-22'))).toEqual({
      completadas: 1,
      programadas: 2,
    })
  })
})

describe('sesionDestacada', () => {
  it('propone la sesión de hoy y la misma que pinta el calendario', () => {
    // El bug que documenta: el botón decía una sesión y la agenda ponía otra en
    // el día de hoy, porque cada uno la calculaba por su lado.
    const micro = microciclo([
      sesion('s-a', 'LEG A', { orden: 1 }),
      sesion('s-b', 'UPPER A', { orden: 2 }),
      sesion('s-c', 'LEG B', { orden: 3 }),
    ])
    const semana = armarSemana(micro, '2026-07-22')
    const destacada = sesionDestacada(semana)
    expect(destacada?.esDeHoy).toBe(true)
    expect(destacada?.sesionId).toBe(semana[2].sesionId)
    expect(destacada?.sesionId).toBe('s-c')
  })

  it('si hoy es descanso, propone la siguiente programada de la semana', () => {
    const micro = microciclo([sesion('s-vie', 'PUSH B (VIERNES)')])
    const destacada = sesionDestacada(armarSemana(micro, '2026-07-22'))
    expect(destacada?.sesionId).toBe('s-vie')
    expect(destacada?.esDeHoy).toBe(false)
  })

  it('si no queda nada por delante, rescata lo pendiente que quedó atrás', () => {
    const micro = microciclo([sesion('s-lun', 'PUSH A (LUNES)')])
    const destacada = sesionDestacada(armarSemana(micro, '2026-07-24'))
    expect(destacada?.sesionId).toBe('s-lun')
    expect(destacada?.esDeHoy).toBe(false)
  })

  it('no propone nada con la semana entera registrada', () => {
    const micro = microciclo([
      sesion('s-lun', 'PUSH A (LUNES)', { ejercicios: [ejercicio(3, 3)] }),
    ])
    expect(sesionDestacada(armarSemana(micro, '2026-07-22'))).toBeUndefined()
  })
})

describe('gradoDeCompetencia', () => {
  it('corta en 80 y en 65', () => {
    expect(gradoDeCompetencia(88)).toBe('alto')
    expect(gradoDeCompetencia(80)).toBe('alto')
    expect(gradoDeCompetencia(79)).toBe('medio')
    expect(gradoDeCompetencia(65)).toBe('medio')
    expect(gradoDeCompetencia(64)).toBe('bajo')
  })
})
