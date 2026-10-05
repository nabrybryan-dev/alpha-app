import { describe, expect, it } from 'vitest'
import { cuentaAtras, ordenarBandeja, queOcurreAlVencer, quienDecide, resumirPlanPropuesto } from './primerPlan'

const AHORA = Date.parse('2026-09-26T12:00:00Z')

describe('cuentaAtras', () => {
  it('días y horas cuando queda más de un día', () => {
    expect(cuentaAtras('2026-09-27T16:00:00Z', AHORA)).toEqual({ vencido: false, urgente: false, texto: 'quedan 1 d 4 h' })
  })

  it('urgente por debajo de 6 horas', () => {
    expect(cuentaAtras('2026-09-26T15:30:00Z', AHORA)).toEqual({ vencido: false, urgente: true, texto: 'quedan 3 h 30 min' })
  })

  it('minutos al final', () => {
    expect(cuentaAtras('2026-09-26T12:08:00Z', AHORA).texto).toBe('quedan 8 min')
  })

  it('vencido dice hace cuánto', () => {
    expect(cuentaAtras('2026-09-26T10:00:00Z', AHORA)).toEqual({ vencido: true, urgente: true, texto: 'venció hace 2 h' })
  })

  it('una fecha ilegible no se inventa', () => {
    expect(cuentaAtras('mañana', AHORA).texto).toBe('plazo sin fecha legible')
  })
})

describe('quienDecide', () => {
  const manuela = { aprobarPrimerPlan: true, autorizarExcepcion: false }
  const bryan = { aprobarPrimerPlan: true, autorizarExcepcion: true }

  it('Manuela aprueba y rechaza un riesgo bajo', () => {
    expect(quienDecide({ riesgo: 'bajo', estado: 'propuesto' }, manuela)).toEqual({
      puedeAprobar: true,
      puedeRechazar: true,
      motivoNoAprobar: undefined,
    })
  })

  it('Manuela no aprueba un riesgo alto, pero sí puede rechazarlo', () => {
    const r = quienDecide({ riesgo: 'alto', estado: 'propuesto' }, manuela)
    expect(r.puedeAprobar).toBe(false)
    expect(r.puedeRechazar).toBe(true)
    expect(r.motivoNoAprobar).toMatch(/Bryan/)
  })

  it('lo que espera a Bryan solo lo aprueba Bryan', () => {
    expect(quienDecide({ riesgo: 'medio', estado: 'espera_bryan' }, manuela).puedeAprobar).toBe(false)
    expect(quienDecide({ riesgo: 'alto', estado: 'espera_bryan' }, bryan).puedeAprobar).toBe(true)
  })

  it('sin la capacidad no se decide nada', () => {
    const r = quienDecide({ riesgo: 'bajo', estado: 'propuesto' }, { aprobarPrimerPlan: false, autorizarExcepcion: true })
    expect(r.puedeAprobar).toBe(false)
    expect(r.puedeRechazar).toBe(false)
  })

  it('lo ya decidido no se vuelve a decidir', () => {
    expect(quienDecide({ riesgo: 'bajo', estado: 'aprobado' }, bryan).puedeAprobar).toBe(false)
  })
})

describe('queOcurreAlVencer', () => {
  it('solo el bajo sin dudas pasa solo', () => {
    expect(queOcurreAlVencer({ riesgo: 'bajo', estado: 'propuesto', dudasPendientes: [] })).toMatch(/pasa solo/)
    expect(queOcurreAlVencer({ riesgo: 'bajo', estado: 'propuesto', dudasPendientes: ['rodilla'] })).toMatch(/no pasa solo/)
    expect(queOcurreAlVencer({ riesgo: 'medio', estado: 'propuesto', dudasPendientes: [] })).toMatch(/no pasa solo/)
  })
})

describe('ordenarBandeja', () => {
  it('primero lo que espera a Bryan, después el plazo más cercano, sin mutar la entrada', () => {
    const filas = [
      { id: 'a', estado: 'propuesto' as const, plazoHasta: '2026-09-28T00:00:00Z' },
      { id: 'b', estado: 'propuesto' as const, plazoHasta: '2026-09-27T00:00:00Z' },
      { id: 'c', estado: 'espera_bryan' as const, plazoHasta: '2026-09-29T00:00:00Z' },
    ]
    expect(ordenarBandeja(filas).map((f) => f.id)).toEqual(['c', 'b', 'a'])
    expect(filas.map((f) => f.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('resumirPlanPropuesto', () => {
  it('lee sesiones y ejercicios con nombre', () => {
    const datos = {
      sesiones: [
        { nombre: 'FULL BODY A', ejercicios: [{ nombre: 'Sentadilla', sets: 3, rango: '8-10' }, { sin: 'nombre' }] },
        { ejercicios: [{ nombre: 'Remo', prescripcion: '40KG A 10 REPS; 3 SERIES' }] },
      ],
    }
    expect(resumirPlanPropuesto(datos)).toEqual([
      { nombre: 'FULL BODY A', ejercicios: [{ nombre: 'Sentadilla', detalle: '3 × 8-10' }] },
      { nombre: 'Sesión 2', ejercicios: [{ nombre: 'Remo', detalle: '40KG A 10 REPS; 3 SERIES' }] },
    ])
  })

  it('una forma inesperada da una lista vacía, no una excepción', () => {
    expect(resumirPlanPropuesto(null)).toEqual([])
    expect(resumirPlanPropuesto({ sesiones: 'x' })).toEqual([])
  })
})
