import { describe, expect, it } from 'vitest'
import {
  diferenciaPlanes,
  leerJustificacion,
  leerPreguntasParaBryan,
  queOcurreAlVencerPlan,
  quienDecidePlan,
} from './planRenovado'

const manuela = { aprobarPlanEstrategico: true, autorizarExcepcion: false }
const bryan = { aprobarPlanEstrategico: true, autorizarExcepcion: true }

describe('quienDecidePlan', () => {
  it('Manuela aprueba un riesgo bajo no clínico', () => {
    expect(quienDecidePlan({ riesgo: 'bajo', estado: 'propuesto', clinico: false }, manuela).puedeAprobar).toBe(true)
  })

  it('lo clínico, aunque venga marcado bajo, solo lo aprueba Bryan; Manuela puede rechazarlo', () => {
    const d = quienDecidePlan({ riesgo: 'bajo', estado: 'propuesto', clinico: true }, manuela)
    expect(d).toMatchObject({ puedeAprobar: false, puedeRechazar: true })
    expect(d.motivoNoAprobar).toMatch(/Clínico/)
    expect(quienDecidePlan({ riesgo: 'bajo', estado: 'propuesto', clinico: true }, bryan).puedeAprobar).toBe(true)
  })

  it('riesgo alto y espera_bryan son de Bryan', () => {
    expect(quienDecidePlan({ riesgo: 'alto', estado: 'propuesto', clinico: false }, manuela).puedeAprobar).toBe(false)
    expect(quienDecidePlan({ riesgo: 'bajo', estado: 'espera_bryan', clinico: false }, manuela).puedeAprobar).toBe(false)
  })

  it('sin la capacidad, nada; lo decidido, nada', () => {
    const sin = { aprobarPlanEstrategico: false, autorizarExcepcion: true }
    expect(quienDecidePlan({ riesgo: 'bajo', estado: 'propuesto', clinico: false }, sin).puedeRechazar).toBe(false)
    expect(quienDecidePlan({ riesgo: 'bajo', estado: 'aprobado', clinico: false }, bryan).puedeAprobar).toBe(false)
  })
})

describe('queOcurreAlVencerPlan', () => {
  const base = { riesgo: 'bajo' as const, estado: 'propuesto' as const, clinico: false, dudasPendientes: [], preguntasParaBryan: [] }
  it('solo el bajo, no clínico, sin dudas ni preguntas pasa solo', () => {
    expect(queOcurreAlVencerPlan(base)).toMatch(/pasa solo/)
    expect(queOcurreAlVencerPlan({ ...base, clinico: true })).toMatch(/no pasa solo/)
    expect(queOcurreAlVencerPlan({ ...base, preguntasParaBryan: [{ pregunta: 'x' }] })).toMatch(/no pasa solo/)
    expect(queOcurreAlVencerPlan({ ...base, dudasPendientes: ['rodilla'] })).toMatch(/no pasa solo/)
    expect(queOcurreAlVencerPlan({ ...base, riesgo: 'medio' })).toMatch(/no pasa solo/)
  })
})

describe('lo que el agente escribe para quien aprueba', () => {
  it('lee justificación y preguntas, y descarta lo que no tiene forma', () => {
    expect(leerJustificacion([{ decision: 'Subir a 4 días', evidencia: 'adherencia 95 %' }, 3, { evidencia: 'sin decisión' }])).toEqual([
      { decision: 'Subir a 4 días', evidencia: 'adherencia 95 %' },
    ])
    expect(leerPreguntasParaBryan([{ pregunta: '¿Mantener 3 días?', opciones: ['Sí', 'No', 7] }, null])).toEqual([
      { pregunta: '¿Mantener 3 días?', opciones: ['Sí', 'No'] },
    ])
    expect(leerJustificacion('nada')).toEqual([])
  })
})

describe('diferenciaPlanes', () => {
  const vigente = {
    objetivo_largo_plazo: 'Perder 5 kg',
    metrica_principal: 'peso objetivo: 70 kg',
    horizonte: '2026-08-01 → 2026-09-26 (4 microciclos de 14 días)',
    cabecera: ['Microciclo', 'Foco'],
    filas: {
      '1': { columnas: { Microciclo: 'M1', Foco: 'Base' } },
      '2': { columnas: { Microciclo: 'M2', Foco: 'Volumen' } },
    },
    reglas: [{ texto: 'R vieja que sigue' }, { texto: 'R vieja que se deroga' }, { texto: 'R que se pierde' }],
    reglas_derogadas: [{ texto: 'Derogada de antes' }],
  }
  const borrador = {
    objetivo_largo_plazo: 'Perder 5 kg',
    metrica_principal: 'peso objetivo: 68 kg',
    horizonte: vigente.horizonte,
    cabecera: ['Microciclo', 'Foco'],
    filas: {
      '2': { columnas: { Microciclo: 'M2', Foco: 'Fuerza' } },
      '3': { columnas: { Microciclo: 'M3', Foco: 'Descarga' } },
    },
    reglas: [{ texto: 'R vieja que sigue' }, { texto: 'R nueva' }],
    reglas_derogadas: [
      { texto: 'Derogada de antes' },
      { texto: 'R vieja que se deroga', sustitucion: 'La sustituye R nueva' },
    ],
  }

  it('filas añadidas, cambiadas y quitadas', () => {
    const d = diferenciaPlanes(vigente, borrador)
    expect(d.filasAnadidas.map((f) => f.numero)).toEqual([3])
    expect(d.filasCambiadas.map((f) => [f.numero, f.antes[1], f.celdas[1]])).toEqual([[2, 'Volumen', 'Fuerza']])
    expect(d.filasQuitadas.map((f) => f.numero)).toEqual([1])
  })

  it('reglas añadidas, derogadas NUEVAS con su sustitución, y las que se pierden sin derogar', () => {
    const d = diferenciaPlanes(vigente, borrador)
    expect(d.reglasAnadidas).toEqual(['R nueva'])
    expect(d.reglasMantenidas).toBe(1)
    expect(d.reglasDerogadas).toEqual([{ texto: 'R vieja que se deroga', sustitucion: 'La sustituye R nueva' }])
    expect(d.reglasPerdidas).toEqual(['R que se pierde'])
  })

  it('cambios de cabecera', () => {
    expect(diferenciaPlanes(vigente, borrador).campos).toEqual([
      { campo: 'Métrica principal', antes: 'peso objetivo: 70 kg', despues: 'peso objetivo: 68 kg' },
    ])
  })

  it('sin vigente, todo el borrador es nuevo', () => {
    const d = diferenciaPlanes(null, borrador)
    expect(d.sinVigente).toBe(true)
    expect(d.filasAnadidas).toHaveLength(2)
    expect(d.reglasAnadidas).toEqual(['R vieja que sigue', 'R nueva'])
    expect(d.reglasPerdidas).toEqual([])
  })
})

describe('diferenciaPlanes: parámetros para decidir', () => {
  const base = { objetivo_largo_plazo: 'X', cabecera: ['Microciclo'], filas: {}, reglas: [] }
  const con = (p: unknown) => ({ ...base, parametros_para_decidir: p })
  const pend = { estado: 'pendiente' }

  it('un borrador que SOLO cambia parámetros no es «sin diferencias»', () => {
    const v = con({ aprobacion: pend, sesiones_minimas_del_microciclo: 3, orden_de_descarte: ['Bíceps', 'Glúteos'] })
    const b = con({ aprobacion: pend, sesiones_minimas_del_microciclo: 4, orden_de_descarte: ['Bíceps', 'Glúteos'] })
    const d = diferenciaPlanes(v, b)
    expect(d.filasAnadidas.length + d.filasCambiadas.length + d.filasQuitadas.length).toBe(0)
    expect(d.parametros.cambia).toBe(true)
    expect(d.parametros.campos.map((c) => [c.campo, c.estado, c.antes, c.valor])).toEqual([
      ['sesiones_minimas_del_microciclo', 'cambia', '3', '4'],
      ['orden_de_descarte', 'igual', 'Bíceps; Glúteos', 'Bíceps; Glúteos'],
    ])
  })

  it('campos nuevos y quitados, con mapas y listas en texto', () => {
    const v = con({ aprobacion: pend, axiales: ['Peso muerto'] })
    const b = con({ aprobacion: pend, prioridad_por_grupo: { Espalda: 'avanzar', Bíceps: 'minimo' } })
    const d = diferenciaPlanes(v, b).parametros
    expect(d.campos.find((c) => c.campo === 'prioridad_por_grupo')).toMatchObject({
      estado: 'nuevo',
      valor: 'Espalda = avanzar; Bíceps = minimo',
    })
    expect(d.campos.find((c) => c.campo === 'axiales')).toMatchObject({ estado: 'quitado', antes: 'Peso muerto' })
  })

  it('el cambio de aprobación cuenta como diferencia aunque los valores sean iguales', () => {
    const v = con({ aprobacion: pend, sesiones_ancla: ['A'] })
    const b = con({ aprobacion: { estado: 'aprobada', por: 'bryan', fecha: '2026-11-02' }, sesiones_ancla: ['A'] })
    const d = diferenciaPlanes(v, b).parametros
    expect(d.cambia).toBe(true)
    expect(d.aprobacion).toEqual({ estado: 'aprobada', por: 'bryan', fecha: '2026-11-02', estadoAntes: 'pendiente' })
  })

  it('sin vigente, todo el borrador es nuevo; sin sección en ninguno, no hay nada que pintar', () => {
    const b = con({ aprobacion: pend, sesiones_ancla: ['A'] })
    const d = diferenciaPlanes(null, b).parametros
    expect(d.campos.map((c) => c.estado)).toEqual(['nuevo'])
    expect(d.cambia).toBe(true)
    expect(diferenciaPlanes(base, base).parametros.hay).toBe(false)
  })

  it('el vigente traía la sección y el borrador la quita', () => {
    const d = diferenciaPlanes(con({ aprobacion: pend, sesiones_ancla: ['A'] }), base).parametros
    expect(d).toMatchObject({ hay: true, enBorrador: false, cambia: true })
    expect(d.campos[0].estado).toBe('quitado')
  })

  it('no se rompe con una sección mal formada', () => {
    expect(() => diferenciaPlanes(con('texto'), con([1, 2]))).not.toThrow()
    expect(diferenciaPlanes(base, con({ sesiones_ancla: ['A'] })).parametros.aprobacion?.estado).toBe('sin-dato')
  })
})
