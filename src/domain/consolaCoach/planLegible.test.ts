import { describe, expect, it } from 'vitest'
import { leerPlanLegible } from './planLegible'

describe('leerPlanLegible: solo lo que el JSON de verdad trae, nada inventado', () => {
  it('lee objetivo, métrica, horizonte y reglas cuando existen (forma real de planes_estrategicos)', () => {
    const contenido = {
      slug: 'alguien',
      objetivo_largo_plazo: 'recomposición con cintura y glúteo como métrica',
      metrica_principal: 'perímetro de glúteo y cintura',
      horizonte: '2026-08-19 → 2026-10-13 (7 microciclos de 8 días)',
      reglas: [
        { numero: 2, nombre: 'Freno por readiness', texto: 'sueño <6 h → no sube volumen' },
        { numero: 3, nombre: 'Nada de déficit', texto: 'ningún microciclo baja de 1.900 kcal' },
      ],
      reglas_derogadas: [{ numero: 1, texto: 'Techo clínico (sustituida)' }],
      cabecera: ['Micro', 'Fechas'],
      filas: {},
    }
    const legible = leerPlanLegible(contenido)
    expect(legible).toEqual({
      objetivo: 'recomposición con cintura y glúteo como métrica',
      metricaPrincipal: 'perímetro de glúteo y cintura',
      horizonte: '2026-08-19 → 2026-10-13 (7 microciclos de 8 días)',
      reglas: ['sueño <6 h → no sube volumen', 'ningún microciclo baja de 1.900 kcal'],
      reglasDerogadas: ['Techo clínico (sustituida)'],
      reconocido: true,
    })
  })

  it('no inventa un campo "fase" que el JSON real no trae', () => {
    const legible = leerPlanLegible({ objetivo_largo_plazo: 'algo', reglas: [] })
    expect(legible).not.toHaveProperty('fase')
  })

  it('contenido null o no-objeto: nada reconocido, sin lanzar', () => {
    expect(leerPlanLegible(null).reconocido).toBe(false)
    expect(leerPlanLegible('texto suelto').reconocido).toBe(false)
    expect(leerPlanLegible(42).reconocido).toBe(false)
  })

  it('objeto sin ninguno de los campos esperados: reconocido=false, no revienta', () => {
    const legible = leerPlanLegible({ algo_distinto: 'valor' })
    expect(legible.reconocido).toBe(false)
    expect(legible.objetivo).toBeUndefined()
    expect(legible.reglas).toEqual([])
  })

  it('reglas con texto vacío o sin texto se descartan, no salen como cadena vacía', () => {
    const legible = leerPlanLegible({
      reglas: [{ texto: '' }, { texto: '   ' }, { sinTexto: true }, { texto: 'la única válida' }],
    })
    expect(legible.reglas).toEqual(['la única válida'])
    expect(legible.reconocido).toBe(true)
  })

  it('reglas que no es un arreglo: se ignora sin lanzar', () => {
    const legible = leerPlanLegible({ reglas: 'no es un arreglo' })
    expect(legible.reglas).toEqual([])
  })
})
