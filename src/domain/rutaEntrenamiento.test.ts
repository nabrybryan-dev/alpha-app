import { describe, expect, it } from 'vitest'
import {
  armarSemana,
  competenciasCalculadas,
  estadisticasCalculadas,
  gradoDeCompetencia,
  inicioSemanaDe,
  progresoAlSiguiente,
  requisitosDeNivel,
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

  it('una sesion sin ejercicios se describe por sus bloques, no con «0 ejercicios»', () => {
    const zona2 = sesion('s-lun', 'ZONA 2 + MOVILIDAD (LUNES)', {
      ejercicios: [],
      bloquesCardio: [
        { id: 'b1', titulo: 'ZONA 2 · 40 MIN', indicaciones: '' },
        { id: 'b2', titulo: 'MOVILIDAD DE CADERA', indicaciones: '' },
      ],
    })
    const semana = armarSemana(microciclo([zona2]), '2026-07-22')
    expect(semana[0].detalle).toBe('2 bloques')
    expect(semana[0].detalle).not.toMatch(/0 ejercicios/)
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

describe('valoración con datos reales', () => {
  // Lo que se validó contra el Cerebro el 2026-08-01: el nivel no se mide por
  // años entrenados ni por un ratio de fuerza (no existe ninguno en la wiki), y
  // sostener 20-22 series un mesociclo entero es vivir en MRV, que es justo lo
  // que el motor manda descargar.
  const datos = {
    microcicloNumero: 22,
    sesionesRegistradas: 5,
    sesionesTotales: 6,
    desviacionRir: 1.2,
    seriesPorGrupo: [14, 18, 20, 12],
  }

  it('calcula las tres competencias que salen del registro, y ninguna más', () => {
    const r = competenciasCalculadas(datos)
    expect(r.map((c) => c.id)).toEqual(['consistencia', 'autorregulacion', 'volumen'])
  })

  it('la nota lleva el número real, no solo la barra', () => {
    const r = competenciasCalculadas(datos)
    expect(r[0].nota).toMatch(/5 de 6 sesiones/)
    expect(r[1].nota).toMatch(/1,2 puntos/)
    // Mediana de los 3 grupos con más volumen (20, 18, 14), no de los cuatro.
    expect(r[2].nota).toMatch(/18 series/)
  })

  it('el volumen se juzga donde el bloque acumula, no promediando todos los grupos', () => {
    // Los landmarks son "por grupo grande": meter pantorrillas y abdomen en la
    // media hunde el número y hace parecer que entrena por debajo de MEV.
    const conAccesorios = competenciasCalculadas({
      ...datos,
      seriesPorGrupo: [20, 18, 16, 4, 4, 3, 3],
    })
    expect(conAccesorios[2].nota).toMatch(/18 series/)
    expect(conAccesorios[2].pct).toBeGreaterThan(50)
  })

  it('distingue quedarse corto de pasarse de cerca del fallo', () => {
    const corto = competenciasCalculadas({ ...datos, desviacionRir: 1.2 })[1]
    const largo = competenciasCalculadas({ ...datos, desviacionRir: -1.2 })[1]
    expect(corto.nota).toMatch(/lejos del fallo/)
    expect(largo.nota).toMatch(/cerca del fallo/)
  })

  it('sin series registradas no inventa la autorregulación', () => {
    const r = competenciasCalculadas({ ...datos, desviacionRir: undefined })
    expect(r.map((c) => c.id)).toEqual(['consistencia', 'volumen'])
  })

  it('sin nada registrado no devuelve competencias', () => {
    expect(
      competenciasCalculadas({
        microcicloNumero: 1,
        sesionesRegistradas: 0,
        sesionesTotales: 0,
        seriesPorGrupo: [],
      }),
    ).toEqual([])
  })

  it('los requisitos miden a la persona y marcan como del coach lo que no se deduce', () => {
    const r = requisitosDeNivel(datos)
    expect(r.map((x) => x.id)).toEqual([
      'consistencia',
      'error-rir',
      'volumen',
      'tecnica',
      'fuerza',
    ])
    // 5/6 sesiones = 83%, por debajo del 90%
    expect(r[0].cumplido).toBe(false)
    expect(r[0].metrica).toBe('5 / 6 sesiones · 83%')
    // desviación 1,2 no baja de 0,5
    expect(r[1].cumplido).toBe(false)
    expect(r[1].metrica).toBe('1,2 de desviación media')
    // La técnica es la única irreducible: la app no ve ejecución.
    expect(r[3].metrica).toMatch(/coach/)
  })

  it('el requisito de volumen pide llegar a la parte alta de la onda, no vivir en MRV', () => {
    const enMav = requisitosDeNivel({ ...datos, seriesPorGrupo: [20, 20, 21, 20] })
    expect(enMav[2].cumplido).toBe(true)
    expect(enMav[2].texto).toMatch(/dentro de la onda/)
    expect(enMav[2].texto).not.toMatch(/mesociclo completo/)
  })

  it('la fuerza y la nutrición entran cuando hay con qué medirlas', () => {
    const r = competenciasCalculadas({
      ...datos,
      progresoFuerza: { mejoraron: 5, comparados: 7, microcicloPrevio: 21 },
      adherenciaPct: 83,
    })
    expect(r.map((c) => c.id)).toEqual([
      'consistencia',
      'autorregulacion',
      'volumen',
      'fuerza',
      'nutricion',
    ])
    expect(r[3].nota).toMatch(/5 de 7 ejercicios.*M21/)
    expect(r[3].pct).toBe(71)
    expect(r[4].nota).toMatch(/83% de adherencia/)
  })

  it('el requisito de fuerza se cumple progresando contra sí mismo, no contra un ratio', () => {
    const mitad = requisitosDeNivel({
      ...datos,
      progresoFuerza: { mejoraron: 4, comparados: 7, microcicloPrevio: 21 },
    })
    expect(mitad[4].cumplido).toBe(true)
    expect(mitad[4].metrica).toBe('4 / 7 ejercicios al alza vs M21')
    expect(mitad[4].texto).not.toMatch(/peso corporal|1,60/)

    const pocos = requisitosDeNivel({
      ...datos,
      progresoFuerza: { mejoraron: 2, comparados: 7, microcicloPrevio: 21 },
    })
    expect(pocos[4].cumplido).toBe(false)
  })

  it('sin microciclo previo comparable, la fuerza lo dice en vez de suponer', () => {
    const r = requisitosDeNivel(datos)
    expect(r[4].cumplido).toBe(false)
    expect(r[4].metrica).toMatch(/sin dos microciclos/i)
    expect(competenciasCalculadas(datos).map((c) => c.id)).not.toContain('fuerza')
  })

  it('el progreso al siguiente nivel es la proporción de requisitos cumplidos', () => {
    expect(progresoAlSiguiente(requisitosDeNivel(datos))).toBe(0)
    expect(
      progresoAlSiguiente([
        { id: 'a', cumplido: true, texto: '', metrica: '' },
        { id: 'b', cumplido: false, texto: '', metrica: '' },
      ]),
    ).toBe(50)
    expect(progresoAlSiguiente([])).toBe(0)
  })

  it('las mini-cifras salen del microciclo, sin meses entrenando ni ratios de fuerza', () => {
    const e = estadisticasCalculadas(datos)
    expect(e.map((x) => x.etiqueta)).toEqual([
      'Series / grupo',
      'Desviación RIR',
      'Sesiones M22',
    ])
    expect(e[1].valor).toBe('+1,2')
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

/**
 * A mitad de microciclo, un "Progreso de fuerza 0%" es correcto -nadie ha subido
 * todavia- pero se lee como un juicio. La diferencia entre "vas mal" y "aun no
 * hay con que" tiene que estar escrita: la barra sola no la dice.
 */
describe('progreso de fuerza al principio del microciclo', () => {
  const base = {
    microcicloNumero: 22,
    seriesPorGrupo: [16, 15, 14],
    progresoFuerza: { mejoraron: 0, comparados: 3, microcicloPrevio: 21 },
  }

  const notaDeFuerza = (datos: Parameters<typeof competenciasCalculadas>[0]) =>
    competenciasCalculadas(datos).find((c) => c.id === 'fuerza')?.nota ?? ''

  it('avisa de que faltan sesiones cuando apenas ha empezado', () => {
    const nota = notaDeFuerza({ ...base, sesionesRegistradas: 1, sesionesTotales: 6 })
    expect(nota).toMatch(/1 de 6 sesiones/)
    expect(nota).toMatch(/todavía no dice mucho/i)
  })

  it('no avisa cuando el microciclo ya va avanzado', () => {
    const nota = notaDeFuerza({ ...base, sesionesRegistradas: 5, sesionesTotales: 6 })
    expect(nota).not.toMatch(/todavía no dice mucho/i)
  })

  it('el porcentaje no cambia: lo que cambia es lo que se explica', () => {
    const temprano = competenciasCalculadas({ ...base, sesionesRegistradas: 1, sesionesTotales: 6 })
    const tarde = competenciasCalculadas({ ...base, sesionesRegistradas: 5, sesionesTotales: 6 })
    expect(temprano.find((c) => c.id === 'fuerza')?.pct).toBe(
      tarde.find((c) => c.id === 'fuerza')?.pct,
    )
  })
})

/**
 * Los casos que cubría `sesionSugerida` antes de borrarse (2026-08-24). Hoy y
 * Entrenar comparten ya esta única función, así que sus casos viven aquí.
 */
describe('sesionDestacada — lo que heredó de la Hoy vieja', () => {
  it('salta la de hoy cuando ya está registrada', () => {
    const micro = microciclo([
      sesion('s-mie', 'LEG A (MIÉRCOLES)', { orden: 1, ejercicios: [ejercicio(3, 3)] }),
      sesion('s-vie', 'UPPER A (VIERNES)', { orden: 2, ejercicios: [ejercicio(3, 0)] }),
    ])
    // 2026-07-22 es miércoles: la suya está completa, así que propone la del viernes.
    const destacada = sesionDestacada(armarSemana(micro, '2026-07-22'))
    expect(destacada?.sesionId).toBe('s-vie')
    expect(destacada?.esDeHoy).toBe(false)
  })
})
