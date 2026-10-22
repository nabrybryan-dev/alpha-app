import { describe, expect, it } from 'vitest'
import { continuarAclaracionSalud, leerOrientacionSalud, ORIENTACIONES_SALUD, preguntaDeSalud, preguntaLocalPorSensacion, textoOrientacionSalud } from './orientacionSalud'
import { decidirTurno, pasoTrasProponer, type RespuestaDelRegistrador } from './conversacion'
import { derivarPorRiesgo } from './riesgo'
import { gravedad, leerMarcaDelServidor, masGrave } from './masGrave'
import { marcaDesdeModelo } from './riesgoModelo'
import type { LoQuePraxisVe } from './plan/listaBlanca'

const ve: LoQuePraxisVe = { activo: null, cerrados: [], perfil: null, checkins: [], adherencias: [], hidratacionHoyMl: 0, comida: null, falta: ['plan_activo'] }
const zona = { frase: 'En la prensa sentí presión.', pregunta: 'preguntar_zona' as const }
const funcion = { frase: 'Sentí presión en el muslo.', pregunta: 'preguntar_funcion' as const }

describe('preguntas cerradas, sin decidir un diagnóstico', () => {
  it.each(['No sentí presión en la prensa.', 'Sentí presión de grupo en la prensa.', 'Siento presión para ir a la prensa.', 'Tengo presión arterial alta.', 'Siento presión laboral.', 'En la prensa hice doce.'])('no convierte logística, negación o presión social en una sensación: %s', (f) => expect(preguntaLocalPorSensacion(f)).toBeNull())
  it.each(['Sentí presión.', 'En la prensa sentí presión, no dolor.', 'Sentí PRESIÓN en la prensa'])('sin zona: %s', (f) => expect(preguntaDeSalud(f)).toBe('preguntar_zona'))
  it.each(['Sentí presión en el muslo.', 'Presión en la pantorrilla.', 'Siento presión en la rodilla.'])('con zona de pierna: %s', (f) => expect(preguntaDeSalud(f)).toBe('preguntar_funcion'))
  it.each(['Tengo presión arterial alta.', 'Tengo presión baja.', 'Sentí presión en el muslo y no puedo apoyar.', 'Sentí presión en el muslo, puedo caminar.', 'No me lesioné.', 'No puedo levantar más peso.', 'No puedo apoyar porque la máquina está ocupada.'])('no inventa una pregunta de presión: %s', (f) => expect(preguntaDeSalud(f)).toBeNull())
  it('la pregunta general solo se solicita después de PREGUNTAR_ANTES_DE_ENTRENAR', () => {
    expect(preguntaDeSalud('Me preocupa algo reciente.', true)).toBe('preguntar_general')
    expect(marcaDesdeModelo('NINGUNO', 'Me preocupa algo reciente.')).toBeNull()
    expect(marcaDesdeModelo('PREGUNTAR_ANTES_DE_ENTRENAR', 'Me preocupa algo reciente.')).toMatchObject({ orientacion: 'preguntar_general' })
  })
  it.each(ORIENTACIONES_SALUD)('código reconocido y textos sin tratamiento: %s', (o) => {
    expect(leerOrientacionSalud(o)).toBe(o)
    for (const trato of ['tu', 'usted'] as const) expect(textoOrientacionSalud(o, trato)).not.toMatch(/toma |hielo|eleva|infarto|desgarro|50\s*%|puedes entrenar/i)
  })
  it.each(['llama_911', '<script>', 'NO_EJECUTAR', 1, {}, null])('rechaza código ajeno: %s', (o) => expect(leerOrientacionSalud(o)).toBeNull())
})

describe('una aclaración conserva hechos sin inventar datos', () => {
  it.each(['En el pecho.', 'En el muslo.', 'En la pierna izquierda.', 'No sé.'])('conserva respuesta literal: %s', (f) => {
    const t = continuarAclaracionSalud(zona, f)!
    expect(t).toContain(zona.frase)
    expect(t).toContain(`Aclaración de la persona: ${f}`)
    expect(decidirTurno(t, ve, '2026-10-05', 'tu', true).vaAlModelo).toBe(false)
  })
  it.each(['No puedo apoyar.', 'Sí.', 'No.', 'Normal.', 'Sin problema.', 'Me duele y se hinchó.'])('mantiene respuesta de función: %s', (f) => expect(continuarAclaracionSalud(funcion, f)).not.toBeNull())
  it.each(['Anota dos vasos de agua.', 'Hice tres series de diez.', 'Otra cosa: ¿qué me toca hoy?', '¿Qué me toca de pecho?', '¿Cuántos kilos uso en pecho?', 'Dormi seis horas.', 'Hola', '', 'x'.repeat(241)])('no arrastra salud a otro tema: %s', (f) => expect(continuarAclaracionSalud(zona, f)).toBeNull())
  it('sin pregunta pendiente no construye contexto', () => expect(continuarAclaracionSalud(null, 'en el pecho')).toBeNull())
  it('presión aclarada en el pecho detiene localmente, incluso si no responde el modelo', () => {
    const t = continuarAclaracionSalud(zona, 'En el pecho.')!
    expect(decidirTurno(t, ve, '2026-10-05', 'tu', true)).toEqual({ paso: 'quieta', linea: 'vida', vaAlModelo: false })
  })
  it.each(['No es en el pecho, es en el muslo.', 'No sé si es en el pecho.'])('no inventa una ubicación afirmativa: %s', (respuesta) => {
    expect(continuarAclaracionSalud(zona, respuesta)).not.toContain('Dato aclarado: presión en el pecho.')
  })
  it('un sí/no solo no inventa zona', () => expect(continuarAclaracionSalud(zona, 'sí')).toBeNull())
  it.each(['Sí.', 'No.', 'Normal.', 'Sin problema.'])('un %s se interpreta con la pregunta de función y no se repite', (respuesta) => {
    const t = continuarAclaracionSalud(funcion, respuesta)!
    expect(t).toContain('Pregunta de Praxis: ¿Le impide apoyar')
    expect(preguntaDeSalud(t, true)).toBeNull()
  })
  it('no libera un registro al aclarar un síntoma aunque el filtro local no encuentre palabras', () => {
    expect(decidirTurno('En la prensa sentí presión.\nAclaración de la persona: muslo', ve, '2026-10-05', 'tu', true).paso).toBe('salud')
  })
})

describe('atención hoy: contrato de presentación, sin rebajar emergencias', () => {
  it('recorre parser → propuesta → pantalla sin convertirla en una pregunta', () => {
    const m = leerMarcaDelServidor({ marca: { tipo: 'salud', orientacion: 'atencion_hoy' } })!
    const propuesta = derivarPorRiesgo(m)
    const r = { ok: true, propuesta, mensajeId: 'p', tarjeta: { tipo: 'derivacion' } } as unknown as RespuestaDelRegistrador
    const p = pasoTrasProponer(r, 'tu')
    expect(p.paso).toBe('salud')
    expect(p.paso === 'salud' && p.texto).toContain('urgente hoy')
    expect(p.paso === 'salud' && p.texto).toContain('123 ahora')
    expect(propuesta.registros).toEqual([])
  })
  it.each(ORIENTACIONES_SALUD)('nunca baja una emergencia ni cuidado: %s', (orientacion) => {
    for (const filtro of [{ tipo: 'quieta' as const, linea: 'vida' as const }, { tipo: 'cuidado' as const }]) {
      const final = masGrave(filtro, { tipo: 'salud', filtro: 'sintoma', orientacion })
      expect(final).toEqual(filtro)
      expect(gravedad(final)).toBeGreaterThanOrEqual(gravedad(filtro))
    }
  })
  it('el modelo actual no convierte por sí solo lesión o pérdida de apoyo en atención hoy', () => {
    expect(marcaDesdeModelo('URGENTE_FISICO', 'No puedo apoyar después de caerme.')).toEqual({ tipo: 'quieta', linea: 'vida' })
    expect(marcaDesdeModelo('DERIVAR', 'Me lesioné.')).not.toHaveProperty('orientacion', 'atencion_hoy')
  })
  it('códigos desconocidos no se pintan como instrucciones recibidas', () => {
    expect(leerMarcaDelServidor({ marca: { tipo: 'salud', orientacion: 'toma medicamentos', texto: 'toma esto' } })).toEqual({ tipo: 'salud', filtro: 'sintoma' })
  })
  it('una orientación de pregunta no reemplaza una marca específica de medicamento', () => {
    const f = { tipo: 'salud' as const, filtro: 'medicamento' as const }
    expect(masGrave(f, marcaDesdeModelo('PREGUNTAR_ANTES_DE_ENTRENAR', 'presión'))).toBe(f)
  })
  it.each(['dolor', 'lesion', 'sintoma'] as const)('la pregunta complementa %s conservando la categoría', (filtro) => {
    const f = { tipo: 'salud' as const, filtro }
    const final = masGrave(f, marcaDesdeModelo('PREGUNTAR_ANTES_DE_ENTRENAR', 'Me preocupa algo reciente.'))
    expect(final).toMatchObject({ tipo: 'salud', filtro, orientacion: 'preguntar_general' })
    expect(gravedad(final)).toBe(gravedad(f))
  })
})
