import { describe, expect, it } from 'vitest'
import { sumarDias } from '../../domain/activacion'
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

  /**
   * ❌ EN ROJO A PROPÓSITO. `OpcionesOndulacion.cargaPrescritaKg` existe para
   * ondular sobre lo que ya está programado cuando todavía no hay nada
   * registrado, pero se le pasaba `ejercicio.series[0]?.cargaKg` — que es
   * `undefined` exactamente en ese caso. El ancla de reserva no podía entrar
   * nunca, y era código muerto desde que se escribió.
   *
   * Ahora que la carga es un campo, el ancla existe de verdad: un asesorado que
   * no registró la semana recibe propuesta sobre lo pautado en vez de un «sin
   * datos». Que no registrara se sigue avisando aparte, en `revisarActivacion`.
   */
  it('ondula sobre la carga pautada cuando no hay ninguna serie registrada', () => {
    const soloPautado = ejercicio({ series: [], cargaKg: 60, unidadCarga: 'kg' })
    const p = proponerMicrociclo(micro({ sesiones: [sesion({ ejercicios: [soloPautado] })] }))
    expect(p.sinDatos).toBe(0)
    expect(p.filas[0].direccion).not.toBe('sin-datos')
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

  /**
   * ✅ REGRESIÓN. El `...sesion` arrastraba `preparacion` y `bloquesCardio` con su
   * `hechoEn` puesto, así que el asesorado abría el microciclo nuevo con el
   * calentamiento y el cardio ya tachados. Peor en las metabólicas: `sesionCompleta`
   * las da por hechas solo con los bloques marcados, y una sesión que nadie hizo
   * contaba como registrada para el barrido y para el cumplimiento.
   */
  it('no arrastra la preparación ni el cardio ya marcados', () => {
    const conMarcas = micro({
      sesiones: [
        sesion({
          ejercicios: [registrado],
          preparacion: [
            {
              id: 'p1',
              tipo: 'movilidad',
              titulo: 'MOVILIDAD',
              indicaciones: '',
              hechoEn: '2026-07-25T10:00:00Z',
            },
          ],
          bloquesCardio: [
            { id: 'c1', titulo: 'CINTA 10 MIN', indicaciones: '', hechoEn: '2026-07-25T10:20:00Z' },
          ],
        }),
      ],
    })
    const p = microcicloPropuesto(conMarcas)
    expect(p.sesiones[0].preparacion?.every((x) => x.hechoEn === undefined)).toBe(true)
    expect(p.sesiones[0].bloquesCardio?.every((x) => x.hechoEn === undefined)).toBe(true)
    // Pero los conserva: son lo que hay que hacer, no lo que se hizo.
    expect(p.sesiones[0].preparacion).toHaveLength(1)
    expect(p.sesiones[0].bloquesCardio).toHaveLength(1)
  })

  /**
   * ✅ REGRESIÓN. La fecha salía siempre de encadenar con el anterior (o de hoy si
   * eso ya era pasado), así que no había forma de programarle a alguien la semana
   * que viene: la única opción era «a continuación de lo que está haciendo».
   */
  it('acepta la fecha de inicio que elija el coach', () => {
    const p = microcicloPropuesto(conRegistro, { fechaInicio: '2026-09-07' })
    expect(p.fechaInicio).toBe('2026-09-07')
  })

  /**
   * El otro lado del límite: quien no elige fecha tiene que seguir obteniendo
   * exactamente lo de antes. Encadenar con el microciclo en curso es lo normal y
   * es lo que hace el barrido automático.
   */
  it('sin fecha elegida sigue encadenando con el anterior', () => {
    const p = microcicloPropuesto(conRegistro)
    expect(p.fechaInicio).toBe(sumarDias(conRegistro.fechaInicio, conRegistro.cadenciaDias))
  })

  it('la fecha elegida manda sobre hoy, aunque hoy sea posterior', () => {
    const p = microcicloPropuesto(conRegistro, { fechaInicio: '2026-09-07', hoy: '2026-12-01' })
    expect(p.fechaInicio).toBe('2026-09-07')
  })

  /**
   * Un microciclo nació en martes con sus cuatro sesiones clavadas de LUNES a
   * JUEVES: la sesión del lunes caía el día anterior, ANTES de que el microciclo
   * empezara. `armarSemana` la ponía en su día exacto y ese día ya había pasado.
   *
   * Con cadencia 8 el arranque se corre un día de la semana por ciclo, así que
   * no era de un asesorado concreto: le pasa a cualquiera con los días fijados,
   * cada dos microciclos. La corrección ya se había hecho a mano una vez y esto
   * la automatiza.
   */
  it('corre el arranque calculado al dia de la primera sesion fijada', () => {
    const clavado = micro({
      fechaInicio: '2026-08-17',
      cadenciaDias: 8,
      sesiones: [
        sesion({ id: 's1', orden: 1, dia: 'LUNES', nombre: 'LEG A' }),
        sesion({ id: 's2', orden: 2, dia: 'MARTES', nombre: 'UPPER B' }),
        sesion({ id: 's3', orden: 3, dia: 'MIÉRCOLES', nombre: 'LEG B' }),
        sesion({ id: 's4', orden: 4, dia: 'JUEVES', nombre: 'CARDIO TABATA' }),
      ],
    })
    // Encadenar daría el martes 25; la sesión del LUNES caería el 24, en el pasado.
    expect(sumarDias(clavado.fechaInicio, clavado.cadenciaDias)).toBe('2026-08-25')
    expect(microcicloPropuesto(clavado).fechaInicio).toBe('2026-08-24')
  })

  it('no toca el arranque si la primera sesion fijada ya coincide', () => {
    // Domingo 16 + cadencia 8 cae en lunes 24, que es justo el dia fijado.
    const enPunto = micro({
      fechaInicio: '2026-08-16',
      cadenciaDias: 8,
      sesiones: [sesion({ dia: 'LUNES', nombre: 'LEG A' })],
    })
    expect(microcicloPropuesto(enPunto).fechaInicio).toBe('2026-08-24')
  })

  /**
   * La regla que ya existía no se toca: una fecha que eligió una persona no se
   * corrige nunca, aunque deje una sesión en el pasado. Corregirla sería
   * descartar en silencio lo que el coach decidió.
   */
  it('no corrige la fecha que eligio el coach, aunque los dias no cuadren', () => {
    const clavado = micro({
      fechaInicio: '2026-08-17',
      sesiones: [sesion({ dia: 'LUNES', nombre: 'LEG A' })],
    })
    expect(microcicloPropuesto(clavado, { fechaInicio: '2026-08-26' }).fechaInicio).toBe(
      '2026-08-26',
    )
  })

  it('sin dias fijados sigue encadenando tal cual', () => {
    const suelto = micro({
      fechaInicio: '2026-08-17',
      cadenciaDias: 8,
      sesiones: [sesion({ nombre: 'UPPER A' })],
    })
    expect(microcicloPropuesto(suelto).fechaInicio).toBe('2026-08-25')
  })

  /**
   * ❌ EN ROJO A PROPÓSITO. El microciclo propuesto se construía con `...e`, así
   * que `seriesPrescritas` traía las cargas nuevas y `prescripcion` seguía
   * siendo la frase de la semana anterior. El asesorado abría M23 leyendo los
   * kilos de M22 mientras el stepper le proponía otros, y el texto es lo único
   * que mira antes de cargar la barra.
   *
   * Ahora la frase se **compone** desde los campos, que es exactamente para lo
   * que está `componerPrescripcion`. Y su nota —prosa suya, con contexto real
   * dentro— viaja intacta al microciclo nuevo: no la reescribe nadie.
   */
  it('compone la prescripción con la ondulación nueva y conserva la nota del coach', () => {
    const NOTA = 'CONSOLIDA LOS 48 QUE MOVISTE LA SEMANA PASADA.'
    const conTextoViejo = ejercicio({
      prescripcion: `50KG A 10 REPS; 3 SERIES (RIR 2). ${NOTA}`,
      cargaKg: 50,
      unidadCarga: 'kg',
      notaCoach: NOTA,
      series: [
        { orden: 1, cargaKg: 50, reps: 10, rir: 2 },
        { orden: 2, cargaKg: 50, reps: 10, rir: 2 },
        { orden: 3, cargaKg: 50, reps: 10, rir: 2 },
      ],
    })
    const ej = microcicloPropuesto(
      micro({ numero: 22, sesiones: [sesion({ ejercicios: [conTextoViejo] })] }),
    ).sesiones[0].ejercicios[0]

    expect(ej.prescripcion).toMatch(/^ONDULACIÓN ASCENDENTE:/)
    expect(ej.prescripcion).not.toContain('50KG A 10 REPS')
    expect(ej.prescripcion).toContain(NOTA)
    // Y el campo numérico no se queda con la carga de la semana que se cierra.
    expect(ej.cargaKg).toBe(ej.seriesPrescritas![0].cargaKg)
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
