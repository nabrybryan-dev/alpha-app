import { describe, expect, it } from 'vitest'
import type { LoQuePraxisVe } from './listaBlanca'
import { SIN_DATO, esPregunta, responderDelPlan } from './responder'

/**
 * Lo que Praxis contesta del plan SIN modelo: cita lo que ya está escrito y, cuando no lo
 * tiene, lo dice. Nunca calcula una carga nueva ni afirma un porqué que nadie escribió.
 */
const ve: LoQuePraxisVe = {
  activo: {
    numero: 6, fechaInicio: '2026-09-28', cadenciaDias: 7,
    sesiones: [
      {
        id: 's1', nombre: 'PIERNA A', dia: 'jueves', fecha: '2026-10-01', preparacion: [], bloquesCardio: [],
        ejercicios: [
          { id: 'e1', nombre: 'SENTADILLA TRASERA', categoria: 'PIERNA', prescripcion: '40KG A 8 REPS; 3 SERIES', cargaKg: 40, sets: 3, rango: '8-10', repsDiana: 8, rirObjetivo: 2, descansoMin: 2, cues: '', notaCoach: 'Baja lento y sube fuerte', series: [] },
          { id: 'e2', nombre: 'PRESS BANCA', categoria: 'PECHO', prescripcion: '37,5KG A 10 REPS; 3 SERIES', cargaKg: 37.5, sets: 3, rango: '8-12', repsDiana: 10, rirObjetivo: 1, descansoMin: 2, cues: '', series: [] },
        ],
      },
      { id: 's2', nombre: 'TORSO A', dia: 'sabado', preparacion: [], bloquesCardio: [], ejercicios: [] },
    ],
  },
  cerrados: [{
    numero: 5, fechaInicio: '2026-09-21', cadenciaDias: 7,
    sesiones: [{ id: 's1', nombre: 'PIERNA A', preparacion: [], bloquesCardio: [], ejercicios: [
      { id: 'e2', nombre: 'PRESS BANCA', categoria: 'PECHO', prescripcion: '40KG A 10 REPS; 3 SERIES', cargaKg: 40, sets: 3, rango: '8-12', repsDiana: 10, rirObjetivo: 1, descansoMin: 2, cues: '', series: [] },
    ] }],
  }],
  perfil: { objetivos: 'Ganar fuerza en pierna', tiempoSesionMin: 60 },
  checkins: [], adherencias: [], hidratacionHoyMl: 0, comida: null, falta: ['checkins', 'plan_de_comida'],
}
const vacio: LoQuePraxisVe = { activo: null, cerrados: [], perfil: null, checkins: [], adherencias: [], hidratacionHoyMl: 0, comida: null, falta: ['plan_activo', 'perfil', 'checkins', 'plan_de_comida'] }
const HOY = '2026-10-01'

describe('esPregunta', () => {
  it.each(['¿Qué me toca hoy?', 'por qué me bajaron el peso', 'cuántas series de sentadilla', 'para qué es mi plan', 'explícame el RIR'])('«%s» es una pregunta', (f) => {
    expect(esPregunta(f)).toBe(true)
  })
  it.each(['le metí 40 kilos a la sentadilla', 'dormí 6 horas', 'hice pierna', 'que rico el desayuno, comí dos huevos'])('«%s» no lo es', (f) => {
    expect(esPregunta(f)).toBe(false)
  })
})

describe('responderDelPlan · cita lo que está escrito', () => {
  it('«¿qué me toca hoy?» dice la sesión de hoy y sus ejercicios', () => {
    const r = responderDelPlan('¿Qué me toca hoy?', ve, HOY)
    expect(r.tipo).toBe('respuesta')
    expect(r.texto).toContain('PIERNA A')
    expect(r.texto).toContain('SENTADILLA TRASERA')
    expect(r.citas).toContain('M6 · PIERNA A')
  })

  it('«¿qué tengo esta semana?» nombra las sesiones del microciclo', () => {
    const r = responderDelPlan('¿Qué tengo esta semana?', ve, HOY)
    expect(r.texto).toContain('PIERNA A')
    expect(r.texto).toContain('TORSO A')
  })

  it('una pregunta por un ejercicio lee su prescripción tal como está', () => {
    const r = responderDelPlan('¿cuántas series de sentadilla?', ve, HOY)
    expect(r.tipo).toBe('respuesta')
    expect(r.texto).toContain('40KG A 8 REPS; 3 SERIES')
    expect(r.texto).toContain('Baja lento y sube fuerte')
    expect(r.citas).toContain('M6 · PIERNA A · SENTADILLA TRASERA · prescripcion')
  })

  it('«¿para qué es mi plan?» cita el objetivo del perfil', () => {
    const r = responderDelPlan('¿para qué es mi plan?', ve, HOY)
    expect(r.tipo).toBe('respuesta')
    expect(r.texto).toContain('Ganar fuerza en pierna')
  })
})

describe('responderDelPlan · el porqué no se inventa', () => {
  it('«¿por qué me bajaron el press?» da el cambio calculado y dice que el porqué no está escrito', () => {
    const r = responderDelPlan('¿por qué me bajaron el peso del press banca?', ve, HOY)
    expect(r.tipo).toBe('parcial')
    expect(r.texto).toContain('40')
    expect(r.texto).toContain('37,5')
    expect(r.texto).toMatch(/porqu[eé]/i)
    expect(r.texto).not.toMatch(/porque (fallaste|te cost|estabas)/i)
    expect(r.ofrecePregunta).toBe(true)
  })

  it('un «por qué» sin ejercicio conocido no afirma nada y ofrece preguntar', () => {
    const r = responderDelPlan('¿por qué esta semana es tan dura?', ve, HOY)
    expect(r.tipo).toBe('no_se')
    expect(r.ofrecePregunta).toBe(true)
  })
})

describe('responderDelPlan · Praxis no cambia cargas ni el plan', () => {
  it.each(['¿me subes el peso de la sentadilla?', '¿puedes cambiarme el press por otro ejercicio?', '¿me quitas una serie?', '¿puedo subirle 5 kilos?'])('«%s» se le deja al coach', (f) => {
    const r = responderDelPlan(f, ve, HOY)
    expect(r.tipo).toBe('pide_cambio')
    expect(r.texto).toMatch(/tu coach/)
    expect(r.texto).not.toMatch(/\d+\s*kg/i)
    expect(r.ofrecePregunta).toBe(true)
  })
})

describe('responderDelPlan · cuando falta un dato, lo dice', () => {
  it('sin plan activo: «aún no tengo ese dato»', () => {
    const r = responderDelPlan('¿qué me toca hoy?', vacio, HOY)
    expect(r.tipo).toBe('no_se')
    expect(r.texto).toContain(SIN_DATO)
    expect(r.ofrecePregunta).toBe(true)
  })

  it('sin objetivo en el perfil: lo dice en vez de inventar uno', () => {
    const r = responderDelPlan('¿para qué es mi plan?', vacio, HOY)
    expect(r.tipo).toBe('no_se')
    expect(r.texto).toContain(SIN_DATO)
  })

  it('una pregunta que no es del plan no se contesta de memoria', () => {
    const r = responderDelPlan('¿la creatina engorda?', ve, HOY)
    expect(r.tipo).toBe('no_se')
    expect(r.ofrecePregunta).toBe(true)
  })

  it('en usted, habla de usted', () => {
    const r = responderDelPlan('¿qué me toca hoy?', vacio, HOY, 'usted')
    expect(r.texto).toContain(SIN_DATO)
    expect(r.texto).toMatch(/suyo/)
    expect(r.texto).not.toMatch(/tuyo/)
  })
})

describe('responderDelPlan · nunca nombra personas', () => {
  it('ninguna respuesta dice Bryan ni Manuela', () => {
    for (const f of ['¿qué me toca hoy?', '¿por qué me bajaron el press banca?', '¿me subes el peso?', '¿la creatina engorda?']) {
      expect(responderDelPlan(f, ve, HOY).texto).not.toMatch(/Bryan|Manuela/)
    }
  })
})
