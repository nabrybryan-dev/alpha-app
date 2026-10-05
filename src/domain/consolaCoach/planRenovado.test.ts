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
