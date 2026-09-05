import { describe, expect, it } from 'vitest'
import { corridaEnSombra, fechaDeLaSesion, sombraDeSesion } from './corridaEnSombra'
import type { CheckinDiario, EjercicioPrescrito, Microciclo, Sesion } from './types'

/**
 * La corrida en sombra reproduce el bucle sobre la historia. Lo que se defiende:
 *
 * 1. Que el día de la sesión se ate al check-in de ESE día, con el campo `fecha`
 *    o —para la historia, que no lo tiene— con la primera marca de preparación.
 * 2. Que **`sin_camino_escrito` se cuente aparte**. Hoy hay 0 de 3.106 ejercicios
 *    con escaleras escritas, así que TODO cruce que pida actuar cae ahí; si eso
 *    se escondiera dentro de «ninguno», un mecanismo bloqueado pasaría por un
 *    mecanismo que decide no actuar, y son cosas opuestas.
 * 3. Que la regla del martes solo mire hacia delante y solo propague la fatiga.
 */

const CHECKIN_BUENO: CheckinDiario = {
  id: 'c1', usuarioId: 'u', fecha: '2026-09-01',
  horasSueno: 8, calidadSueno: 'BUENA', estres: 'POCO', cansancio: 'POCO', motivacion: 'MUCHO',
}
const CHECKIN_MALO: CheckinDiario = {
  id: 'c2', usuarioId: 'u', fecha: '2026-09-01',
  horasSueno: 4, calidadSueno: 'MALA', estres: 'MUCHO', cansancio: 'MUCHO', motivacion: 'POCO',
}

function ej(over: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'ej-1', categoria: 'SENTADILLA', nombre: 'Sentadilla', cues: '', prescripcion: '',
    descansoMin: 2, sets: 3, rango: '8-10', repsDiana: 8, rirObjetivo: 2, cargaKg: 100,
    series: [], ...over,
  }
}

function ses(over: Partial<Sesion> = {}): Sesion {
  return { id: 's1', nombre: 'PIERNA A', orden: 1, ejercicios: [ej()], ...over }
}

const POR_ENCIMA = [{ orden: 1, cargaKg: 130, reps: 8, rir: 2 }]
const POR_DEBAJO = [{ orden: 1, cargaKg: 70, reps: 8, rir: 2 }]

describe('atar la sesión a su día', () => {
  it('usa el campo `fecha` cuando está', () => {
    expect(fechaDeLaSesion(ses({ fecha: '2026-09-01' }))).toEqual({
      fecha: '2026-09-01', origen: 'campo',
    })
  })

  it('cae a la PRIMERA marca de preparación para la historia, que no tiene campo', () => {
    // Las dos marcas caen en DIAS distintos a propósito: alguien calienta, se va
    // y vuelve al día siguiente. Con las dos el mismo día, quedarse con la última
    // daría el mismo resultado y el check no protegería nada — sobrevivió a esa
    // mutación hasta que este fixture cambió de día.
    const s = ses({
      preparacion: [
        { id: 'p2', titulo: 'b', indicaciones: '', tipo: 'movilidad', hechoEn: '2026-09-02T18:40:00Z' },
        { id: 'p1', titulo: 'a', indicaciones: '', tipo: 'movilidad', hechoEn: '2026-09-01T11:05:00Z' },
      ],
    })
    expect(fechaDeLaSesion(s)).toEqual({ fecha: '2026-09-01', origen: 'marca' })
  })

  it('sin fecha no invalida la sesión: el PRS del test no la necesita', () => {
    const s = ses({
      ejercicios: [ej({ series: POR_DEBAJO })],
      testPost: { duracionMin: 60, rpeSesion: 9, prsEntrada: 2 },
    })
    const sombra = sombraDeSesion(s, 1, [], [])
    expect(sombra.origenDeLaFecha).toBe('sin_fecha')
    expect(sombra.huboPrs).toBe(true)
    expect(sombra.ejercicios[0].decision.contexto).not.toBe('sin_datos')
  })
})

describe('el cruce sobre la historia', () => {
  it('día bueno y rendimiento por encima → verde', () => {
    const s = ses({ fecha: '2026-09-01', ejercicios: [ej({ series: POR_ENCIMA })] })
    const sombra = sombraDeSesion(s, 1, [CHECKIN_BUENO], [])
    expect(sombra.ejercicios[0].decision.escenario).toBe('verde')
    expect(sombra.huboCheckin).toBe(true)
  })

  it('día malo y rendimiento por debajo → rojo', () => {
    const s = ses({ fecha: '2026-09-01', ejercicios: [ej({ series: POR_DEBAJO })] })
    expect(sombraDeSesion(s, 1, [CHECKIN_MALO], []).ejercicios[0].decision.escenario).toBe('rojo')
  })

  it('el check-in de OTRO día no cuenta como contexto', () => {
    const s = ses({ fecha: '2026-09-03', ejercicios: [ej({ series: POR_ENCIMA })] })
    const sombra = sombraDeSesion(s, 1, [CHECKIN_BUENO], [])
    expect(sombra.huboCheckin).toBe(false)
    expect(sombra.ejercicios[0].decision.contexto).toBe('sin_datos')
    expect(sombra.ejercicios[0].decision.escenario).toBe('ninguno')
  })
})

describe('sin escaleras escritas no hay ajuste, y se cuenta aparte', () => {
  it('un verde sin `escenarios` queda marcado como sin camino escrito', () => {
    const s = ses({ fecha: '2026-09-01', ejercicios: [ej({ series: POR_ENCIMA })] })
    const x = sombraDeSesion(s, 1, [CHECKIN_BUENO], []).ejercicios[0]
    expect(x.decision.escenario).toBe('verde')
    expect(x.sinCaminoEscrito).toBe(true)
  })

  it('con escaleras escritas, el mismo verde SÍ propone y deja de estar bloqueado', () => {
    const s = ses({
      fecha: '2026-09-01',
      ejercicios: [
        ej({
          series: POR_ENCIMA,
          escenarios: {
            verde: { deltaCargaKg: 2.5, techoCargaKg: 120, serieExtra: false },
            rojo: { deltaRir: 1, sueloRir: 3, quitarUltimaSerie: false },
          },
        }),
      ],
    })
    const x = sombraDeSesion(s, 1, [CHECKIN_BUENO], []).ejercicios[0]
    expect(x.decision.escenario).toBe('verde')
    expect(x.sinCaminoEscrito).toBe(false)
  })

  it('el informe no esconde los bloqueados dentro de «ninguno»', () => {
    const m: Microciclo = {
      id: 'm', usuarioId: 'u', numero: 1, cadenciaDias: 8, estado: 'activo',
      fechaInicio: '2026-09-01',
      sesiones: [ses({ fecha: '2026-09-01', ejercicios: [ej({ series: POR_ENCIMA })] })],
    }
    const informe = corridaEnSombra([m], [CHECKIN_BUENO])
    expect(informe.porEscenario.verde).toBe(1)
    expect(informe.porEscenario.ninguno).toBe(0)
    expect(informe.sinCaminoEscrito).toBe(1)
  })
})

describe('la regla del martes, sobre la historia', () => {
  const rojo = ses({
    id: 's1', nombre: 'PIERNA A', orden: 1, fecha: '2026-09-01',
    ejercicios: [ej({ series: POR_DEBAJO })],
  })

  it('propaga a la sesión POSTERIOR que comparte grupo', () => {
    const despues = ses({ id: 's2', nombre: 'PIERNA B', orden: 2, ejercicios: [ej()] })
    expect(sombraDeSesion(rojo, 1, [CHECKIN_MALO], [despues]).propagaA).toEqual(['PIERNA B'])
  })

  it('no alcanza a una sesión de otro grupo', () => {
    const torso = ses({
      id: 's2', nombre: 'TORSO', orden: 2,
      ejercicios: [ej({ id: 'ej-2', categoria: 'EMPUJE HORIZONTAL' })],
    })
    expect(sombraDeSesion(rojo, 1, [CHECKIN_MALO], [torso]).propagaA).toEqual([])
  })

  it('el verde NUNCA se propaga: la frescura se comprueba cada día', () => {
    const verde = ses({ fecha: '2026-09-01', ejercicios: [ej({ series: POR_ENCIMA })] })
    const despues = ses({ id: 's2', nombre: 'PIERNA B', orden: 2, ejercicios: [ej()] })
    expect(sombraDeSesion(verde, 1, [CHECKIN_BUENO], [despues]).propagaA).toEqual([])
  })

  it('solo mira hacia delante: la corrida no pasa las sesiones ya hechas', () => {
    const m: Microciclo = {
      id: 'm', usuarioId: 'u', numero: 1, cadenciaDias: 8, estado: 'activo',
      fechaInicio: '2026-09-01',
      sesiones: [
        ses({ id: 's0', nombre: 'PIERNA CERO', orden: 1, ejercicios: [ej()] }),
        rojo,
      ],
    }
    // `rojo` es la SEGUNDA: no puede propagar a la que ya pasó. Y entra en el
    // array DESORDENADA, para que el check dependa de que la corrida ordene por
    // `orden` y no del orden en que vino la lista.
    const informe = corridaEnSombra([{ ...m, sesiones: [{ ...rojo, orden: 2 }, m.sesiones[0]] }], [
      CHECKIN_MALO,
    ])
    expect(informe.propagaciones).toBe(0)
  })
})

describe('el informe cuenta por qué NO se pudo cruzar', () => {
  it('separa «no anotó series» de «no hay contexto del día»', () => {
    const m: Microciclo = {
      id: 'm', usuarioId: 'u', numero: 1, cadenciaDias: 8, estado: 'activo',
      fechaInicio: '2026-09-01',
      sesiones: [
        ses({ id: 's1', nombre: 'A', orden: 1, fecha: '2026-09-01', ejercicios: [ej()] }),
        ses({ id: 's2', nombre: 'B', orden: 2, ejercicios: [ej({ series: POR_ENCIMA })] }),
      ],
    }
    const informe = corridaEnSombra([m], [CHECKIN_BUENO])
    expect(informe.noCruzables).toEqual({ sinSeries: 1, sinContexto: 1 })
    expect(informe.sesionesCruzables).toBe(0)
    expect(informe.ejerciciosMirados).toBe(2)
  })
})
