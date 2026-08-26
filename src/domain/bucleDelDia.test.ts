import { describe, expect, it } from 'vitest'
import {
  contextoDelDia,
  escenarioDelDia,
  reglaDelMartes,
  rendimientoDelDia,
} from './bucleDelDia'
import { AL_FALLO } from './objetivoDeIntensidad'
import type { EjercicioPrescrito, SerieRegistrada } from './types'

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'SENTADILLA',
    nombre: 'PRENSA 45',
    cues: '',
    prescripcion: '',
    cargaKg: 100,
    descansoMin: 2,
    sets: 3,
    rango: '8-10',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

const series = (cargas: number[], rir?: number): SerieRegistrada[] =>
  cargas.map((cargaKg, i) => ({ orden: i + 1, cargaKg, reps: 10, rir }))

describe('rendimientoDelDia', () => {
  it('sin series registradas no hay rendimiento — esa rama es ondular a ciegas', () => {
    expect(rendimientoDelDia(ejercicio())).toBe('sin_registro')
  })

  /**
   * El umbral es el del coach, literal: «más de un veinte por ciento»
   * (2026-08-25). 125 sobre 100 es 25 % y dispara; 115 es 15 % y no.
   */
  it('la carga manda con el umbral del 20 %', () => {
    expect(rendimientoDelDia(ejercicio({ series: series([125, 125, 125], 2) }))).toBe('por_encima')
    expect(rendimientoDelDia(ejercicio({ series: series([115, 115, 115], 2) }))).toBe('en_linea')
    expect(rendimientoDelDia(ejercicio({ series: series([75, 75, 75], 2) }))).toBe('por_debajo')
  })

  it('el RIR informa cuando la carga va en linea: sobrar 2 es ir por encima', () => {
    expect(rendimientoDelDia(ejercicio({ series: series([100, 100, 100], 4) }))).toBe('por_encima')
    expect(rendimientoDelDia(ejercicio({ series: series([100, 100, 100], 0) }))).toBe('por_debajo')
  })

  it('señales contrarias no afirman nada', () => {
    // Más carga de la pautada pero mucho más cerca del fallo: no se sabe si
    // sobró o faltó — y afirmar cualquiera de las dos sería inventar.
    expect(rendimientoDelDia(ejercicio({ series: series([125, 125, 125], 0) }))).toBe('en_linea')
  })

  /**
   * Con el objetivo en FALLO el RIR no informa (la parcial no es una repetición
   * en reserva): decide solo la carga. Un RIR 0 registrado sobre FALLO no es
   * «ir por debajo».
   */
  it('al FALLO decide solo la carga', () => {
    expect(rendimientoDelDia(ejercicio({ rirObjetivo: AL_FALLO, series: series([100, 100], 0) }))).toBe('en_linea')
    expect(rendimientoDelDia(ejercicio({ rirObjetivo: AL_FALLO, series: series([130, 130], 0) }))).toBe('por_encima')
  })

  it('en un ondulado la pauta es la media de la escalera, no cargaKg', () => {
    const e = ejercicio({
      cargaKg: undefined,
      seriesPrescritas: [
        { orden: 1, cargaKg: 160, reps: 12, rir: 2 },
        { orden: 2, cargaKg: 200, reps: 12, rir: 2 },
        { orden: 3, cargaKg: 240, reps: 11, rir: 2 },
        { orden: 4, cargaKg: 240, reps: 10, rir: 1 },
      ],
      series: series([160, 200, 240, 240], 2),
    })
    expect(rendimientoDelDia(e)).toBe('en_linea')
  })
})

describe('contextoDelDia', () => {
  it('sin nada reportado es sin_datos, que NO es neutro', () => {
    expect(contextoDelDia({})).toBe('sin_datos')
  })

  it('una sola señal roja basta para malo: la fatiga no necesita unanimidad', () => {
    expect(contextoDelDia({ checkin: { horasSueno: 4, estres: 'POCO' } })).toBe('malo')
    expect(contextoDelDia({ checkin: { estres: 'MUCHO' } })).toBe('malo')
    expect(contextoDelDia({ prsEntrada: 3 })).toBe('malo')
  })

  it('bueno exige que lo reportado este bien', () => {
    expect(contextoDelDia({ checkin: { horasSueno: 8, calidadSueno: 'BUENA', estres: 'POCO' }, prsEntrada: 9 })).toBe('bueno')
    // Durmió 6: ni rojo ni limpio.
    expect(contextoDelDia({ checkin: { horasSueno: 6, estres: 'POCO' }, prsEntrada: 9 })).toBe('neutro')
  })
})

describe('escenarioDelDia — la señal es el cruce, nunca el número solo', () => {
  const buenDia = { checkin: { horasSueno: 8, calidadSueno: 'BUENA', estres: 'POCO' }, prsEntrada: 9 }
  const malDia = { checkin: { horasSueno: 4, estres: 'MUCHO' }, prsEntrada: 3 }

  it('por encima + contexto bueno = verde', () => {
    const r = escenarioDelDia(ejercicio({ series: series([130, 130, 130], 2) }), buenDia)
    expect(r.escenario).toBe('verde')
  })

  it('por debajo + contexto malo = rojo', () => {
    const r = escenarioDelDia(ejercicio({ series: series([70, 70, 70], 2) }), malDia)
    expect(r.escenario).toBe('rojo')
  })

  /**
   * El caso de la prensa del 25/08, exacto: 45 % por encima con PRS 9 y todo
   * limpio no es fatiga — es una frase fosilizada o autoprogresión, y eso lo
   * diagnostica el agente de discrepancia. El bucle del día con contexto bueno
   * y rendimiento por encima SÍ pisa verde... pero con contexto MALO y
   * rendimiento por encima, la contradicción se anota y no se toca nada.
   */
  it('las contradicciones no ajustan: se anotan', () => {
    const r = escenarioDelDia(ejercicio({ series: series([130, 130, 130], 2) }), malDia)
    expect(r.escenario).toBe('ninguno')
    expect(r.motivo).toContain('no concuerdan')
  })

  /**
   * Sin check-in del día no se pisa NINGÚN escenario, ni el verde con el mejor
   * rendimiento del mundo. Es la regla del agente de discrepancia hecha bucle:
   * sin la pata 2 no se inventa el porqué (I-14).
   */
  it('sin contexto no hay escenario, diga lo que diga el rendimiento', () => {
    const r = escenarioDelDia(ejercicio({ series: series([130, 130, 130], 2) }), {})
    expect(r.escenario).toBe('ninguno')
    expect(r.contexto).toBe('sin_datos')
  })

  it('sin registro tampoco: esa rama es ondular a ciegas', () => {
    const r = escenarioDelDia(ejercicio(), buenDia)
    expect(r.escenario).toBe('ninguno')
    expect(r.rendimiento).toBe('sin_registro')
  })
})

describe('reglaDelMartes — solo la fatiga viaja', () => {
  const rojo = { escenario: 'rojo', rendimiento: 'por_debajo', contexto: 'malo', motivo: 'x' } as const
  const verde = { escenario: 'verde', rendimiento: 'por_encima', contexto: 'bueno', motivo: 'x' } as const
  const restantes = [
    { nombre: 'MARTES · POSTERIOR', grupos: ['ISQUIOS', 'GLUTEO'] },
    { nombre: 'MIERCOLES · TORSO', grupos: ['PECHO', 'DORSAL'] },
  ]

  it('el rojo alcanza a las sesiones que comparten grupo, y solo a esas', () => {
    expect(reglaDelMartes(rojo, ['CUADRICEPS', 'GLUTEO'], restantes)).toEqual(['MARTES · POSTERIOR'])
  })

  /**
   * El verde NUNCA se propaga. Que hoy sobrara fuerza no promete nada de
   * mañana: la fatiga viaja, la frescura se comprueba cada día.
   */
  it('el verde nunca se propaga', () => {
    expect(reglaDelMartes(verde, ['CUADRICEPS', 'GLUTEO'], restantes)).toEqual([])
  })

  it('sin solapamiento no viaja nada', () => {
    expect(reglaDelMartes(rojo, ['GEMELO'], restantes)).toEqual([])
  })
})
