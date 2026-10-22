import { describe, expect, it, vi } from 'vitest'
import * as riesgo from './riesgo'
import { decidirTurno } from './conversacion'
import { detectarIntencionPorReglas, enrutarPorReglas, leerRiesgoPorReglas } from './enrutadorReglas'
import type { LoQuePraxisVe } from './plan/listaBlanca'

/**
 * El enrutador con las reglas que ya existen. Frases ficticias. La coherencia con la pantalla de hoy
 * (`decidirTurno`) es lo que no se puede romper: el enrutador nunca deja pasar lo que la pantalla frena.
 */
const coach = { rol: 'coach' as const, personaId: 'p1' }
const nadaVisible = {} as LoQuePraxisVe

describe('leerRiesgoPorReglas · mismo filtro que la pantalla', () => {
  it('una frase de trabajo normal no tiene marca', () => {
    expect(leerRiesgoPorReglas('hice 3 series de press con 40 kg')).toBe('ninguno')
  })
  it('un dolor de rodilla es de salud', () => {
    expect(leerRiesgoPorReglas('me duele la rodilla al bajar')).toBe('salud')
  })
  it('dolor de pecho lo marca el filtro como la señal más grave: riesgo, no salud', () => {
    expect(leerRiesgoPorReglas('me duele el pecho al entrenar')).toBe('riesgo')
  })
})

describe('leerRiesgoPorReglas · cada tipo de marca, con el filtro simulado (sin frases sensibles)', () => {
  const con = (marca: riesgo.MarcaDeRiesgo | null) => {
    const espia = vi.spyOn(riesgo, 'filtroDeRiesgo').mockReturnValue(marca)
    const r = leerRiesgoPorReglas('x')
    espia.mockRestore()
    return r
  }
  it.each([['vida'], ['pareja'], ['nino']] as const)('quieta (%s) -> riesgo', (linea) => {
    expect(con({ tipo: 'quieta', linea })).toBe('riesgo')
  })
  it('cuidado -> riesgo, nunca rebajado a salud', () => {
    expect(con({ tipo: 'cuidado' })).toBe('riesgo')
  })
  it('salud -> salud', () => {
    expect(con({ tipo: 'salud', filtro: 'dolor' })).toBe('salud')
  })
  it('sin marca -> ninguno', () => {
    expect(con(null)).toBe('ninguno')
  })
})

describe('coherencia con decidirTurno', () => {
  const frases = [
    'hice 3 series de press con 40 kg',
    '¿cuántas series me tocan hoy?',
    'me duele el pecho al entrenar',
    'me duele la rodilla al bajar',
    'comí arroz con pollo al almuerzo',
    '',
  ]
  it.each(frases)('«%s»: si la pantalla la frena, el enrutador también', (frase) => {
    const turno = decidirTurno(frase, nadaVisible, '2026-10-17')
    const r = enrutarPorReglas({ ...coach, frase })
    if (turno.paso === 'quieta' || turno.paso === 'cuidado') expect(r.ruta).toBe('riesgo')
    if (turno.paso === 'salud') expect(r.ruta).toBe('salud')
    if (turno.paso === 'registrar' || turno.paso === 'plan') expect(['riesgo', 'salud']).not.toContain(r.ruta)
  })
})

describe('detectarIntencionPorReglas · primer paso, sin medir', () => {
  it.each([
    ['cambia mi RIR a 2 en la sentadilla', 'entrenar', 'cambiar'],
    ['anota que comí arroz con pollo', 'nutricion', 'cambiar'],
    ['¿cuántas series me tocan?', 'entrenar', 'explicar'],
    ['muéstrame cómo voy', 'progreso', 'mirar'],
    ['¿qué pendiente tengo hoy?', 'hoy', 'explicar'],
  ] as const)('«%s» -> %s / %s', (frase, area, accion) => {
    expect(detectarIntencionPorReglas(frase)).toMatchObject({ area, accion })
  })
  it('sin palabras conocidas la confianza queda bajo el umbral y no propone cambios', () => {
    const r = enrutarPorReglas({ ...coach, frase: 'zxcv qwer' })
    expect(r.ruta).toBe('aclarar')
    expect(r.requiereConfirmacion).toBe(false)
  })
})

describe('enrutarPorReglas · recorrido completo', () => {
  it('equipo + cambiar el RIR: propone y pide confirmar', () => {
    expect(enrutarPorReglas({ ...coach, frase: 'cambia mi RIR a 2 en la sentadilla' })).toMatchObject({
      ruta: 'proponer',
      area: 'entrenar',
      requiereConfirmacion: true,
      escribe: false,
    })
  })
  it('un asesorado sigue bloqueado mientras el interruptor esté apagado', () => {
    expect(enrutarPorReglas({ rol: 'asesorado', personaId: 'p1', frase: 'cambia mi RIR a 2' }).ruta).toBe('bloqueada')
  })
})
