import { describe, expect, it } from 'vitest'
import {
  SERIES_DESCARGA,
  SUELO_MANTENIMIENTO,
  decidirVolumen,
  landmarkDe,
  volumenDelMicrociclo,
} from './volumenDelBloque'
import type { EjercicioPrescrito, Microciclo, Sesion } from './types'

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'DOMINANTE DE CADERA',
    nombre: 'Hip thrust con barra',
    cues: '',
    prescripcion: '',
    descansoMin: 3,
    sets: 3,
    rango: '(8-12)',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

function micro(ejercicios: EjercicioPrescrito[]): Microciclo {
  const sesion: Sesion = { id: 's1', nombre: 'LEG A', orden: 1, ejercicios }
  return {
    id: 'm22',
    usuarioId: 'u1',
    numero: 22,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio: '2026-08-11',
    sesiones: [sesion],
  }
}

describe('landmarkDe', () => {
  it('sitúa un número de series en su landmark', () => {
    expect(landmarkDe(5)).toBe('MV')
    expect(landmarkDe(10)).toBe('MEV')
    expect(landmarkDe(14)).toBe('MAV')
    expect(landmarkDe(20)).toBe('MRV')
    expect(landmarkDe(30)).toBe('sobre-MRV')
  })
})

describe('decidirVolumen', () => {
  it('un grupo prioritario lejos del techo sube de dos en dos', () => {
    const d = decidirVolumen({ seriesActuales: 10, prioridad: 'Muy Alto' })
    expect(d.delta).toBe(2)
    expect(d.seriesPropuestas).toBe(12)
    expect(d.landmarkActual).toBe('MEV')
    expect(d.landmarkPropuesto).toBe('MAV')
  })

  it('a un paso del techo sube de uno en uno y no lo pasa', () => {
    const d = decidirVolumen({ seriesActuales: 20, prioridad: 'Alto' })
    expect(d.seriesPropuestas).toBe(21)
    expect(decidirVolumen({ seriesActuales: 21, prioridad: 'Alto' }).delta).toBe(0)
  })

  /**
   * «Ese ranking fija dónde acumular y dónde solo mantener». Un grupo en Bajo no
   * acumula aunque haya sitio: el bloque decidió que ahí no se invierte.
   */
  it('un grupo en Bajo solo mantiene: no acumula aunque quepa', () => {
    const d = decidirVolumen({ seriesActuales: 8, prioridad: 'Bajo' })
    expect(d.delta).toBe(0)
    expect(d.motivo).toMatch(/techo/i)
  })

  it('un grupo Normal acumula hasta el tope de MAV, no hasta MRV', () => {
    const d = decidirVolumen({ seriesActuales: 16, prioridad: 'Normal' })
    expect(d.seriesPropuestas).toBe(17)
    expect(d.landmarkPropuesto).toBe('MAV')
  })

  /** En déficit el motor pide sesgar a MEV–MAV y no sostener MRV. */
  it('en déficit el techo baja a MAV aunque el grupo sea prioritario', () => {
    const normal = decidirVolumen({ seriesActuales: 17, prioridad: 'Muy Alto' })
    const enDeficit = decidirVolumen({ seriesActuales: 17, prioridad: 'Muy Alto', enDeficit: true })
    expect(normal.delta).toBeGreaterThan(0)
    expect(enDeficit.delta).toBe(0)
    expect(enDeficit.motivo).toMatch(/déficit/i)
  })

  it('con PRS en rojo sostiene el volumen en vez de acumular', () => {
    const d = decidirVolumen({ seriesActuales: 12, prioridad: 'Muy Alto', prs: 3 })
    expect(d.delta).toBe(0)
    expect(d.motivo).toMatch(/rojo/i)
  })

  it('con PRS crítico descarga a MV', () => {
    const d = decidirVolumen({ seriesActuales: 18, prioridad: 'Muy Alto', prs: 1 })
    expect(d.seriesPropuestas).toBe(SERIES_DESCARGA)
    expect(d.landmarkPropuesto).toBe('MV')
  })

  /**
   * La señal de techo no la puede deducir la app: rendimiento que cae sin causa
   * externa, RPE que sube sin progreso, molestias articulares. La marca el coach.
   */
  it('la señal de techo del coach descarga aunque el PRS venga verde', () => {
    const d = decidirVolumen({ seriesActuales: 22, prioridad: 'Muy Alto', prs: 9, señalDeTecho: true })
    expect(d.seriesPropuestas).toBe(SERIES_DESCARGA)
    expect(d.motivo).toMatch(/techo/i)
  })

  /**
   * La fuente es explícita y contraintuitiva: al recortar un grupo hay que mirar
   * el NÚMERO de series, no el porcentaje, porque «bajar de 4 a 2 no es como
   * bajar de 50 a 25». Por debajo de 3 se sale del mantenimiento fiable.
   */
  it('nunca deja un grupo por debajo del suelo de mantenimiento', () => {
    const d = decidirVolumen({ seriesActuales: 2, prioridad: 'Bajo', prs: 1 })
    expect(d.seriesPropuestas).toBeGreaterThanOrEqual(SUELO_MANTENIMIENTO)
  })

  it('sin prioridad conocida trata al grupo como Normal', () => {
    expect(decidirVolumen({ seriesActuales: 10 })).toEqual(
      decidirVolumen({ seriesActuales: 10, prioridad: 'Normal' }),
    )
  })

  it('sin PRS no modula: decide solo con landmark y prioridad', () => {
    const d = decidirVolumen({ seriesActuales: 10, prioridad: 'Alto' })
    expect(d.motivo).not.toMatch(/PRS/i)
  })
})

describe('volumenDelMicrociclo', () => {
  it('parte de las series PAUTADAS, no de las ejecutadas', () => {
    // Tres ejercicios de 4 sets del mismo grupo = 12 series pautadas, aunque
    // solo se haya registrado una.
    const e = (id: string) =>
      ejercicio({ id, sets: 4, series: id === 'a' ? [{ orden: 1, cargaKg: 80, reps: 10, rir: 2 }] : [] })
    const r = volumenDelMicrociclo(micro([e('a'), e('b'), e('c')]), {
      volumenSemanal: { Glúteos: 'Muy Alto' },
    })
    const gluteo = r.find((g) => g.grupo === 'Glúteos')
    expect(gluteo?.seriesActuales).toBe(12)
  })

  it('cruza cada grupo con su prioridad del PERFIL', () => {
    const r = volumenDelMicrociclo(micro([ejercicio({ sets: 10 })]), {
      volumenSemanal: { Glúteos: 'Bajo' },
    })
    expect(r[0].prioridad).toBe('Bajo')
    expect(r[0].delta).toBe(0)
  })

  /**
   * Los 18 perfiles reales escriben el mismo grupo de tres maneras: `Glúteo` en
   * 14, `Glúteos` en 3 y `Gluteo` en 1, mientras `cargaPorGrupo` produce siempre
   * `Glúteos`. Con búsqueda por clave exacta, 15 de 18 asesorados habrían visto
   * su glúteo tratado como Normal — el grupo que casi todas priorizan.
   */
  it.each(['Glúteo', 'Glúteos', 'Gluteo', 'GLUTEOS'])(
    'encuentra la prioridad aunque el PERFIL lo escriba «%s»',
    (comoLoEscriben) => {
      const r = volumenDelMicrociclo(micro([ejercicio({ sets: 10 })]), {
        volumenSemanal: { [comoLoEscriben]: 'Muy Alto' },
      })
      expect(r[0].prioridad).toBe('Muy Alto')
    },
  )

  it('trata «Core» y «Abdomen» como el mismo grupo, que es lo que son', () => {
    const abdominal = ejercicio({ id: 'ab', categoria: 'ABDOMEN', nombre: 'Plancha', sets: 9 })
    const r = volumenDelMicrociclo(micro([abdominal]), { volumenSemanal: { Core: 'Bajo' } })
    expect(r[0].grupo).toBe('Abdomen')
    expect(r[0].prioridad).toBe('Bajo')
  })

  it('la señal de techo se marca por grupo, no para todos', () => {
    const r = volumenDelMicrociclo(micro([ejercicio({ sets: 12 })]), {
      volumenSemanal: { Glúteos: 'Muy Alto' },
      gruposConSeñalDeTecho: ['Espalda'],
    })
    expect(r[0].delta).toBeGreaterThan(0)
  })

  it('un microciclo sin ejercicios reconocibles no inventa grupos', () => {
    expect(volumenDelMicrociclo(micro([]))).toEqual([])
  })
})
