import { describe, expect, it } from 'vitest'
import { MAX_ABIERTAS, MAX_LARGO_PREGUNTA, PLAZO_HORAS, armarPreguntaEnEspera, destinatarioDe, ofertaDePregunta } from './enEspera'

/**
 * «Pregunta en espera» (decisión D6 de Bryan, 29-sep): cuando Praxis no sabe, ofrece
 * preguntarle al coach —o a la nutricionista si es de comida—, SIN nombres propios, y solo
 * la manda si la persona dice que sí.
 */
describe('ofertaDePregunta · la frase firmada, sin nombres', () => {
  it('por defecto pregunta por «tu coach»', () => {
    expect(ofertaDePregunta('coach', 'tu')).toBe('¿Se lo pregunto a tu coach? Te aviso cuando responda.')
  })
  it('lo de comida va a «tu nutricionista»', () => {
    expect(ofertaDePregunta('nutricionista', 'tu')).toBe('¿Se lo pregunto a tu nutricionista? Te aviso cuando responda.')
  })
  it('en usted', () => {
    expect(ofertaDePregunta('coach', 'usted')).toBe('¿Se lo pregunto a su coach? Le aviso cuando responda.')
  })
  it('nunca nombra a nadie', () => {
    for (const d of ['coach', 'nutricionista'] as const) for (const t of ['tu', 'usted'] as const) expect(ofertaDePregunta(d, t)).not.toMatch(/Bryan|Manuela/)
  })
})

describe('destinatarioDe', () => {
  it.each(['¿puedo cambiar el arroz por pasta?', '¿cuánta proteína me toca en el desayuno?', '¿la creatina engorda?'])('«%s» → nutricionista', (f) => {
    expect(destinatarioDe(f)).toBe('nutricionista')
  })
  it.each(['¿por qué me bajaron el press?', '¿puedo entrenar dos días seguidos?'])('«%s» → coach', (f) => {
    expect(destinatarioDe(f)).toBe('coach')
  })
})

describe('armarPreguntaEnEspera', () => {
  it('guarda la pregunta en palabras de la persona, a quién va y qué le faltó a Praxis', () => {
    const r = armarPreguntaEnEspera({ frase: '  ¿por qué me bajaron el press?  ', queFalto: 'porque_no_escrito', citas: ['M5→M6 · PRESS BANCA · cargaKg'], abiertas: 0 })
    expect(r).toEqual({ ok: true, pregunta: { pregunta: '¿por qué me bajaron el press?', destinatario: 'coach', que_falto: 'porque_no_escrito', citas: ['M5→M6 · PRESS BANCA · cargaKg'] } })
  })

  it('una frase con riesgo o de salud NO se guarda como pregunta: va por la capa de seguridad', () => {
    expect(armarPreguntaEnEspera({ frase: '¿es normal que me duela el pecho al entrenar?', queFalto: 'sin_dato', citas: [], abiertas: 0 })).toEqual({ ok: false, motivo: 'riesgo' })
    expect(armarPreguntaEnEspera({ frase: 'a veces no quiero vivir, ¿qué hago?', queFalto: 'sin_dato', citas: [], abiertas: 0 })).toEqual({ ok: false, motivo: 'riesgo' })
  })

  it(`no deja más de ${MAX_ABIERTAS} abiertas por persona`, () => {
    expect(armarPreguntaEnEspera({ frase: '¿qué me toca?', queFalto: 'sin_dato', citas: [], abiertas: MAX_ABIERTAS })).toEqual({ ok: false, motivo: 'tope' })
  })

  it('una pregunta vacía no se manda, y una larguísima se recorta', () => {
    expect(armarPreguntaEnEspera({ frase: '   ', queFalto: 'sin_dato', citas: [], abiertas: 0 })).toEqual({ ok: false, motivo: 'vacia' })
    const r = armarPreguntaEnEspera({ frase: '¿' + 'a'.repeat(2000) + '?', queFalto: 'sin_dato', citas: [], abiertas: 0 })
    expect(r.ok && r.pregunta.pregunta.length).toBe(MAX_LARGO_PREGUNTA)
  })

  it('las citas son solo referencias: como mucho ocho y cortas', () => {
    const r = armarPreguntaEnEspera({ frase: '¿qué me toca?', queFalto: 'sin_dato', citas: Array.from({ length: 20 }, (_, i) => `ref ${i} ` + 'x'.repeat(500)), abiertas: 0 })
    expect(r.ok && r.pregunta.citas.length).toBe(8)
    expect(r.ok && r.pregunta.citas.every((c) => c.length <= 160)).toBe(true)
  })

  it('el plazo firmado es de 24 horas', () => {
    expect(PLAZO_HORAS).toBe(24)
    expect(MAX_ABIERTAS).toBe(2)
  })
})
