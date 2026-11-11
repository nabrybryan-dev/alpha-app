// @vitest-environment node
/**
 * Tercera ronda (sonda adversaria 2 del 8-nov): terceras personas, preguntas, condicionales, listas de zonas y «antes de comer».
 * Cada caso nació de una falla real. ESCRITAS POR IA: SOLO PRUEBA, NO SIRVEN PARA ENTRENAR EL MODELO PROPIO.
 */
import { describe, expect, it } from 'vitest'
import { conectarMensaje } from './conectores.ts'
import type { CampoCheckin } from './mensajeLargo.ts'

function ver(frase: string, p?: CampoCheckin) {
  const r = conectarMensaje(frase, { preguntaAnterior: p })
  if (r.tipo === 'riesgo') throw new Error('riesgo')
  const campos: Record<string, unknown> = {}
  for (const x of r.propuestas) campos[x.campo] = x.valor
  for (const d of r.dudosas) campos[d.campo] = [...new Set(d.candidatos.map((c) => c.valor))]
  return { campos, notas: r.anotaciones, zonas: r.anotaciones.map((a) => a.zona ?? a.momento) }
}

describe('zona antes o después, singular o plural', () => {
  it('«tengo la espalda molida» (singular, zona primero)', () => {
    expect(ver('tengo la espalda molida').zonas).toEqual(['espalda'])
  })
  it('una lista de zonas da una anotación por zona', () => {
    expect(ver('molida de las piernas, de los brazos y de la espalda').zonas).toEqual(['piernas', 'brazos', 'espalda'])
    expect(ver('molida de las piernas. molida de la espalda').zonas).toEqual(['piernas', 'espalda'])
  })
  it('negativa: una zona suelta SIN una «molida» antes no se anota', () => {
    expect(ver('de la espalda').notas).toEqual([])
    expect(ver('el entreno bien, de la espalda').notas).toEqual([])
  })
})

describe('no es de quien escribe, o no es un hecho', () => {
  it('lo de otra persona no entra a su cuaderno', () => {
    expect(ver('mi esposo está molido de las piernas').notas).toEqual([])
    expect(ver('está molida de las piernas mi hermana').notas).toEqual([])
  })
  it('control: si en el trozo habla de sí misma, sí', () => {
    expect(ver('mi esposo ronca y estoy molida de las piernas').zonas).toEqual(['piernas'])
  })
  it('una pregunta o un «si estuviera» no es un hecho', () => {
    expect(ver('¿estoy molida de las piernas?').notas).toEqual([])
    expect(ver('si estuviera molida de las piernas no entrenaría').notas).toEqual([])
  })
})

describe('comida: cuándo cuenta', () => {
  it('«pesada ANTES del almuerzo» no es reacción a la comida; «después» sí', () => {
    expect(ver('me sentí pesada antes del almuerzo').notas).toEqual([])
    expect(ver('me sentí pesada después del almuerzo').zonas).toEqual(['almuerzo'])
  })
  it('«el almuerzo estuvo pesado» sí', () => {
    expect(ver('el almuerzo estuvo pesado').zonas).toEqual(['almuerzo'])
  })
})

describe('diminutivo', () => {
  it('«fresquita»', () => {
    expect(ver('me siento fresquita', 'cansancio').campos).toEqual({ cansancio: 'POCO' })
  })
})
