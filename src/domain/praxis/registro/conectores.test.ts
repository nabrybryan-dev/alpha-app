// @vitest-environment node
/**
 * Conectores: lo vago → escala del check-in (diseño 2026-11-07, paso 1).
 *
 * ESCRITOS POR IA: SOLO PRUEBA, NO SIRVEN PARA ENTRENAR EL MODELO PROPIO (regla del 5-nov-2026).
 * Frases inventadas, sin nombres ni datos de nadie.
 */
import { describe, expect, it } from 'vitest'
import { conectarMensaje, gradoVago, nivelesDeGrado, tiempoDe, type ResultadoConectores } from './conectores.ts'
import type { CampoCheckin } from './mensajeLargo.ts'

function propuesta(texto: string, preguntaAnterior?: CampoCheckin) {
  const r: ResultadoConectores = conectarMensaje(texto, { preguntaAnterior })
  if (r.tipo !== 'propuesta') throw new Error('se esperaba propuesta, salió riesgo')
  return r
}

describe('lexicón de lo vago', () => {
  it('C01 reconoce las formas del pedido de Bryan', () => {
    expect(gradoVago('estoy ahí')).toBe('medio')
    expect(gradoVago('ahí vamos')).toBe('medio')
    expect(gradoVago('como medio')).toBe('medio')
    expect(gradoVago('no tan bien')).toBe('medio_bajo')
    expect(gradoVago('bien no más')).toBe('medio_alto')
    expect(gradoVago('lo dejé ahí en la mesa')).toBeNull()
  })

  it('C02 respeta la polaridad de cada campo', () => {
    expect(nivelesDeGrado('estres', 'medio_bajo')).toEqual(['REGULAR', 'MUCHO'])
    expect(nivelesDeGrado('cansancio', 'medio_bajo')).toEqual(['REGULAR', 'MUCHO'])
    expect(nivelesDeGrado('motivacion', 'medio_bajo')).toEqual(['REGULAR', 'POCO'])
    expect(nivelesDeGrado('rendimiento', 'medio_alto')).toEqual(['BUENA', 'REGULAR'])
    expect(nivelesDeGrado('dolor', 'medio')).toEqual([])
    expect(nivelesDeGrado('hambreEscala', 'medio')).toEqual([])
  })

  it('C03 lo habitual no es hoy', () => {
    expect(tiempoDe('siempre ando estresado')).toBe('habitual')
    expect(tiempoDe('duermo como seis horas')).toBe('habitual')
    expect(tiempoDe('anoche dormí seis horas')).toBe('hoy')
    expect(tiempoDe('estoy cansada')).toBe('hoy')
  })
})

describe('área por la pregunta anterior', () => {
  it('C04 «ahí, como medio» tras preguntar el estrés = REGULAR con confianza baja y cita literal', () => {
    const t = 'ahí, como medio'
    const r = propuesta(t, 'estres')
    expect(r.propuestas).toHaveLength(1)
    expect(r.propuestas[0]).toMatchObject({ campo: 'estres', valor: 'REGULAR', confianza: 'baja', origen: 'vago' })
    expect(t).toContain(r.propuestas[0].cita)
  })

  it('C05 sin pregunta anterior, «estoy ahí» no llena nada y queda visible', () => {
    const r = propuesta('estoy ahí')
    expect(r.propuestas).toEqual([])
    expect(r.dudosas).toEqual([])
    expect(r.descartado).toEqual([{ area: 'sin área', cita: 'estoy ahí', motivo: expect.stringContaining('no hubo una pregunta') }])
  })

  it('C06 «no tan bien» tras preguntar la energía no da POCO cansancio: elige entre REGULAR y MUCHO', () => {
    const r = propuesta('no tan bien', 'cansancio')
    expect(r.propuestas).toEqual([])
    expect(r.dudosas[0]).toMatchObject({ campo: 'cansancio' })
    expect(r.dudosas[0].candidatos.map((c) => c.valor)).toEqual(['REGULAR', 'MUCHO'])
  })

  it('C07 con dolor en el mensaje no se toma nada: va a la ruta de salud (filtro de riesgo primero)', () => {
    expect(conectarMensaje('más o menos, me duele la rodilla', { preguntaAnterior: 'rendimiento' }).tipo).toBe('riesgo')
  })
})

describe('vago con área dicha', () => {
  it('C08 «dormí como medio» = calidad REGULAR baja, sin convertir «medio» en horas', () => {
    const r = propuesta('Dormí como medio, el entreno no tan bien')
    expect(r.propuestas.find((p) => p.campo === 'calidadSueno')).toMatchObject({ valor: 'REGULAR', confianza: 'baja' })
    expect(r.propuestas.find((p) => p.campo === 'horasSueno')).toBeUndefined()
    const rend = r.dudosas.find((d) => d.campo === 'rendimiento')
    expect(rend?.candidatos.map((c) => c.valor)).toEqual(['REGULAR', 'MALA'])
  })

  it('C09 «hambre como medio» no da un número: pregunta por tramo con los textos del formulario', () => {
    const r = propuesta('Hoy el hambre como medio, comí bien')
    expect(r.propuestas.find((p) => p.campo === 'hambreEscala')).toBeUndefined()
    expect(r.preguntas).toHaveLength(1)
    expect(r.preguntas[0].opciones.map((o) => [o.desde, o.hasta])).toEqual([[1, 3], [4, 6], [7, 8], [9, 10]])
    expect(r.propuestas.find((p) => p.campo === 'alimentacion')).toMatchObject({ valor: 'BUENA', origen: 'tabla' })
  })

  it('C10 el dolor vago no se escribe: va a la ruta de salud', () => {
    expect(conectarMensaje('El dolor como medio', { preguntaAnterior: 'dolor' }).tipo).toBe('riesgo')
    // Sin palabra de dolor y con la pregunta del dolor, tampoco: el dolor no se llena con lo vago.
    const r = propuesta('ahí, como medio', 'dolor')
    expect(r.propuestas).toEqual([])
    expect(r.descartado.some((d) => d.area === 'dolor')).toBe(true)
  })
})

describe('hoy frente a lo habitual', () => {
  it('C11 «siempre ando estresada» no escribe el estrés de hoy; «hoy dormí fatal» sí', () => {
    const r = propuesta('Siempre ando estresada, hoy dormí fatal')
    expect(r.propuestas.find((p) => p.campo === 'estres')).toBeUndefined()
    expect(r.habituales.find((h) => h.campo === 'estres')).toMatchObject({ valor: 'MUCHO' })
    expect(r.propuestas.find((p) => p.campo === 'calidadSueno')).toMatchObject({ valor: 'MALA' })
  })
})

describe('choques y reglas que se conservan', () => {
  it('C12 tabla y vago con valores distintos en el mismo campo: dudoso, no se elige', () => {
    const r = propuesta('Estoy estresadísima, bueno, ahí, como medio', 'estres')
    expect(r.propuestas.find((p) => p.campo === 'estres')).toBeUndefined()
    expect(r.dudosas.find((d) => d.campo === 'estres')?.candidatos.map((c) => c.valor)).toEqual(expect.arrayContaining(['MUCHO', 'REGULAR']))
  })

  it('C13 el riesgo sigue primero: no se extrae nada', () => {
    const r = conectarMensaje('ahí, como medio, la verdad no quiero vivir', { preguntaAnterior: 'estres' })
    expect(r.tipo).toBe('riesgo')
  })

  it('C14 lo que la tabla ya entendía sale igual, ahora con origen tabla', () => {
    const r = propuesta('Dormí fatal y comí bien')
    expect(r.propuestas.map((p) => [p.campo, p.valor, p.origen])).toEqual(
      expect.arrayContaining([['calidadSueno', 'MALA', 'tabla'], ['alimentacion', 'BUENA', 'tabla']]),
    )
  })
})
