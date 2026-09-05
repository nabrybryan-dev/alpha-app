import { describe, expect, it } from 'vitest'
import { balanceDeLaSombra } from './balanceDeLaSombra'
import type { CheckinDiario, EjercicioPrescrito, Microciclo, Sesion } from './types'

/**
 * El segundo hemisferio: ¿el ajuste acercaba el plan a lo que la persona hizo?
 *
 * Lo que más se defiende aquí no es la aritmética —es una resta— sino **qué se
 * descarta y por qué**, porque un balance que mete de matute los casos que no
 * puede medir da un número precioso y falso:
 *
 * 1. Sin siguiente aparición no hay con qué comparar.
 * 2. Sin escaleras escritas el bucle no propone nada.
 * 3. **Un rojo que solo suelta RIR no mueve la carga**, y contarlo como «error
 *    cero» diría que acertó cuando lo que pasa es que no opinó.
 * 4. Dos ejercicios con el mismo nombre en la misma semana no se emparejan a
 *    ciegas: es el límite conocido del clonador y aquí se descarta.
 */

const ESCALERAS = {
  verde: { deltaCargaKg: 5, techoCargaKg: 130 },
  rojo: { deltaRir: 1, sueloRir: 2, quitarUltimaSerie: true },
}

function ej(over: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e', categoria: 'SENTADILLA', nombre: 'Sentadilla', cues: '', prescripcion: '',
    descansoMin: 2, sets: 3, rango: '8-10', repsDiana: 10, rirObjetivo: 2, cargaKg: 100,
    series: [], escenarios: ESCALERAS, ...over,
  }
}

function micro(numero: number, ejercicios: EjercicioPrescrito[], fecha?: string): Microciclo {
  const sesion: Sesion = { id: `s${numero}`, nombre: 'A', orden: 1, fecha, ejercicios }
  return {
    id: `m${numero}`, usuarioId: 'u', numero, cadenciaDias: 8, estado: 'cerrado',
    fechaInicio: '2026-09-01', sesiones: [sesion],
  }
}

const DIA_BUENO: CheckinDiario = {
  id: 'c', usuarioId: 'u', fecha: '2026-09-01',
  horasSueno: 8, calidadSueno: 'BUENA', estres: 'POCO', cansancio: 'POCO',
}

describe('acercar o perseguir', () => {
  /**
   * Día bueno con rendimiento por encima → verde, propone 105. La semana
   * siguiente el plan seguía diciendo 100 y ella movió 108. El ajuste (105)
   * estaba MÁS CERCA de 108 que el original (100): acercaba.
   */
  it('cuenta como «acerca» cuando el ajuste queda más cerca de lo ejecutado', () => {
    const b = balanceDeLaSombra(
      [
        micro(1, [ej({ series: [{ orden: 1, cargaKg: 130, reps: 8, rir: 2 }] })], '2026-09-01'),
        micro(2, [ej({ series: [{ orden: 1, cargaKg: 108, reps: 9, rir: 2 }] })]),
      ],
      [DIA_BUENO],
      { conRecorteDeSerie: true },
    )
    expect(b.paresMedidos).toBe(1)
    expect(b.acercan).toBe(1)
    expect(b.pares[0]).toMatchObject({ cargaOriginal: 100, cargaAjustada: 105, errorOriginal: 8, errorAjustado: 3 })
  })

  it('y como «aleja» cuando el ajuste se separa', () => {
    const b = balanceDeLaSombra(
      [
        micro(1, [ej({ series: [{ orden: 1, cargaKg: 130, reps: 8, rir: 2 }] })], '2026-09-01'),
        // La semana siguiente movió MENOS de lo pautado: subir era ir al revés.
        micro(2, [ej({ series: [{ orden: 1, cargaKg: 95, reps: 9, rir: 2 }] })]),
      ],
      [DIA_BUENO],
      { conRecorteDeSerie: true },
    )
    expect(b.alejan).toBe(1)
    expect(b.acercan).toBe(0)
  })
})

describe('lo que NO se cuenta, que es lo que hace honesto el número', () => {
  it('sin siguiente aparición no hay par', () => {
    const b = balanceDeLaSombra(
      [micro(1, [ej({ series: [{ orden: 1, cargaKg: 130, reps: 8, rir: 2 }] })], '2026-09-01')],
      [DIA_BUENO],
    )
    expect(b.paresMedidos).toBe(0)
    expect(b.descartados.sinSiguiente).toBe(1)
  })

  it('sin escaleras escritas no hay ajuste que comparar', () => {
    const b = balanceDeLaSombra(
      [
        micro(1, [ej({ escenarios: undefined, series: [{ orden: 1, cargaKg: 130, reps: 8, rir: 2 }] })], '2026-09-01'),
        micro(2, [ej({ escenarios: undefined, series: [{ orden: 1, cargaKg: 108, reps: 9, rir: 2 }] })]),
      ],
      [DIA_BUENO],
    )
    expect(b.paresMedidos).toBe(0)
    expect(b.descartados.sinEscaleras).toBe(1)
  })

  it('un ROJO que solo suelta RIR no entra: no movió la carga, no opinó', () => {
    const malo: CheckinDiario = {
      id: 'c', usuarioId: 'u', fecha: '2026-09-01',
      horasSueno: 4, calidadSueno: 'MALA', estres: 'MUCHO', cansancio: 'MUCHO',
    }
    const b = balanceDeLaSombra(
      [
        micro(1, [ej({ series: [{ orden: 1, cargaKg: 70, reps: 8, rir: 2 }] })], '2026-09-01'),
        micro(2, [ej({ series: [{ orden: 1, cargaKg: 95, reps: 9, rir: 2 }] })]),
      ],
      [malo],
      { conRecorteDeSerie: true },
    )
    expect(b.paresMedidos).toBe(0)
    expect(b.descartados.sinAjusteDeCarga).toBe(1)
  })

  it('dos ejercicios con el mismo nombre la misma semana se descartan enteros', () => {
    const dos = [
      ej({ id: 'a', series: [{ orden: 1, cargaKg: 130, reps: 8, rir: 2 }] }),
      ej({ id: 'b', series: [{ orden: 1, cargaKg: 130, reps: 8, rir: 2 }] }),
    ]
    const b = balanceDeLaSombra(
      [micro(1, dos, '2026-09-01'), micro(2, dos)],
      [DIA_BUENO],
      { conRecorteDeSerie: true },
    )
    expect(b.paresMedidos).toBe(0)
    expect(b.descartados.sinSiguiente).toBe(0)
  })
})

describe('las dos variantes del día malo, que es la deuda de Bryan', () => {
  const malo: CheckinDiario = {
    id: 'c', usuarioId: 'u', fecha: '2026-09-01',
    horasSueno: 4, calidadSueno: 'MALA', estres: 'MUCHO', cansancio: 'MUCHO',
  }
  const semanas = [
    micro(1, [ej({ series: [{ orden: 1, cargaKg: 70, reps: 8, rir: 2 }] })], '2026-09-01'),
    micro(2, [ej({ series: [{ orden: 1, cargaKg: 95, reps: 9, rir: 2 }] })]),
  ]

  it('se puede medir con recorte de serie y sin él, y son corridas distintas', () => {
    const con = balanceDeLaSombra(semanas, [malo], { conRecorteDeSerie: true })
    const sin = balanceDeLaSombra(semanas, [malo], { conRecorteDeSerie: false })
    // Ninguna de las dos mueve carga en este caso (el rojo solo suelta RIR), y
    // eso es precisamente lo que hay que poder ver por separado.
    expect(con.descartados.sinAjusteDeCarga).toBe(1)
    expect(sin.descartados.sinAjusteDeCarga).toBe(1)
  })
})

/**
 * La vara del ROJO, y existe porque el mutador la pidió: quitarle al día malo la
 * palanca del recorte no cambiaba ni un número, o sea que el check no protegía
 * nada. El motivo era estructural — **el rojo nunca mueve kilos** —, así que
 * medirlo en kilos era medir un silencio.
 */
describe('el camino rojo se mide en series, que es lo único que toca', () => {
  const malo: CheckinDiario = {
    id: 'c', usuarioId: 'u', fecha: '2026-09-01',
    horasSueno: 4, calidadSueno: 'MALA', estres: 'MUCHO', cansancio: 'MUCHO',
  }
  // Día malo (rindió por debajo) y la semana siguiente hizo 2 series de las 3
  // pautadas. El rojo con recorte proponía 2: acertaba.
  const semanas = [
    micro(1, [ej({ series: [{ orden: 1, cargaKg: 70, reps: 8, rir: 2 }] })], '2026-09-01'),
    micro(2, [ej({ sets: 3, series: [
      { orden: 1, cargaKg: 95, reps: 9, rir: 2 },
      { orden: 2, cargaKg: 95, reps: 8, rir: 2 },
    ] })]),
  ]

  it('CON recorte, el ajuste de series acerca', () => {
    const b = balanceDeLaSombra(semanas, [malo], { conRecorteDeSerie: true })
    expect(b.series.paresMedidos).toBe(1)
    expect(b.series.pares[0]).toMatchObject({ seriesOriginales: 3, seriesAjustadas: 2, seriesHechasDespues: 2 })
    expect(b.series.acercan).toBe(1)
  })

  it('SIN recorte no hay nada que medir en series: la palanca no se toca', () => {
    const b = balanceDeLaSombra(semanas, [malo], { conRecorteDeSerie: false })
    expect(b.series.paresMedidos).toBe(0)
  })

  it('y en kilos el rojo sigue sin poder medirse, con recorte o sin él', () => {
    for (const conRecorteDeSerie of [true, false]) {
      expect(balanceDeLaSombra(semanas, [malo], { conRecorteDeSerie }).paresMedidos).toBe(0)
    }
  })
})

describe('«acerca» se define UNA vez', () => {
  it('el resumen cuenta leyendo el campo del par, no repitiendo la resta', () => {
    const b = balanceDeLaSombra(
      [
        micro(1, [ej({ series: [{ orden: 1, cargaKg: 130, reps: 8, rir: 2 }] })], '2026-09-01'),
        micro(2, [ej({ series: [{ orden: 1, cargaKg: 108, reps: 9, rir: 2 }] })]),
      ],
      [DIA_BUENO],
      { conRecorteDeSerie: true },
    )
    expect(b.pares[0].acerca).toBe(true)
    expect(b.acercan).toBe(b.pares.filter((p) => p.acerca).length)
  })
})
