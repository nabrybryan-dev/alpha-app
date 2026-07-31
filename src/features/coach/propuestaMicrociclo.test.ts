import { describe, expect, it } from 'vitest'
import { microcicloPropuesto, proponerMicrociclo } from './propuestaMicrociclo'
import type { EjercicioPrescrito, Microciclo, Sesion } from '../../domain/types'

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'BISAGRA DE CADERA',
    nombre: 'PESO MUERTO RUMANO',
    cues: '',
    prescripcion: '',
    descansoMin: 3,
    sets: 3,
    rango: '8-10',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

function sesion(parcial: Partial<Sesion> = {}): Sesion {
  return { id: 's1', nombre: 'UPPER A', orden: 1, ejercicios: [ejercicio()], ...parcial }
}

function micro(parcial: Partial<Microciclo> = {}): Microciclo {
  return {
    id: 'm22',
    usuarioId: 'u1',
    numero: 22,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio: '2026-07-20',
    sesiones: [sesion()],
    ...parcial,
  }
}

const registrado = ejercicio({
  series: [
    { orden: 1, cargaKg: 50, reps: 10, rir: 2 },
    { orden: 2, cargaKg: 50, reps: 10, rir: 2 },
    { orden: 3, cargaKg: 50, reps: 10, rir: 2 },
  ],
})

describe('proponerMicrociclo', () => {
  it('propone el microciclo siguiente al leído', () => {
    expect(proponerMicrociclo(micro({ numero: 22 })).numero).toBe(23)
  })

  it('devuelve una fila por ejercicio de fuerza, con su sesión', () => {
    const p = proponerMicrociclo(
      micro({
        sesiones: [
          sesion({ id: 's1', nombre: 'UPPER A', ejercicios: [registrado, registrado] }),
          sesion({ id: 's2', nombre: 'LEG B', ejercicios: [registrado] }),
        ],
      }),
    )
    expect(p.filas).toHaveLength(3)
    expect(p.filas.map((f) => f.sesionNombre)).toEqual(['UPPER A', 'UPPER A', 'LEG B'])
  })

  it('no ondula las sesiones metabólicas: ahí no hay carga que progresar', () => {
    const p = proponerMicrociclo(
      micro({
        sesiones: [
          sesion({ id: 's1', ejercicios: [registrado] }),
          sesion({ id: 's2', nombre: 'METABÓLICO', tipo: 'metabolica', ejercicios: [registrado] }),
        ],
      }),
    )
    expect(p.filas).toHaveLength(1)
  })

  it('escribe la prescripción en el formato del coach, con la progresión', () => {
    const p = proponerMicrociclo(micro({ numero: 22, sesiones: [sesion({ ejercicios: [registrado] })] }))
    const t = p.filas[0].prescripcion
    expect(t).toMatch(/RIR 2/)
    expect(t).toMatch(/VS M22/)
    // Con series desiguales se listan una a una; si no, va el formato compacto.
    expect(t).toMatch(/KG/)
  })

  it('toma el PRS de la última sesión con test post', () => {
    const p = proponerMicrociclo(
      micro({
        sesiones: [
          sesion({ id: 's1', testPost: { duracionMin: 60, rpeSesion: 8, prsEntrada: 9 } }),
          sesion({ id: 's2', testPost: { duracionMin: 60, rpeSesion: 8, prsEntrada: 3 } }),
        ],
      }),
    )
    expect(p.prs).toBe(3)
  })

  it('sin ningún test post, no inventa un PRS', () => {
    expect(proponerMicrociclo(micro()).prs).toBeUndefined()
  })

  /**
   * El motor recorta series en semana de descarga, pero su disparador (semana 4
   * de cada mesociclo) no coincide con lo que Bryan hace: medido sobre 291
   * transiciones de 21 plantillas, no hay señal en M4/M8/M12. Hasta que se decida
   * el disparador real, la propuesta NO descarga.
   */
  it('nunca aplica descarga automática, ni en un microciclo múltiplo de 4', () => {
    const enM24 = proponerMicrociclo(
      micro({ numero: 24, sesiones: [sesion({ ejercicios: [registrado] })] }),
    )
    const enM22 = proponerMicrociclo(
      micro({ numero: 22, sesiones: [sesion({ ejercicios: [registrado] })] }),
    )
    // Solo la parte de cargas y series: el sufijo lleva el número de microciclo,
    // que por construcción difiere entre los dos casos.
    const cargas = (t: string) => t.split('. ')[0]
    expect(cargas(enM24.filas[0].prescripcion)).toBe(cargas(enM22.filas[0].prescripcion))
    expect(enM24.filas.some((f) => /descarga/i.test(f.motivo))).toBe(false)
  })

  /**
   * Se vio en el navegador antes de que ningún test lo cazara: un ejercicio con
   * series ascendentes anunciaba «PROGRESA +10KG» mientras su propio motivo decía
   * que la carga iba por encima. La comparación era el último set propuesto contra
   * el PRIMERO registrado —el primer intento—, y el motor ondula en ascenso.
   */
  it('mide la progresión a IGUAL número de reps, no entre esquemas distintos', () => {
    // El caso real: 3×55 kg a 15 reps registrados. El motor ondula bajando reps,
    // así que su set más pesado va a 12 reps y pesa más — sin que eso sea progresar.
    const registradoA15 = ejercicio({
      sets: 3,
      rango: '12-15',
      repsDiana: 15,
      rirObjetivo: 1,
      series: [
        { orden: 1, cargaKg: 55, reps: 15, rir: 1 },
        { orden: 2, cargaKg: 55, reps: 15, rir: 1 },
        { orden: 3, cargaKg: 55, reps: 15, rir: 1 },
      ],
    })
    const t = proponerMicrociclo(micro({ sesiones: [sesion({ ejercicios: [registradoA15] })] }))
      .filas[0].prescripcion
    // Si anuncia algo, tiene que decir a cuántas reps compara.
    if (/PROGRESA|BAJA|SOSTIENE/.test(t)) expect(t).toMatch(/A 15 REPS VS M22/)
    // Y no puede inventarse una progresión de dos dígitos por cambiar el esquema.
    const m = t.match(/PROGRESA \+([\d.]+)KG/)
    if (m) expect(Number(m[1])).toBeLessThan(10)
  })

  it('calla la progresión si no hay ningún set comparable', () => {
    const soloA20 = ejercicio({
      sets: 2,
      rango: '8-10',
      repsDiana: 10,
      series: [{ orden: 1, cargaKg: 40, reps: 20, rir: 2 }],
    })
    const t = proponerMicrociclo(micro({ sesiones: [sesion({ ejercicios: [soloA20] })] }))
      .filas[0].prescripcion
    expect(t).not.toMatch(/PROGRESA|BAJA|SOSTIENE/)
  })

  it('cuenta los ejercicios que no pudo ondular por falta de ancla', () => {
    const sinNada = ejercicio({ series: [] })
    const p = proponerMicrociclo(micro({ sesiones: [sesion({ ejercicios: [sinNada] })] }))
    expect(p.sinDatos).toBe(1)
  })

  it('con PRS bajo sostiene la carga en vez de progresar', () => {

    const conPrsBajo = micro({
      sesiones: [
        sesion({
          ejercicios: [registrado],
          testPost: { duracionMin: 60, rpeSesion: 9, prsEntrada: 3 },
        }),
      ],
    })
    const normal = micro({
      sesiones: [
        sesion({
          ejercicios: [registrado],
          testPost: { duracionMin: 60, rpeSesion: 7, prsEntrada: 9 },
        }),
      ],
    })
    expect(proponerMicrociclo(conPrsBajo).filas[0].motivo).toMatch(/PRS/)
    expect(proponerMicrociclo(normal).filas[0].motivo).not.toMatch(/PRS en rojo/)
  })
})

describe('microcicloPropuesto', () => {
  const conRegistro = micro({
    numero: 22,
    sesiones: [
      sesion({
        ejercicios: [registrado],
        testPost: { duracionMin: 60, rpeSesion: 8, prsEntrada: 9 },
      }),
    ],
  })

  it('nace como propuesto, con el número siguiente y un id propio', () => {
    const p = microcicloPropuesto(conRegistro)
    expect(p.estado).toBe('propuesto')
    expect(p.numero).toBe(23)
    expect(p.id).not.toBe(conRegistro.id)
  })

  /**
   * Lo más importante de todo esto: un microciclo nuevo empieza limpio. Si
   * arrastrara lo hecho, el asesorado abriría M23 con las series de M22 ya
   * marcadas y el test post ya respondido.
   */
  it('no arrastra las series registradas ni los tests post del anterior', () => {
    const p = microcicloPropuesto(conRegistro)
    expect(p.sesiones[0].ejercicios.every((e) => e.series.length === 0)).toBe(true)
    expect(p.sesiones[0].testPost).toBeUndefined()
  })

  it('deja la ondulación dentro, que es lo que el asesorado ve serie a serie', () => {
    const p = microcicloPropuesto(conRegistro)
    const ej = p.sesiones[0].ejercicios[0]
    expect(ej.seriesPrescritas?.length).toBeGreaterThan(0)
  })

  it('no ondula las metabólicas, pero tampoco las pierde', () => {
    const conMeta = micro({
      sesiones: [sesion({ id: 's2', nombre: 'METABÓLICO', tipo: 'metabolica', ejercicios: [registrado] })],
    })
    const p = microcicloPropuesto(conMeta)
    expect(p.sesiones).toHaveLength(1)
    expect(p.sesiones[0].ejercicios[0].seriesPrescritas).toBeUndefined()
  })
})
