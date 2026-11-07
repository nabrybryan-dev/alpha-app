// @vitest-environment node
/**
 * Respuestas cortas a la pregunta de Praxis, lo que queda suelto tras una «y» y «<área> ahí» (volcado de salidas, 7-nov).
 * Halladas al mirar la salida COMPLETA de 30 mensajes realistas: el corazón de la charla («¿Cómo te fue en el entreno?»
 * → «bien») no anotaba nada.
 *
 * ESCRITAS POR IA: SOLO PRUEBA, NO SIRVEN PARA ENTRENAR EL MODELO PROPIO.
 */
import { describe, expect, it } from 'vitest'
import { conectarMensaje } from './conectores.ts'
import { siguientePregunta } from './tarjetaCheckin.ts'
import type { CampoCheckin } from './mensajeLargo.ts'

function salida(frase: string, p?: CampoCheckin) {
  const r = conectarMensaje(frase, { preguntaAnterior: p })
  if (r.tipo === 'riesgo') return 'riesgo'
  const s: Record<string, unknown> = {}
  for (const x of r.propuestas) s[x.campo] = x.valor
  for (const d of r.dudosas) s[d.campo] = [...new Set(d.candidatos.map((c) => c.valor))]
  return s
}

describe('respuesta corta a la pregunta de Praxis', () => {
  it.each([
    ['bien', 'rendimiento', 'BUENA'],
    ['muy bien', 'rendimiento', 'BUENA'],
    ['mal', 'alimentacion', 'MALA'],
    ['fatal', 'calidadSueno', 'MALA'],
    ['bien', 'cansancio', 'POCO'], // «bien» de energía = poco cansancio (polaridad)
    ['mal', 'estres', 'MUCHO'],
    ['mucho', 'estres', 'MUCHO'],
    ['sí, mucho', 'cansancio', 'MUCHO'],
    ['poquito', 'motivacion', 'POCO'],
    ['nada', 'estres', 'POCO'],
  ] as const)('«%s» tras preguntar %s = %s', (frase, p, valor) => {
    expect(salida(frase, p)).toEqual({ [p]: valor })
  })

  it('«bastante» no se elige: entre REGULAR y MUCHO', () => {
    expect(salida('bastante', 'estres')).toEqual({ estres: ['REGULAR', 'MUCHO'] })
  })

  it('hambre: un número dicho de 1 a 10 se toma; «como medio» sigue sin número', () => {
    expect(salida('un 6', 'hambreEscala')).toEqual({ hambreEscala: 6 })
    expect(salida('como un 8', 'hambreEscala')).toEqual({ hambreEscala: 8 })
    expect(salida('15', 'hambreEscala')).toEqual({})
  })

  it('dolor: solo la ausencia explícita da cero', () => {
    expect(salida('no, nada', 'dolor')).toEqual({ dolor: 0 })
    expect(salida('nada', 'dolor')).toEqual({ dolor: 0 })
    expect(salida('ahí, como medio', 'dolor')).toEqual({})
    expect(salida('un poco', 'dolor')).toEqual({})
  })

  it('sin pregunta antes, «bien» suelto no se anota', () => {
    expect(salida('bien')).toEqual({})
  })

  it('una respuesta larga no se lee como corta: «bien» dentro de otra cosa no se toma', () => {
    expect(salida('bien gracias por preguntar, mañana te cuento', 'rendimiento')).toEqual({})
  })
})

describe('lo que queda suelto tras una «y» hereda el área de antes', () => {
  it('«dormí como 5 horas y mal» = 5 horas y calidad MALA', () => {
    expect(salida('dormí como 5 horas y mal')).toMatchObject({ horasSueno: 5, calidadSueno: 'MALA' })
  })

  it('«el entreno bien y la comida mal» no cruza las áreas', () => {
    expect(salida('comí bien y el entreno fatal')).toMatchObject({ alimentacion: 'BUENA', rendimiento: 'MALA' })
  })
})

describe('«<área> ahí»', () => {
  it('«el sueño ahí, el estrés ahí, la comida ahí» = las tres en REGULAR', () => {
    expect(salida('el sueño ahí, el estrés ahí, la comida ahí')).toEqual({ calidadSueno: 'REGULAR', estres: 'REGULAR', alimentacion: 'REGULAR' })
  })

  it('«lo dejé ahí» sigue sin dar nada, aunque haya pregunta', () => {
    expect(salida('lo dejé ahí', 'estres')).toEqual({})
  })
})

describe('la pregunta del cansancio pregunta por el cansancio', () => {
  it('las dos formas nombran el cansancio (así «mucho» o «poco» se leen al pie de la letra)', () => {
    for (const turno of [0, 1]) expect(siguientePregunta(['cansancio'], turno)?.texto).toMatch(/cansancio|cansad/i)
  })
})
