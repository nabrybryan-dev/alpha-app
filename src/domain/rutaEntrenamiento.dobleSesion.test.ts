import { describe, expect, it } from 'vitest'
import { armarSemana, resumenSemana, sesionDestacada, sesionesFueraDeLaSemana } from './rutaEntrenamiento'
import type { Microciclo, Sesion } from './types'

/**
 * Doble sesión el mismo día (mañana + repaso de noche). Asesorada ficticia: lunes, miércoles
 * y viernes con dos sesiones cada uno. 2026-07-20 es lunes.
 */
function sesion(id: string, nombre: string, orden: number, hechas = false): Sesion {
  return {
    id,
    nombre,
    orden,
    ejercicios: [
      {
        id: `e-${id}`,
        categoria: 'DOMINANTE DE RODILLA',
        nombre: 'Sentadilla',
        cues: '',
        prescripcion: '',
        descansoMin: 2,
        sets: 1,
        rango: '(8-12)',
        repsDiana: 10,
        rirObjetivo: 2,
        series: hechas ? [{ orden: 1, cargaKg: 40, reps: 10, rir: 2 }] : [],
      },
    ],
  }
}

function micro(sesiones: Sesion[]): Microciclo {
  return { id: 'm-x', usuarioId: 'u-ficticia', numero: 1, cadenciaDias: 7, estado: 'activo', fechaInicio: '2026-07-20', sesiones }
}

describe('armarSemana — dos sesiones el mismo día', () => {
  const dobles = () =>
    micro([
      sesion('a-lun', 'FUERZA AM (LUNES)', 1),
      sesion('b-lun', 'REPASO PM (LUNES)', 2),
      sesion('a-mie', 'EMPUJE AM (MIÉRCOLES)', 3),
      sesion('b-mie', 'REPASO PM (MIÉRCOLES)', 4),
    ])

  it('ambas salen el lunes, la de la mañana primero', () => {
    const lunes = armarSemana(dobles(), '2026-07-20')[0]
    expect(lunes.sesiones?.map((s) => s.sesionId)).toEqual(['a-lun', 'b-lun'])
    // La primera sigue en los campos de siempre.
    expect(lunes.sesionId).toBe('a-lun')
    expect(lunes.titulo).toBe('FUERZA AM (LUNES)')
  })

  it('el martes sigue siendo descanso: la segunda ya no se va al siguiente hueco', () => {
    const semana = armarSemana(dobles(), '2026-07-20')
    expect(semana[1].estado).toBe('descanso')
    expect(semana[2].sesiones?.map((s) => s.sesionId)).toEqual(['a-mie', 'b-mie'])
  })

  it('sesionesFueraDeLaSemana queda vacío', () => {
    const m = dobles()
    expect(sesionesFueraDeLaSemana(m, armarSemana(m, '2026-07-20'))).toEqual([])
  })

  it('el día solo está completado si lo están las dos; el botón grande propone la pendiente', () => {
    const m = micro([sesion('a-lun', 'AM (LUNES)', 1, true), sesion('b-lun', 'PM (LUNES)', 2)])
    const semana = armarSemana(m, '2026-07-20')
    expect(semana[0].estado).toBe('hoy')
    expect(sesionDestacada(semana)).toEqual({ sesionId: 'b-lun', titulo: 'PM (LUNES)', esDeHoy: true })
    expect(resumenSemana(semana)).toEqual({ completadas: 1, programadas: 2 })

    const hechas = micro([sesion('a-lun', 'AM (LUNES)', 1, true), sesion('b-lun', 'PM (LUNES)', 2, true)])
    expect(armarSemana(hechas, '2026-07-20')[0].estado).toBe('completada')
  })
})

describe('armarSemana — un día por sesión: la rejilla no cambia', () => {
  it('microciclo de 5 días + 1 sesión sin día da la misma rejilla que antes', () => {
    const m = micro([
      sesion('s1', 'A (LUNES)', 1),
      sesion('s2', 'B (MARTES)', 2),
      sesion('s3', 'C (MIÉRCOLES)', 3, true),
      sesion('s4', 'D (JUEVES)', 4),
      sesion('s5', 'E (VIERNES)', 5),
      sesion('s6', 'Extra sin día', 6),
    ])
    const semana = armarSemana(m, '2026-07-22')
    // Valor fijado contra el comportamiento previo al cambio (origin/main 5d9921e7).
    expect(semana.map((d) => [d.fechaIso, d.estado, d.sesionId ?? null, d.titulo])).toEqual([
      ['2026-07-20', 'programada', 's1', 'A (LUNES)'],
      ['2026-07-21', 'programada', 's2', 'B (MARTES)'],
      ['2026-07-22', 'completada', 's3', 'C (MIÉRCOLES)'],
      ['2026-07-23', 'programada', 's4', 'D (JUEVES)'],
      ['2026-07-24', 'programada', 's5', 'E (VIERNES)'],
      ['2026-07-25', 'programada', 's6', 'Extra sin día'],
      ['2026-07-26', 'descanso', null, 'Descanso'],
    ])
    expect(sesionesFueraDeLaSemana(m, armarSemana(m, '2026-07-22'))).toEqual([])
  })
})
