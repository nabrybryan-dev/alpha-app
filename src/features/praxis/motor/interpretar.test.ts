import { describe, expect, it } from 'vitest'
import { interpretar } from './interpretar'

/**
 * La tabla de la maqueta (`probarInterprete`), hecha prueba: frases reales y lo que deben
 * dar. Lo primero son las señales de riesgo: si una de estas deja de detectarse, la
 * Quieta no aparece.
 */
type Caso = [frase: string, clave: string, esperado: string | number | boolean, turno?: string]

const CASOS: Caso[] = [
  ['me quiero morir', 'riesgo', 'vida'], ['quiero morirme', 'riesgo', 'vida'], ['tengo ganas de morir', 'riesgo', 'vida'],
  ['mi esposo me pegó anoche', 'riesgo', 'pareja'], ['mi novia me golpeó', 'riesgo', 'pareja'], ['no quiero vivir más', 'riesgo', 'vida'],
  ['no aguanto más', 'ambiguo', true], ['ya no puedo más con todo', 'ambiguo', true], ['quisiera desaparecer', 'ambiguo', true],
  ['me di un atracón anoche', 'alimentaria', true],
  ['dormí bien, unas 7 horas y media', 'horasSueno', 7.5], ['dormí siete y media horas', 'horasSueno', 7.5], ['dormí 6 horas', 'horasSueno', 6],
  ['dormí bien', 'calidadSueno', 'BUENA'], ['no dormí bien', 'duda:calidadSueno', 'MALA,REGULAR'], ['no dormí mal', 'duda:calidadSueno', 'REGULAR,BUENA'],
  ['no estoy cansada', 'duda:cansancio', 'POCO,REGULAR'], ['estoy mamado', 'cansancio', 'MUCHO'], ['no estoy motivada', 'duda:motivacion', 'POCO,REGULAR'],
  ['no me fue bien', 'duda:rendimiento', 'MALA,REGULAR', 'entreno'], ['no comí bien', 'duda:alimentacion', 'MALA,REGULAR'],
  ['hambre como 6 de 10', 'hambreEscala', 6], ['hambre como 6 de 10', 'sinCampo', 'dolor', 'mesa'],
  ['me duele la pierna derecha', 'sinCampo', 'entreno', 'cuerpo'], ['me duele la pierna derecha', 'dolorDonde', 'pierna derecha', 'cuerpo'],
  ['la muñeca derecha', 'dolorDonde', 'muñeca derecha', 'cuerpo'], ['hice pierna, me fue bien', 'entreno', 'LEG A', 'entreno'],
  ['sí, me salió bien', 'sinCampo', 'rendimiento', 'hilo'], ['descansé bien', 'sinCampo', 'entreno', 'noche'], ['hice mercado', 'sinCampo', 'entreno', 'noche'],
]

describe('interpretar · lo que dijo la persona', () => {
  it.each(CASOS)('«%s» → %s %s', (frase, clave, esperado, turno) => {
    const r = interpretar(frase, turno ?? null)
    if (clave === 'riesgo') expect(r.riesgo).toBe(esperado)
    else if (clave === 'ambiguo') expect(!!r.ambiguo).toBe(esperado)
    else if (clave === 'alimentaria') expect(!!r.alimentaria).toBe(esperado)
    else if (clave === 'sinCampo') expect(r.campos.some((c) => c.campo === esperado)).toBe(false)
    else if (clave.startsWith('duda:')) {
      const d = r.dudas.find((x) => x.campo === clave.slice(5))
      expect(d?.opciones.join(',')).toBe(esperado)
    } else {
      expect(r.campos.find((x) => x.campo === clave)?.valor).toBe(esperado)
    }
  })

  it('«no quiero morirme de hambre» no es una señal de riesgo', () => {
    expect(interpretar('no quiero morirme de hambre', null).riesgo).toBeUndefined()
  })

  it('una señal de riesgo corta la lectura: no se anota nada más de esa frase', () => {
    const r = interpretar('dormí bien pero quiero morirme', 'noche')
    expect(r.riesgo).toBe('vida')
    expect(r.campos).toEqual([])
  })
})
